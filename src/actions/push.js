const fs = require('fs-extra')
const chalk = require('chalk')
const path = require('path')
const simpleGit = require('simple-git');


const cwd = process.cwd()
const git = simpleGit({baseDir:cwd});
const configPath = path.resolve(cwd,'./.weblate.json')
const tempDir = path.resolve(__dirname,'./temp_dir') // 通过git clone 拉取最新的多语言文件并存储到 temp_dir 中

let sourceDir, gitRemote, wordDir, gitBranch,increment


function onPush(){
    readConfig().then(()=>{
        console.log(chalk.cyan('提取词条中...'));
         git.clone(gitRemote,tempDir).then(()=>{
            const wordDirPath = path.resolve(wordDir,gitBranch)
            const oldWords = getOldWords()
            const newWords = getNewWords(oldWords, wordDirPath)
            writeJson(newWords, wordDirPath)
         }).finally(()=>{
            fs.removeSync(tempDir)
         })
    })
}

// 同步获取 git 分支
function getCurrentGitBranch(cb) {
    git.branch(function(err,branches){
        if(err){
            console.log(chalk.red('获取当前分支失败'));
            return
        }
        const current = branches.current
        cb && cb(current)
    })
  }

function readConfig(){
    return new Promise((resolve,reject)=>{
      try{
        const config = fs.readJsonSync(configPath)
        sourceDir = path.resolve(cwd,config.langDir)
        gitRemote = config.remote
        wordDir = path.resolve(cwd,config.wordDir)
        increment = false
        getCurrentGitBranch((current)=>{
            gitBranch = current
            resolve()
        })
        
      }catch(e){
        reject(e)
      }
    })
}

function getOldWords(){
    try{
        const jsonData = fs.readJsonSync(path.resolve(tempDir, `zh_CN.json`))
        return jsonData
    }catch(e){
        console.log(chalk.red('读取zh_CN.json文件失败'));
    }
}

function getNewWords(oldWords, wordDirPath){
    try{
        const newWords = {}
        const allFilePaths = getAllFilePaths()
        allFilePaths.forEach(folder =>{
            const jsonData = fs.readJSONSync(path.resolve(folder,'zh_CN.json'))
            if(jsonData){
               Object.values(jsonData).forEach(item =>{
                if(typeof item === 'object'){
                    Object.keys(item).forEach(it =>{
                        if(!oldWords[it] || oldWords[it] !== item[it] ){
                            newWords[it] = item[it]
                        }
                    })
                }
               })
            }
        })
        fs.ensureDirSync(wordDirPath)
        const history = getWordHistory(wordDirPath)
        if(Array.isArray(history) && history.length){
            increment = true
            history.forEach(file =>{
                const jsonData = fs.readJSONSync(path.resolve(wordDirPath,file))
                Object.keys(newWords).forEach(key =>{
                    if(jsonData[key] && jsonData[key] === newWords[key]){
                        delete newWords[key]
                    } 
                })
            })
        }
        return newWords
    }catch(e){
        console.log(chalk.red('获取新词条失败'), e);
    }
}    

function getAllFilePaths(){
    const allFilePaths = []
    fs.readdirSync(sourceDir).forEach((file) => {
      if(file !== 'global'){
        const pathname = path.join(sourceDir, file);
        if (fs.statSync(pathname).isDirectory()) {
            allFilePaths.push(pathname);
        }
      }
    });
    return allFilePaths;
}

function getWordHistory(wordDir){
    const history = []
    fs.readdirSync(wordDir).forEach((file)=>{
        history.push(file)
    })
    return history
}



function writeJson(data, wordDirPath){
    if(data && Object.keys(data).length){
        try{
            const fileName = path.resolve(wordDirPath,`${new Date().getTime()}${increment ? '.increment.json':'.json'}`)
            fs.writeJSONSync( fileName, data, { spaces: 2})
            console.log(chalk.cyan('词条文件【'), chalk.blue(fileName), chalk.cyan('】已生成'));
        }catch(e){
            console.log(chalk.red('创建词条文件失败'));
        }
    }else{
        console.log(chalk.bgCyanBright('无新增词条'));
    }    
}



module.exports = {
  onPush
}