const path = require('path')
const fs = require('fs-extra')
const { ZosJob } = require('../lib/index.js')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const debug = require('./debug')
chai.use(chaiAsPromised)
chai.should()

let ftpLogin = {
  user: process.env.ZOS_FTP_USERNAME, // String: REQUIRED
  pwd: process.env.ZOS_FTP_PASSWD, // String: REQUIRED
  host: process.env.ZOS_FTP_HOST, // String: REQUIRED
  port: process.env.ZOS_FTP_PORT // Number: OPTIONAL, defaults to 21.
}

let options = {
  encoding: 'ISO8859-7', // String: OPTIONAL, defaults to 'UTF8'
  watchJobInterval: 1000,
  outlistLocalPath: path.join(__dirname, 'output'),
  deleteMainframeOutlist: false // default= true
}

before(function (done) {
  return fs.remove(options.outlistLocalPath)
    .then(() => fs.mkdirp(options.outlistLocalPath))
    .then(() => {
      options.loggingFunction = debug(path.join(__dirname, 'output'))
    }).should.be.ok.notify(done)
})

describe('Submitting Job From string', function () {
  let jcl = {
    name: 'ISEMPTY',
    description: 'Έλεγχος για την ύπαρξη του αρχείου. ',
    source:
      `
//${ftpLogin.user}E JOB (SYSS,${ftpLogin.user},${ftpLogin.user})
//******************************************
//* Έλεγχος για την ύπαρξη του αρχείου.
//  EXEC PGM=ICETOOL                        
//TOOLMSG DD SYSOUT=X                    
//DFSMSG DD SYSOUT=X                  
//INDD DD DSN=${ftpLogin.user}.APROV.DATA,DISP=SHR 
//TOOLIN DD *                          
COUNT FROM(INDD) EMPTY                 
/*`,
    RC: '0000'
  }
  it('should end up with RC=0000', async function () {
    let job = new ZosJob({ jcl, ftpLogin, options })
    await job.sub()
    job.RC.should.be.equal('0000')
  })
  it('Cannot resubmit job while it is running', function (done) {
    let job = new ZosJob({ jcl, ftpLogin, options })
    job.sub().then(() => { })
    job.sub().should.be.rejected.notify(done)
  })
  it('should end with JCL Error', function (done) {
    jcl.source =
      `
//${ftpLogin.user}E JOB (SYSS,${ftpLogin.user},${ftpLogin.user})
//******************************************
//* Έλεγχος για την ύπαρξη του αρχείου.
/  EXEC PGM=ICETOOL                        
//TOOLMSG DD SYSOUT=X                    
//DFSMSG DD SYSOUT=X                  
//INDD DD DSN=${ftpLogin.user}.APROV.DATA,DISP=SHR 
//TOOLIN DD *                          
COUNT FROM(INDD) EMPTY                 
/*`
    ftpLogin.port = null
    options.encoding = null
    let job = new ZosJob({ jcl, ftpLogin, options })
    job.sub().should.eventually.be.ok.notify(done)
  })
  it('JCL should fail to submit', async function () {
    jcl.source =
      `
//JOB Destined to fail
//`
    let job = new ZosJob({ jcl, ftpLogin, options })
    try {
      await job.sub()
    } catch (error) {
      error.message.should.be.equal('Jcl Failed to Submit.')
    }
  })
  it('Check string \r\n line ending', function (done) {
    options.encoding = 'ISO8859-7'
    options.loggingFunction = null
    options.watchJobInterval = null
    jcl.source =
      `//${ftpLogin.user}E JOB (SYSS,${ftpLogin.user},${ftpLogin.user})` + '\r\n' +
      '//******************************************' + '\r\n' +
      '//* Έλεγχος για την ύπαρξη του αρχείου.' + '\r\n' +
      '//  EXEC PGM=ICETOOL' + '\r\n' +
      '//TOOLMSG DD SYSOUT=X' + '\r\n' +
      '//DFSMSG DD SYSOUT=X' + '\r\n' +
      `//INDD DD DSN=${ftpLogin.user}.APROV.DATA,DISP=SHR` + '\r\n' +
      '//TOOLIN DD *' + '\r\n' +
      'COUNT FROM(INDD) EMPTY' + '\r\n' +
      '/*'
    let job = new ZosJob({ jcl, ftpLogin, options })
    job.sub().should.eventually.be.ok.notify(done)
    options.loggingFunction = debug('./')
  })
})

describe('Submitting Job From localFile', function () {
  let jcl = {
    name: 'FREEZE',
    description: 'Έλεγχος για την ύπαρξη του αρχείου. ',
    RC: '0004',
    source: path.resolve(__dirname, 'local.jcl') // Absolute path of local file ,has to be utf8 and \r\n
  }
  it('should end up with RC=0004', async function () {
    let job = new ZosJob({ jcl, ftpLogin, options })
    await job.sub()
    job.RC.should.be.equal('0004')
  })
})

describe('Submitting Job From hostFile', function () {
  let jcl = {
    name: 'TESTSUB',
    description: 'Έλεγχος για την ύπαρξη του αρχείου. ',
    RC: '0004',
    source: 'U764.SOURCE.PDS(TESTSUB)'
  }
  it('should end up with RC=0004', async function () {
    options.deleteMainframeOutlist = true
    options.outlistLocalPath = null
    let job = new ZosJob({ jcl, ftpLogin, options })
    await job.sub()
    job.RC.should.be.equal('0004')
  })
  it('should fail if expected RC=0000', function (done) {
    options.deleteMainframeOutlist = true
    jcl.RC = '0000'
    let job = new ZosJob({ jcl, ftpLogin, options })
    job.sub().should.be.rejected.notify(done)
  })
  it('should not cancel job that is not running', function (done) {
    let job = new ZosJob({ jcl, ftpLogin, options })
    job.cancel().should.be.rejected.notify(done)
  })
  it('should cancel job that is running', function (done) {
    jcl.source = 'U764.SOURCE.PDS(LINKDB2)' // long running function
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
      description: 'Έλεγχος για την ύπαρξη του αρχείου. ',
      RC: '0004',
      source: 'this is not a jcl'
    }
    let job = new ZosJob({ jcl, ftpLogin, options })
    job.sub().should.be.rejected.notify(done)
  })
})
