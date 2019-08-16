const path = require('path')
const fs = require('fs-extra')
const zosUtils = require('../lib/index.js')
const basicJCL = `${jobStatement} \n// EXEC PGM=IEFBR14`

const { ZosJob } = zosUtils(config)

fs.writeFileSync(path.join(__dirname, 'local.jcl'), basicJCL.replace(/\n/g, '\r\n'))

describe('SubJob: Submitting Job from string.', () => {
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
        message = `Failed to connect (User:${config.user} / Password : ${config.password}).`
      }
      logError(message)
      process.exit(1)
    }
  })

  it('should fail if expected RC=0000', async () => {
    let jclRc4 = {
      name: 'BASIC4',
      description: 'Basic Jcl with RC=4',
      source: `${jobStatement} \n// EXEC PGM=IDCAMS\n` +
        '//SYSPRINT DD  SYSOUT=*,OUTLIM=50000\n' +
        '//SYSIN    DD  *\n' +
        'SET MAXCC=4\n' +
        '/*',
      RC: '0000',
      outlistLocalPath
    }
    jcl.RC = '0000'
    let job = new ZosJob(jclRc4)
    return job.sub()
      .then(
        () => { throw new Error('JCL passed instead of failing') },
        () => { }
      )
  })

  it('should not resubmit job while it is running', () => {
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

  it('should submit from string with \\r\\n line ending', () => {
    jcl.source =
      `${jobStatement}` + '\r\n' +
      '//******************************************' + '\r\n' +
      '//* Testing string \\r\\n line ending..' + '\r\n' +
      '// EXEC PGM=IEFBR14'
    let job = new ZosJob(jcl)
    return job.sub()
  })

  it('should cancel job that is running', function (done) {
    jcl.source = `${jobStatement} \n// EXEC PGM=IKJEFT1B\n` +
      '//SYSEXEC   DD  UNIT=SYSALLDA,SPACE=(80,(5,1)),\n' +
      '//          DSN=&SYSEXEC,\n' +
      '//          AVGREC=K,DSNTYPE=LIBRARY,\n' +
      '//          RECFM=FB,LRECL=80,DSORG=PO\n' +
      '//SYSUT2    DD  DISP=(OLD,PASS),VOL=REF=*.SYSEXEC,\n' +
      '//          DSN=&SYSEXEC(REXXSAMP)\n' +
      '//SYSIN     DD  *\n' +
      '  /* REXX */\n' +
      'J = 1\n' +
      'DO WHILE(J <= 10)\n' +
      'END\n' +
      'EXIT\n' +
      '/*\n' +
      '//*\n' +
      '//SYSTSPRT  DD  SYSOUT=*\n' +
      '//SYSTSIN   DD  *\n' +
      ' REPRO INFILE(SYSIN) OUTFILE(SYSUT2)\n' +
      ' %REXXSAMP\n' +
      '//*'
    jcl.name = 'LOAUNL'
    let job = new ZosJob(jcl)
    job.sub().catch(() => { })
    job.on('status-change', status => {
      job.cancel()
        .then(() => done())
        .catch(error => done(error))
    })
  })
})

describe('SubJob: Submitting Job from localFile', () => {
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

describe('SubJob: Submitting Job From hostFile', () => {
  let jcl = {
    name: 'BASIC',
    description: 'Basic Jcl',
    RC: '0000',
    source: `${config.user}.ZOSUTILS.PDS(BASIC)`,
    outlistLocalPath
  }

  it('should end up with RC=0000', async () => {
    let job = new ZosJob(jcl)
    await job.sub()
    job.RC.should.be.equal('0000')
  })

  it('should not cancel job that is not running', () => {
    let job = new ZosJob(jcl)
    return job.cancel()
      .then(
        () => { throw new Error('Cancel succeeded instead of failing') },
        () => { }
      )
  })
})

describe('SubJob: Reject invalid JCL source', () => {
  it('should reject invalid JCL source', () => {
    let jcl = {
      name: 'NONJCL',
      description: 'Invalid Jcl',
      RC: '0004',
      source: `${jobStatement} \n//this is not a jcl \n`,
      outlistLocalPath
    }
    let job = new ZosJob(jcl)
    return job.sub()
      .then(
        () => { throw new Error('Cancel succeeded instead of failing') },
        () => { }
      )
  })
})

describe('SubJob: Delete mainframe outlist', () => {
  it('should delete mainframe outlist', () => {
    let configModified = Object.assign({}, config)
    configModified.deleteMainframeOutlist = true
    delete configModified.encoding
    delete configModified.watchJobInterval
    delete configModified.loggingFunction
    delete configModified.port
    let ZosJobModified = zosUtils(configModified).ZosJob
    let jcl = {
      name: 'BASIC',
      description: 'Basic Jcl',
      source: basicJCL,
      RC: '0000',
      outlistLocalPath
    }
    let job = new ZosJobModified(jcl)
    return job.sub()
  })
})
