const path = require('path')
const fs = require('fs-extra')
const chai = require('chai')
const chalk = require('chalk')
const logError = message => console.log(chalk.bold.bgRed('\n' + message + '\n'))
const { ZosJob } = require('../lib/index.js')
const debug = require('./debug')

chai.should()

let ftpLogin = {
  user: process.env.ZOS_FTP_USERNAME, // String: REQUIRED
  pwd: process.env.ZOS_FTP_PASSWD, // String: REQUIRED
  host: process.env.ZOS_FTP_HOST, // String: REQUIRED
  port: process.env.ZOS_FTP_PORT // Number: OPTIONAL, defaults to 21.
}

if (!ftpLogin.user ||
  !ftpLogin.pwd ||
  !ftpLogin.host ||
  !ftpLogin.port
) {
  logError('Please set Environment Variables : ZOS_FTP_* .')
  process.exit(1)
}

let options = {
  encoding: 'ISO8859-7', // String: OPTIONAL, defaults to 'UTF8'
  watchJobInterval: 1000,
  outlistLocalPath: path.join(__dirname, 'output'),
  deleteMainframeOutlist: false // default= true
}

const jobStatement = process.env.ZOS_JOB_STATEMENT

if (!jobStatement) {
  logError('Please set Environment Variable : ZOS_JOB_STATEMENT .')
  process.exit(1)
}

const basicJCL = `${jobStatement} \n// EXEC PGM=IEFBR14`

before(() => {
  return fs.remove(options.outlistLocalPath)
    .then(async () => {
      await Promise.all([
        fs.mkdirp(options.outlistLocalPath),
        fs.writeFile(path.join(__dirname, 'local.jcl'), basicJCL.replace(/\n/g, '\r\n'))
      ])
      options.loggingFunction = debug(path.join(__dirname, 'output'))
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

  it('should end up with RC=0000', async () => {
    try {
      let job = new ZosJob({ jcl: Object.assign({}, jcl), ftpLogin, options })
      await job.sub()
      job.RC.should.be.equal('0000')
    } catch (error) {
      let message = error.message
      if (/PASS command failed/.test(message)) {
        message = `Failed to connect (User:${ftpLogin.user} / Password : ${ftpLogin.pwd}).`
      } else message += ' Please check ZOS_JOB_STATEMENT.'
      logError(message)
      process.exit(1)
    }
  })

  it('Cannot resubmit job while it is running', () => {
    let job = new ZosJob({ jcl: Object.assign({}, jcl), ftpLogin, options })
    job.sub()
    return job.sub()
      .then(
        () => { throw new Error() },
        () => { }
      )
  })

  it('should end with JCL Error', () => {
    jcl.source = `${jobStatement} \n/  EXEC PGM=ICETOOL`
    ftpLogin.port = null
    options.encoding = null
    let job = new ZosJob({ jcl: Object.assign({}, jcl), ftpLogin, options })
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
    let job = new ZosJob({ jcl: Object.assign({}, jcl), ftpLogin, options })
    return job.sub()
      .then(
        () => { throw new Error('JCL passed instead of failing') },
        () => { job.RC.should.be.equal('Jcl Failed to Submit.') }
      )
  })

  it('Check string \\r\\n line ending', () => {
    options.encoding = 'ISO8859-7'
    options.loggingFunction = null
    options.watchJobInterval = null
    jcl.source =
      `${jobStatement}` + '\r\n' +
      '//******************************************' + '\r\n' +
      '//* Testing string \\r\\n line ending..' + '\r\n' +
      '// EXEC PGM=IEFBR14'
    let job = new ZosJob({ jcl: Object.assign({}, jcl), ftpLogin, options: Object.assign({}, options) })
    options.loggingFunction = debug(path.join(__dirname, 'output'))
    return job.sub()
  })
})

describe.only('Submitting Job from localFile', () => {
  let jcl = {
    name: 'BASIC',
    description: 'Basic Jcl',
    RC: '0000',
    source: path.resolve(__dirname, 'local.jcl') // Absolute path of local file ,has to be utf8 and \r\n
  }

  it('should end up with RC=0000', async () => {
    let job = new ZosJob({ jcl, ftpLogin, options })
    await job.sub()
    job.RC.should.be.equal('0000')
  })
})

describe('Submitting Job From hostFile', function () {
  let jcl = {
    name: 'TESTSUB',
    description: 'Check for host file existence.. ',
    RC: '0000',
    source: `${ftpLogin.user}.SOURCE.PDS(TESTSUB)`
  }

  it('should end up with RC=0000', async function () {
    options.deleteMainframeOutlist = true
    options.outlistLocalPath = null
    let job = new ZosJob({ jcl, ftpLogin, options })
    await job.sub()
    job.RC.should.be.equal('0000')
  })

  it('should fail if expected RC=0004', function (done) {
    options.deleteMainframeOutlist = true
    jcl.RC = '0004'
    let job = new ZosJob({ jcl, ftpLogin, options })
    job.sub().should.be.rejected.notify(done)
  })

  it('should not cancel job that is not running', function (done) {
    let job = new ZosJob({ jcl, ftpLogin, options })
    job.cancel().should.be.rejected.notify(done)
  })

  it('should cancel job that is running', function (done) {
    jcl.source = `${ftpLogin.user}.SOURCE.PDS(LINKDB2)` // long running function
    jcl.name = 'LOAUNL'
    let job = new ZosJob({ jcl, ftpLogin, options })
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
    let job = new ZosJob({ jcl, ftpLogin, options })
    job.sub().should.be.rejected.notify(done)
  })
})

describe.skip('Should succesfully resubmit a job', function () {
  it('Should succesfully resubmit a job', function (done) {

  })
})
