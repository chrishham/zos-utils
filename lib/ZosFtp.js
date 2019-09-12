const { promisify } = require('util')
const fs = require('fs-extra')
const PromiseFtp = require('promise-ftp')
const iconv = require('iconv-lite')
const streamToBuffer = promisify(require('stream-to-buffer'))

module.exports = (config) => {
  let ftpOptions = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  }
  let encoding = config.encoding

  const put = (source, hostFile, options = {}) => {
    return new Promise(async (resolve, reject) => {
      options = Object.assign({}, options)
      let ftp = new PromiseFtp()
      try {
        let sourceType = /\n/.test(source) ? 'string' : 'localFile'
        let hostFileParenthesisIndex = hostFile.indexOf('(')
        let hostFileType = hostFileParenthesisIndex === -1 ? 'dataset' : 'pds'
        let hostFileWithoutUser = new RegExp(config.user).test(hostFile)
          ? hostFile.slice(config.user.length + 1)
          : hostFile

        if (hostFileType === 'dataset') {
          if (!options.primary && options.lrecl) { // calculate the primary cylinders
            let totalRows = sourceType === 'string'
              ? (source.match(/\n/g) || []).length + 1
              : await countFileLines(source) + 1
            options.primary = Math.ceil(totalRows * options.lrecl / 839940) + 1
          }
        }
        source = sourceType === 'string'
          ? iconv.encode(source, encoding)
          : fs.createReadStream(source)
            .pipe(iconv.decodeStream('utf8'))
            .pipe(iconv.encodeStream(encoding))

        await ftp.connect(ftpOptions)
        await ftp.ascii()
        await ftp.cwd('')

        if (hostFileType === 'dataset') {
          await ftp.delete(hostFileWithoutUser)
            .catch(error => {
              if (!/does not exist/.test(error.message)) throw error
            })
        }

        let siteCommand = []
        for (let key in options) {
          if (options[key] === true) siteCommand.push(key.toUpperCase())
          else siteCommand.push(key.toUpperCase() + '=' + options[key])
        }
        siteCommand.push('CYLINDERS')
        siteCommand.push('BLOCKSIZE')
        siteCommand = siteCommand.join(' ')
        try {
          if (siteCommand.length > 0) await ftp.site(siteCommand)
          await ftp.put(source, hostFileWithoutUser)
          resolve()
        } catch (e) {
          if (hostFileType === 'pds' && /nonexistent partitioned data set/.test(e.message)) {
            await ftp.mkdir(hostFileWithoutUser.slice(0, hostFileParenthesisIndex - config.user.length - 1))
            await ftp.put(source, hostFileWithoutUser)
            resolve()
          } else throw e
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
          stream.resume()
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

  const del = hostFile => {
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

  return {
    put, get, del
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
