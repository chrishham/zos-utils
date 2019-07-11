require('dotenv').config()
const path = require('path')
const fs = require('fs-extra')
const chai = require('chai')
const chalk = require('chalk')
const logError = message => console.log(chalk.bold.bgRed('\n' + message + '\n'))
const debug = require('./debug')
const zosUtils = require('../lib/index.js')

chai.should()

let config = {
  user: process.env.ZOS_FTP_USERNAME, // String: REQUIRED
  password: process.env.ZOS_FTP_PASSWD, // String: REQUIRED
  host: process.env.ZOS_FTP_HOST, // String: REQUIRED
  port: process.env.ZOS_FTP_PORT, // Number: OPTIONAL, defaults to 21.
  encoding: process.env.ZOS_ENCODING, // String: OPTIONAL, defaults to 'UTF8'
  watchJobInterval: 1000,
  outlistLocalPath: path.join(__dirname, 'output'),
  deleteMainframeOutlist: false // default= true
}

if (!config.user ||
  !config.password ||
  !config.host ||
  !config.port
) {
  logError('Please set Environment Variables : ZOS_FTP_* .')
  process.exit(1)
}

const { ZosJob } = zosUtils(config)

const jobStatement = process.env.ZOS_JOB_STATEMENT

if (!jobStatement) {
  logError('Please set Environment Variable : ZOS_JOB_STATEMENT .')
  process.exit(1)
}

const basicJCL = `${jobStatement} \n// EXEC PGM=IEFBR14`

before(() => {
  return fs.remove(config.outlistLocalPath)
    .then(async () => {
      await Promise.all([
        fs.mkdirp(config.outlistLocalPath),
        fs.writeFile(path.join(__dirname, 'local.jcl'), basicJCL.replace(/\n/g, '\r\n'))
      ])
      config.loggingFunction = debug(path.join(__dirname, 'output'))
    })
    .catch(error => console.log('Error at Before Hook:', error.message))
})

describe.only('Submitting Job from string.', () => {
  let jcl = {
    name: 'BASIC',
    description: 'Basic Jcl',
    source: basicJCL,
    RC: '0000'
  }

  it.only('should end up with RC=0000', async () => {
    try {
      let job = new ZosJob({ jcl: Object.assign({}, jcl) })
      await job.sub()
      job.RC.should.be.equal('0000')
    } catch (error) {
      let message = error.message
      if (/PASS command failed/.test(message)) {
        message = `Failed to connect (User:${config.user} / Password : ${config.pwd}).`
      } else message += ' Please check ZOS_JOB_STATEMENT.'
      logError(message)
      process.exit(1)
    }
  })

  it('Cannot resubmit job while it is running', () => {
    let job = new ZosJob({ jcl: Object.assign({}, jcl) })
    job.sub()
    return job.sub()
      .then(
        () => { throw new Error() },
        () => { }
      )
  })

  it('should end with JCL Error', () => {
    jcl.source = `${jobStatement} \n/  EXEC PGM=ICETOOL`
    config.port = null
    config.encoding = null
    let job = new ZosJob({ jcl: Object.assign({}, jcl) })
    return job.sub()
      .then(
        () => { throw new Error() },
        () => { job.RC.should.be.equal('JCL Error') }
      )
  })

  it('JCL should fail to submit', () => {
    jcl.source =
      `
//JOB Destined to fail
//`
    let job = new ZosJob({ jcl: Object.assign({}, jcl) })
    return job.sub()
      .then(
        () => { throw new Error('JCL passed instead of failing') },
        () => { job.RC.should.be.equal('Jcl Failed to Submit.') }
      )
  })

  it('Check string \\r\\n line ending', () => {
    config.encoding = 'ISO8859-7'
    config.loggingFunction = null
    config.watchJobInterval = null
    jcl.source =
      `${jobStatement}` + '\r\n' +
      '//******************************************' + '\r\n' +
      '//* Testing string \\r\\n line ending..' + '\r\n' +
      '// EXEC PGM=IEFBR14'
    let job = new ZosJob({ jcl: Object.assign({}, jcl) })
    config.loggingFunction = debug(path.join(__dirname, 'output'))
    return job.sub()
  })
})

describe('Submitting Job from localFile', () => {
  let jcl = {
    name: 'BASIC',
    description: 'Basic Jcl',
    RC: '0000',
    source: path.resolve(__dirname, 'local.jcl') // Absolute path of local file ,has to be utf8 and \r\n
  }

  it('should end up with RC=0000', async () => {
    let job = new ZosJob({ jcl })
    await job.sub()
    job.RC.should.be.equal('0000')
  })
})

describe('Submitting Job From hostFile', function () {
  let jcl = {
    name: 'TESTSUB',
    description: 'Check for host file existence.. ',
    RC: '0000',
    source: `${config.user}.SOURCE.PDS(TESTSUB)`
  }

  it('should end up with RC=0000', async function () {
    config.deleteMainframeOutlist = true
    config.outlistLocalPath = null
    let job = new ZosJob({ jcl })
    await job.sub()
    job.RC.should.be.equal('0000')
  })

  it('should fail if expected RC=0004', function (done) {
    config.deleteMainframeOutlist = true
    jcl.RC = '0004'
    let job = new ZosJob({ jcl })
    job.sub().should.be.rejected.notify(done)
  })

  it('should not cancel job that is not running', function (done) {
    let job = new ZosJob({ jcl })
    job.cancel().should.be.rejected.notify(done)
  })

  it('should cancel job that is running', function (done) {
    jcl.source = `${config.user}.SOURCE.PDS(LINKDB2)` // long running function
    jcl.name = 'LOAUNL'
    let job = new ZosJob({ jcl })
    job.sub().catch(() => { })
    job.once('status-change', () => job.cancel().should.eventually.be.undefined.notify(done))
  })
})

describe('Should reject invalid JCL source', function () {
  it('Should reject invalid JCL source', function (done) {
    let jcl = {
      name: 'LINKDB2',
      description: 'Check for host file existence.. ',
      RC: '0004',
      source: 'this is not a jcl'
    }
    let job = new ZosJob({ jcl })
    job.sub().should.be.rejected.notify(done)
  })
})

describe.skip('Should succesfully resubmit a job', function () {
  it('Should succesfully resubmit a job', function (done) {

  })
})
