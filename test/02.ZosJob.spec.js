const path = require('path')
const fs = require('fs-extra')
const zosUtils = require('../lib/index.js')
const basicJCL = `${jobStatement} \n// EXEC PGM=IEFBR14`

const { ZosJob } = zosUtils(config)

fs.writeFileSync(path.join(__dirname, 'local.jcl'), basicJCL.replace(/\n/g, '\r\n'))

describe('Submitting Job from string.', () => {
  let jcl = {
    name: 'BASIC',
    description: 'Basic Jcl',
    source: basicJCL,
    RC: '0000',
    outlistLocalPath
  }

  it('should end up with RC=0000', async () => {
    try {
      let job = new ZosJob(jcl)
      await job.sub()
      job.RC.should.be.equal('0000')
    } catch (error) {
      let message = error.message
      if (/PASS command failed/.test(message)) {
        message = `Failed to connect (User:${config.user} / Password : ${config.pwd}).`
      }
      logError(message)
      process.exit(1)
    }
  })

  it('Cannot resubmit job while it is running', () => {
    let job = new ZosJob(jcl)
    job.sub()
    return job.sub()
      .then(
        () => { throw new Error() },
        () => { }
      )
  })

  it('should end with JCL Error', () => {
    jcl.source = `${jobStatement} \n/  EXEC PGM=ICETOOL`
    let job = new ZosJob(jcl)
    return job.sub()
      .then(
        () => { throw new Error('JCL passed instead of failing') },
        () => { }
      )
  })

  it('JCL should fail to submit', () => {
    jcl.source =
      `
//JOB Destined to fail
//`
    let job = new ZosJob(jcl)
    return job.sub()
      .then(
        () => { throw new Error('JCL passed instead of failing') },
        () => { job.RC.should.be.equal('Jcl Failed to Submit.') }
      )
  })

  it('Check string \\r\\n line ending', () => {
    jcl.source =
      `${jobStatement}` + '\r\n' +
      '//******************************************' + '\r\n' +
      '//* Testing string \\r\\n line ending..' + '\r\n' +
      '// EXEC PGM=IEFBR14'
    let job = new ZosJob(jcl)
    return job.sub()
  })
})

describe('Submitting Job from localFile', () => {
  let jcl = {
    name: 'BASIC',
    description: 'Basic Jcl',
    RC: '0000',
    source: path.resolve(__dirname, 'local.jcl'), // Absolute path of local file ,has to be utf8 and \r\n
    outlistLocalPath
  }

  it('should end up with RC=0000', async () => {
    let job = new ZosJob(jcl)
    await job.sub()
    job.RC.should.be.equal('0000')
  })
})

describe('Submitting Job From hostFile', function () {
  let jcl = {
    name: 'BASIC',
    description: 'Check for host file existence.. ',
    RC: '0000',
    source: `${config.user}.ZOSUTILS.PDS(BASIC)`,
    outlistLocalPath
  }

  it('should end up with RC=0000', async function () {
    config.deleteMainframeOutlist = true
    config.outlistLocalPath = null
    let job = new ZosJob(jcl)
    await job.sub()
    job.RC.should.be.equal('0000')
  })

  it.skip('should fail if expected RC=0004', async function () {
    config.deleteMainframeOutlist = true
    jcl.RC = '0004'
    let job = new ZosJob(jcl)
    return job.sub()
      .then(
        () => { throw new Error('JCL passed instead of failing') },
        () => { }
      )
  })

  it('should not cancel job that is not running', async function () {
    let job = new ZosJob(jcl)
    return job.cancel()
      .then(
        () => { throw new Error('Cancel succeeded instead of failing') },
        () => { }
      )
  })

  it.skip('should cancel job that is running', function () {
    jcl.source = `${config.user}.ZOSUTILS.PDS(LINKDB2)` // long running function
    jcl.name = 'LOAUNL'
    let job = new ZosJob(jcl)
    job.sub().catch(() => { })
    // job.once('status-change', () => job.cancel().should.eventually.be.undefined.notify(done))
  })
})

describe.skip('Should reject invalid JCL source', function () {
  it('Should reject invalid JCL source', function (done) {
    let jcl = {
      name: 'LINKDB2',
      description: 'Check for host file existence.. ',
      RC: '0004',
      source: 'this is not a jcl',
      outlistLocalPath
    }
    let job = new ZosJob(jcl)
    job.sub().should.be.rejected.notify(done)
  })
})

describe.skip('Should succesfully resubmit a job', function () {
  it('Should succesfully resubmit a job', function (done) {

  })
})
