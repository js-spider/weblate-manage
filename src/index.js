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
  .command('push')
  .description('')
  .action(actions.onPush);


program
  .parse(process.argv);

if (process.argv.length === 2) {
  program.outputHelp();
}
