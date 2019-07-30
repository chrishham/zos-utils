// const EventEmitter = require('events')
// const { promisify } = require('util')
// const path = require('path')
const fs = require('fs-extra')
const PromiseFtp = require('promise-ftp')
const iconv = require('iconv-lite')
const ZosJobModule = require('./ZosJob')
// const detectNewline = require('detect-newline')
// const streamToBuffer = promisify(require('stream-to-buffer'))

module.exports = (config) => {
  const ZosJob = ZosJobModule(config)
  let ftpOptions = {
    host: config.host,
    port: config.port || 21,
    user: config.user,
    password: config.password
  }
  let encoding = config.encoding || 'UTF8'

  const put = (localFile, hostFile) => {
    return new Promise(async (resolve, reject) => {
      let ftp = new PromiseFtp()
      try {
        let parenthesisIndex = hostFile.indexOf('(')
        let hostFileWithoutUser = new RegExp(config.user).test(hostFile) ?
          hostFile.slice(config.user.length + 1)
          : hostFile
        await ftp.connect(ftpOptions)
        await ftp.ascii()
        await ftp.cwd('')
        try {
          await ftp.put(localFile, hostFileWithoutUser)
          resolve()
        } catch (e) {
          if (parenthesisIndex === -1) throw e
          await allocatePds(hostFile.slice(0, parenthesisIndex))
          await ftp.put(localFile, hostFileWithoutUser)
          resolve()
        }
      } catch (error) { reject(error) }
      try {
        await ftp.end()
      } catch (e) { }
    })
  }

  const get = (hostFile, localFile) => {
    return new Promise(async (resolve, reject) => {
      try {
        let ftp = new PromiseFtp()
        await ftp.connect(ftpOptions)
        await ftp.ascii()
        await ftp.cwd('')
        let stream = await ftp.get(hostFile)
        await new Promise((resolve, reject) => {
          stream.once('close', resolve)
          stream.once('error', reject)
          stream.pipe(iconv.decodeStream(encoding))
            .pipe(fs.createWriteStream(localFile))
        })
        resolve()
      } catch (error) { reject(error) }
    })
  }
  // helper functions
  const allocatePds = pdsName => {
    let jcl = {
      name: 'BASIC',
      description: 'Basic Jcl',
      source:
        `${config.jobStatement}\n` +
        `//CHK10 EXEC PGM=IDCAMS\n` +
        `//SYSPRINT DD  SYSOUT=*\n` +
        `//SYSIN DD  * \n` +
        ` LISTCAT ENTRIES ('${pdsName}')\n` +
        `/*\n` +
        `// IF  (0004 EQ CHK10.RC) THEN\n` +
        `// EXEC PGM=IEFBR14\n` +
        `//SYSTSPRT DD SYSOUT=X\n` +
        `//SYSREC00 DD  DSN=${pdsName},\n` +
        `//             DISP=(NEW,CATLG),\n` +
        `//             UNIT=(SYSDA),SPACE=(CYL,(500,1,1000),RLSE),\n` +
        `//             DCB=(RECFM=FB,LRECL=80,BLKSIZE=27920),\n` +
        `//             MGMTCLAS=MCTSO1,DATACLAS=DCWORK\n` +
        `// ENDIF\n`,
      RC: '0004'
    }
    let job = new ZosJob(jcl)
    return job.sub()
  }

  return {
    put, get
  }
}
