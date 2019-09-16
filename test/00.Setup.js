
require('dotenv').config()
const fs = require('fs-extra')
const path = require('path')
const chalk = require('chalk')
const debug = require('./debug')
global.logError = message => console.log(chalk.bold.bgRed('\n' + message + '\n'))
const sinon = require('sinon')
global.sinon = sinon
const chai = require('chai')
chai.should()

global.outlistLocalPath = path.join(__dirname, 'output')
global.jobStatement = process.env.ZOS_JOB_STATEMENT

if (!jobStatement) {
  logError('Please set Environment Variable : ZOS_JOB_STATEMENT .')
  process.exit(1)
}

fs.emptyDirSync(outlistLocalPath)

global.config = {
  user: process.env.ZOS_FTP_USERNAME, // String: REQUIRED
  password: process.env.ZOS_FTP_PASSWD, // String: REQUIRED
  host: process.env.ZOS_FTP_HOST, // String: REQUIRED
  port: process.env.ZOS_FTP_PORT, // Number: OPTIONAL, defaults to 21.
  encoding: process.env.ZOS_ENCODING, // String: OPTIONAL, defaults to 'UTF8'
  watchJobInterval: 1000,
  deleteMainframeOutlist: false, // default= true
  loggingFunction: debug(outlistLocalPath),
  jobStatement
}

if (!config.user ||
  !config.password ||
  !config.host ||
  !config.port
) {
  logError('Please set Environment Variables : ZOS_FTP_* .')
  process.exit(1)
}
