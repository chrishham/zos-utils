const { promisify } = require('util')
const fs = require('fs-extra')
const PromiseFtp = require('promise-ftp')
const iconv = require('iconv-lite')
const ZosJobModule = require('./ZosJob')
const streamToBuffer = promisify(require('stream-to-buffer'))

module.exports = (config) => {
  const ZosJob = ZosJobModule(config)
  let ftpOptions = {
    host: config.host,
    port: config.port || 21,
    user: config.user,
    password: config.password
  }
  let encoding = config.encoding || 'UTF8'

  const put = (source, hostFile, options = {}) => {
    return new Promise(async (resolve, reject) => {
      let ftp = new PromiseFtp()
      try {
        let sourceType = /\n/.test(source) ? 'string' : 'localFile'
        let hostFileParenthesisIndex = hostFile.indexOf('(')
        let hostFileType = hostFileParenthesisIndex === -1 ? 'dataset' : 'pds'
        let hostFileWithoutUser = new RegExp(config.user).test(hostFile)
          ? hostFile.slice(config.user.length + 1)
          : hostFile

        if (hostFileType === 'dataset') {
          if (!options.cyl) {
            if (!options.lrecl) throw new Error('Lrecl is required when cyl is not provided.')
            let totalRows = sourceType === 'string'
              ? (source.match(/\n/g) || []).length + 1
              : await countFileLines(source) + 1
            options.cyl = Math.ceil(totalRows * options.lrecl / 839940) + 1
          }
          await allocateDataset(hostFile, options)
        }
        source = sourceType === 'string'
          ? iconv.encode(source, encoding)
          : fs.createReadStream(source)
            .pipe(iconv.decodeStream('utf8'))
            .pipe(iconv.encodeStream(encoding))

        await ftp.connect(ftpOptions)
        await ftp.ascii()
        await ftp.cwd('')
        try {
          await ftp.put(source, hostFileWithoutUser)
          resolve()
        } catch (e) {
          if (hostFileType !== 'pds') throw e
          await allocatePds(hostFile.slice(0, hostFileParenthesisIndex))
          await ftp.put(source, hostFileWithoutUser)
          resolve()
        }
      } catch (error) { reject(error) }
      try {
        await ftp.end()
      } catch (e) { }
    })
  }

  const get = (hostFile, target = 'jsString') => {
    return new Promise(async (resolve, reject) => {
      let ftp = new PromiseFtp()
      try {
        let hostFileWithoutUser = new RegExp(config.user).test(hostFile)
          ? hostFile.slice(config.user.length + 1)
          : hostFile
        await ftp.connect(ftpOptions)
        await ftp.ascii()
        await ftp.cwd('')
        let stream = await ftp.get(hostFileWithoutUser)
        if (target === 'jsString') {
          let buf = await streamToBuffer(stream)
          resolve(iconv.decode(buf, encoding))
        } else {
          await new Promise((resolve, reject) => {
            stream.once('close', resolve)
            stream.once('error', reject)
            stream.pipe(iconv.decodeStream(encoding))
              .pipe(fs.createWriteStream(target))
          })
          resolve()
        }
      } catch (error) { reject(error) }
      try {
        await ftp.end()
      } catch (e) { }
    })
  }

  const del = (hostFile, source) => {
    return new Promise(async (resolve, reject) => {
      let ftp = new PromiseFtp()
      try {
        let hostFileWithoutUser = new RegExp(config.user).test(hostFile)
          ? hostFile.slice(config.user.length + 1)
          : hostFile
        await ftp.connect(ftpOptions)
        await ftp.ascii()
        await ftp.cwd('')
        await ftp.delete(hostFileWithoutUser)
        resolve()
      } catch (error) {
        if (/does not exist/.test(error.message)) resolve()
        else reject(error)
      }
      try {
        await ftp.end()
      } catch (e) { }
    })
  }
  // helper functions
  const allocatePds = pdsName => {
    let jcl = {
      name: 'ALLOCPDS',
      description: 'Create the PDS if it doesn\'t exist.',
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
        `//             SPACE=(CYL,(500,1,1000),RLSE),\n` +
        `//             RECFM=FB,LRECL=80,BLKSIZE=27920\n` +
        `//             MGMTCLAS=MCTSO1,DATACLAS=DCWORK\n` +
        `// ENDIF\n`,
      RC: '0004'
    }
    let job = new ZosJob(jcl)
    return job.sub()
  }

  const allocateDataset = (datasetName, options = {}) => {
    let jcl = {
      name: 'ALLOCDSET',
      description: 'Create the DATASET.',
      source:
        `${config.jobStatement}\n` +
        `// EXEC PGM=IDCAMS\n` +
        `//SYSPRINT DD  SYSOUT=*,OUTLIM=50000\n` +
        `//SYSIN    DD  *\n` +
        ` DELETE (${datasetName})\n` +
        ` SET MAXCC=0\n` +
        `/*\n` +
        `// EXEC PGM=IEFBR14\n` +
        `//DD01     DD  DSN=${datasetName},\n` +
        `//             DISP=(NEW,CATLG,CATLG),\n` +
        `//             SPACE=(CYL,(${options.cyl || 10},0)),\n` +
        `//             RECFM=${options.recfm || 'FB'},LRECL=${options.lrecl || 1000}`,
      RC: '0000'
    }
    let job = new ZosJob(jcl)
    return job.sub()
  }

  return {
    put, get, del, allocatePds, allocateDataset
  }
}

function countFileLines (filePath) {
  return new Promise((resolve, reject) => {
    let lineCount = 0
    fs.createReadStream(filePath)
      .on('data', (buffer) => {
        let idx = -1
        lineCount-- // Because the loop will run once for idx=-1
        do {
          idx = buffer.indexOf(10, idx + 1)
          lineCount++
        } while (idx !== -1)
      }).on('end', () => {
        resolve(lineCount)
      }).on('error', reject)
  })
}
