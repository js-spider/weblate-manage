const fs = require('fs-extra')
const chalk = require('chalk')
const path = require('path')
const simpleGit = require('simple-git');
const prettier = require('prettier');


const git = simpleGit();
const cwd = process.cwd()
const configPath = path.resolve(cwd,'./.weblate.json')
const tempDir = path.resolve(__dirname,'./temp_dir') // 通过git clone 拉取最新的多语言文件并存储到 temp_dir 中
const cacheDir = path.resolve(__dirname,'./cache_dir') // 拷贝项目中lang目录作为基础，在此目录中替换语言文件 最后覆盖项目中的lang目录

let sourceDir, gitRemote, datas, langMap, diffMapping // 同步开始前 会通过readConfig() 从weblate.json 中读取数据并为这些属性赋值


function onPull(){
  readConfig().then(()=>{
    let result = 'pending'
    console.log(chalk.bgCyanBright('开始同步>>'))
    const cacheResult = cacheOldDir()
    if(cacheResult){
      console.log(chalk.cyan('从远程仓库拉取最新翻译文件 ... '))
      git.clone(gitRemote,tempDir).then(()=>{
        const allData = getAllData()
        const allFilePaths = getAllFilePaths()
        writeToJsons(allFilePaths, allData)
      }).then(()=>{
        result = 'resolved'
        console.log(chalk.cyan('替换翻译完成后的目录 ... '))
        fs.copySync(cacheDir,sourceDir,{ overwrite: true})
      }).catch((e)=>{
        result = 'rejected'
        console.log(e)
      }).finally(()=>{
        console.log(chalk.cyan('清空临时缓存目录 ... '))
        fs.removeSync(tempDir)
        fs.removeSync(cacheDir)
        switch(result){
          case 'resolved':
            console.log(chalk.bgCyanBright('同步成功！'))
            break;
          case 'rejected':
            console.log(chalk.red('同步失败！'))
            break;
        }
      })
    }
  }).catch(e =>{
    console.log(chalk.red('获取配置文件失败,请检查项目根目录下是否存在.weblate.json文件'))
  })
}

function onClear(){
  return new Promise((resolve, reject)=>{
    fs.remove(tempDir,(err)=>{
      if(err){
        reject(err)
      }
      resolve()
    })
  })
}

function readConfig(){
  return new Promise((resolve,reject)=>{
    try{
      const config = fs.readJsonSync(configPath)
      const {langDir, remote, lang, diff } = config
      sourceDir = path.resolve(cwd,langDir)
      gitRemote = remote
      diffMapping = diff
      langMap = lang
      datas = {}
      Object.values(lang).forEach(item =>{
        datas[item] = []
      })
      resolve(config)
    }catch(e){
      reject(e)
    }
  })
}

function cacheOldDir(){
  console.log(chalk.cyan('拷贝旧目录到缓存目录 ... '))
  try{
    fs.copySync(sourceDir,cacheDir)
    return true
  }catch(e){
    console.log(chalk.red('缓存旧数据失败！'))
    return false
  }
}

function getAllData(){
  Object.keys(datas).forEach(lang =>{
    const formatLang = diffMapping[lang] || lang
    datas[lang] = fs.readJsonSync(path.resolve(tempDir, `${formatLang}.json`))
  })
  return datas
}


function getAllFilePaths(){
  const allFilePaths = []
  fs.readdirSync(cacheDir).forEach((file) => {
    const pathname = path.join(cacheDir, file);
    if (fs.statSync(pathname).isDirectory()) {
      allFilePaths.push(pathname);
    }
  });
  return allFilePaths;
}

function writeToJsons(allFilePaths, allData){
  const allImportPaths = []
  const repeatKeys = []
  console.log(chalk.cyan('向缓存目录中写入翻译文件 ... '))
  allFilePaths.forEach(filePath =>{
    const folder = filePath.slice(filePath.lastIndexOf("/") + 1);
    if(!allImportPaths.includes(folder) && folder !== "global"){
      allImportPaths.push(folder);
    }
     if(fs.existsSync(`${filePath}/zh_CN.json`)) {
        const zhJSON = fs.readJsonSync(`${filePath}/zh_CN.json`);
        Object.keys(allData).forEach(language =>{
          const jsonData = {};
          const allLevel1Keys = Object.keys(zhJSON);
          allLevel1Keys.forEach((langLevel1Key) => {
            jsonData[langLevel1Key] = jsonData[langLevel1Key] || {}
            const allLevel2Keys = Object.keys(zhJSON[langLevel1Key]);
            allLevel2Keys.forEach((langKeyLevel2) => {
              if(jsonData[langLevel1Key][langKeyLevel2]){
                repeatKeys.push(`${langLevel1Key}.${langKeyLevel2}`) // 如果已经存在则代表重复
              }
              jsonData[langLevel1Key][langKeyLevel2] = (allData[language] && allData[language][langKeyLevel2]) || "@TODO待翻译";
            });
          });
          fs.writeJSONSync(path.join(filePath, `./${language}.json`), jsonData, { spaces: 2});
        })
      }
    })
  if(repeatKeys.length){
    console.log(' 重复的二级KEY >>>>>> ', repeatKeys);
  }
  writeImport(allImportPaths)
}

// 写进引入文件
function writeImport(allImportPaths){
  console.log(chalk.cyan('写入全局导入文件并格式化 ... '))
  Object.keys(langMap).forEach(language =>{
    let importArr = [];
    allImportPaths.forEach((folder) =>{
      importArr.push(`...require("../${folder}/${langMap[language]}.json")`)
    })
    const importJsonPath = path.join(cacheDir, `./global/${language}.js`)
    const content =`export default {${importArr.join(',')}}`
    fs.writeFileSync(importJsonPath, prettierContent(content), 'utf8')
  })
};


// 使用prettier格式化内容
function prettierContent(content){
  return prettier.format(content, {
    parser: 'babel',
    trailingComma: 'es5',
    printWidth: 80,
    tabWidth: 2,
  });
}



module.exports = {
  onPull
}
