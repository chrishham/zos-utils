const EventEmitter = require('events')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs-extra')
const PromiseFtp = require('promise-ftp')
const iconv = require('iconv-lite')
const detectNewline = require('detect-newline')
const streamToBuffer = promisify(require('stream-to-buffer'))

module.exports = (config) => {
  class ZosJob extends EventEmitter {
    constructor (jcl) {
      super()
      this.jcl = Object.assign({}, jcl)
      this.ftp = null
      this.status = null
      this.RC = null
      this.outlist = null
      this.id = null
      this.encoding = config.encoding || 'UTF8'
      this.watchJobInterval = config.watchJobInterval || 3000
      this.deleteMainframeOutlist = config.deleteMainframeOutlist || false
      this.loggingFunction = config.loggingFunction || console.log
    }

    sub () {
      return new Promise(async (resolve, reject) => {
        if (this.ftp) return reject(new Error(`${this.jcl.name}: Cannot resubmit while Job is Running.`))
        this.status = null
        this.RC = null
        this.outlist = null
        this.id = null
        let ftp = new PromiseFtp()
        let ftpOptions = {
          host: config.host,
          port: config.port || 21,
          user: config.user,
          password: config.password,
          debug: (data) => ftpDebug(data, this, resolve, reject)
        }
        this.ftp = ftp
        let loggingFunction = this.loggingFunction
        try {
          let greetingMessage = await ftp.connect(ftpOptions)
          loggingFunction(greetingMessage)
          await ftp.ascii()
          loggingFunction('Transfer type changing to Ascii .... completed')
          let jclToSubmit = null
          // Decide the Jcl Source Type
          let jclType = null
          if (/\n/.test(this.jcl.source)) jclType = 'string'
          else if (/\/|\\/.test(this.jcl.source)) jclType = 'localFile'
          else jclType = 'hostFile'
          switch (jclType) {
            case 'string':
              if (detectNewline(this.jcl.source) === '\n') {
                jclToSubmit = this.jcl.source.replace(/\n/g, '\r\n')
              } else jclToSubmit = this.jcl.source
              jclToSubmit = iconv.encode(jclToSubmit, this.encoding)
              break
            case 'localFile':
              jclToSubmit =
                fs.createReadStream(this.jcl.source)
                  .pipe(iconv.decodeStream('utf8'))
                  .pipe(iconv.encodeStream(this.encoding))
              break
            case 'hostFile':
              await this.ftp.cwd('..')
              loggingFunction('Cwd one directory up ... completed')
              let result = await this.ftp.get(this.jcl.source)
              result.resume()
              jclToSubmit = await streamToBuffer(result)
              loggingFunction(`Download ${this.jcl.source} ... completed`)
              break
          }
          await ftp.site('filetype=jes')
          loggingFunction('Transfer mode changing to Jes .... completed')
          await ftp.put(jclToSubmit, this.jcl.name)
          loggingFunction(`${this.jcl.name}:  submitted successfully!`)
        } catch (error) {
          await ftp.end()
          this.ftp = null
          reject(error)
        }
      })
    }

    cancel () {
      return new Promise(async (resolve, reject) => {
        this.loggingFunction(`${this.jcl.name}: Trying to cancel Job ...`)
        try {
          if (!this.status) throw new Error(`${this.jcl.name}: Cannot cancel => Job is not running.`)
          await this.ftp.delete(this.id)
          this.loggingFunction(`${this.id}: Cancel successful!`)
          await this.ftp.end()
          this.status = null
          this.RC = null
          this.outlist = null
          this.id = null
          this.ftp = null
          resolve()
        } catch (error) {
          this.loggingFunction(`${this.jcl.name}: Cancel failed!`)
          reject(error)
        }
      })
    }
  } // class MainframeJob End

  return ZosJob
}

async function ftpList (self, subResolve, subReject) {
  let ftp = self.ftp
  let loggingFunction = self.loggingFunction
  try {
    let res = await ftp.list(self.id)
    let status = res[1].slice(27, 33)

    if (status !== self.status) {
      self.status = status
      self.emit('status-change', status)
    }

    loggingFunction(`${self.id}: status = ${status}`)
    if (status !== 'OUTPUT') return setTimeout(() => ftpList(self, subResolve, subReject), self.watchJobInterval)
    let RC = null
    if (/JCL error/i.test(res[1])) RC = 'JCL Error'
    else RC = res[1].slice(46, 50)

    self.RC = RC
    loggingFunction(`${self.id}: ended with Return Code = ${RC}`)

    let stream = await ftp.get(self.id + '.x')
    const chunks = []
    let outlist = await new Promise((resolve, reject) => {
      stream.resume()
      stream.once('end', () => {
        let result = iconv.decode(Buffer.concat(chunks), self.encoding)
        resolve(result)
      })
      stream.once('error', reject)
      stream.on('data', chunk => chunks.push(chunk))
    })
    self.outlist = outlist
    if (self.jcl.outlistLocalPath) {
      await fs.outputFile(path.join(self.jcl.outlistLocalPath, `${self.id}_${self.jcl.name}_outlist.txt`), outlist)
      loggingFunction(`${self.id}: outlist downloaded successfully.`)
    }
    if (self.deleteMainframeOutlist) {
      await ftp.delete(self.id)
      loggingFunction(`${self.id}: outlist deleted on Z/OS`)
    }
    if (RC === 'JCL Error') throw new Error('JCL Error')
    if (RC > self.jcl.RC) throw new Error(`Execution RC(${RC}) > Expected RC(${self.jcl.RC})`)
    subResolve({ outlist, RC })
  } catch (err) {
    subReject(err)
  }
  try {
    await ftp.end()
    loggingFunction(`${self.id}: ftp exiting .... ok!`)
  } catch (e) { }
  self.ftp = null
  self.id = null
  self.status = null
}

async function ftpDebug (data, self, subResolve, subReject) {
  if (self.id != null) return
  if (/250-It is known to JES/.test(data)) {
    let jobFound = data.indexOf('JOB')
    if (jobFound === -1) {
      await self.ftp.end()
      self.loggingFunction(`Ftp exiting .... ok!`)
      self.ftp = null
      self.RC = 'Jcl Failed to Submit.'
      return subReject(new Error('Jcl Failed to Submit.'))
    }
    self.id = data.slice(jobFound, jobFound + 8)
    setTimeout(() => ftpList(self, subResolve, subReject), self.watchJobInterval)
  }
}
