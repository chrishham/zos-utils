require('dotenv').config()
const path = require('path')
const fs = require('fs-extra')
const chai = require('chai')
const chalk = require('chalk')
const logError = message => console.log(chalk.bold.bgRed('\n' + message + '\n'))
const debug = require('./debug')
const zosUtils = require('../lib/index.js')

chai.should()

const outlistLocalPath = path.join(__dirname, 'output')

const jobStatement = process.env.ZOS_JOB_STATEMENT

if (!jobStatement) {
  logError('Please set Environment Variable : ZOS_JOB_STATEMENT .')
  process.exit(1)
}

fs.emptyDirSync(outlistLocalPath)

let config = {
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

const { ZosFtp } = zosUtils(config)

ZosFtp.put(path.resolve(__dirname, 'local.jcl'), 'U764.VANILLIA.PDS(GANGSTER)')
  .then(() => console.log('MAIN: Success!'))
  .catch(error => console.log('MAIN:', error.message))

ZosFtp.put(path.resolve(__dirname, 'local.jcl'), 'GANGSTER')
  .then(() => console.log('MAIN: Success!'))
  .catch(error => console.log('MAIN:', error.message))
