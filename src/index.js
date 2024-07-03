const { program } = require('commander');
const actions = require('./actions/index.js')
const PKG = require('../package.json');



program
  .version(PKG.version);

program
  .command('pull')
  .description('')
  .action(actions.onPull);

program
  .command('fetch')
  .description('lang :语言名称 默认: zh_CN')
  .argument('[lang]','语言名称 默认: zh_CN')
  .action(actions.onFetch);


program
  .parse(process.argv);

if (process.argv.length === 2) {
  program.outputHelp();
}
