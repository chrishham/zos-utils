const fs = require('fs-extra')
const PromiseFtp = require('promise-ftp')
const iconv = require('iconv-lite')
const streamHandler = require('./custom_modules/streamHandler.js')
const countFileLines = require('./custom_modules/countFileLines.js')

module.exports = (config) => {
  let ftpOptions = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  }
  let encoding = config.encoding

  const put = (source, hostFile, options = { sourceType: 'localFile' }) => {
    return new Promise(async (resolve, reject) => {
      options = Object.assign({}, options)
      let ftp = new PromiseFtp()
      try {
        let hostFileParenthesisIndex = hostFile.indexOf('(')
        let hostFileType = hostFileParenthesisIndex === -1 ? 'dataset' : 'pds'

        if (hostFileType === 'dataset') {
          if (!options.primary && options.lrecl) { // calculate the primary cylinders
            let totalRows = options.sourceType === 'string'
              ? source.match(/\n/g).length + 1
              : await countFileLines(source) + 1
            options.primary = Math.ceil(totalRows * options.lrecl / 839940) + 1
          }
        }
        source = options.sourceType === 'string'
          ? iconv.encode(source, encoding)
          : fs.createReadStream(source)
            .pipe(iconv.decodeStream('utf8'))
            .pipe(iconv.encodeStream(encoding))

        await ftp.connect(ftpOptions)
        await ftp.ascii()
        await ftp.cwd("''")

        if (hostFileType === 'dataset') {
          await ftp.delete(hostFile)
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
          await ftp.site(siteCommand)
          await ftp.put(source, hostFile)
          resolve()
        } catch (e) {
          console.log('hostFileType:', hostFileType)
          if (hostFileType === 'pds' && /nonexistent partitioned data set/.test(e.message)) {
            await ftp.mkdir(hostFile.slice(0, hostFileParenthesisIndex))
            await ftp.put(source, hostFile)
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
        await ftp.connect(ftpOptions)
        await ftp.ascii()
        await ftp.cwd("''")

        let stream = await ftp.get(hostFile)
        let finalString = await streamHandler(stream, encoding, target)
        resolve(finalString)
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
        await ftp.connect(ftpOptions)
        await ftp.ascii()
        await ftp.cwd("''")
        await ftp.delete(hostFile)
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

  const list = path => {
    return new Promise(async (resolve, reject) => {
      let ftp = new PromiseFtp()
      try {
        await ftp.connect(ftpOptions)
        await ftp.ascii()
        await ftp.cwd("''")
        await ftp.cwd(path)
        let result = await ftp.list()
        resolve(result)
      } catch (error) {
        reject(error)
      }
      try {
        await ftp.end()
      } catch (e) { }
    })
  }

  return {
    put, get, del, list
  }
}
