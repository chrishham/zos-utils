const EventEmitter = require('events')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs-extra')
const PromiseFtp = require('promise-ftp')
const iconv = require('iconv-lite')
const detectNewline = require('detect-newline')
const streamToBuffer = promisify(require('stream-to-buffer'))

class ZosJob extends EventEmitter {
  constructor ({ ftpLogin, jcl, options }) {
    super()
    this.status = null
    this.RC = null
    this.outlist = null
    this.id = null
    this.ftp = null

    this.jcl = jcl

    this.encoding = options.encoding || 'UTF8'
    this.watchJobInterval = (options && options.watchJobInterval) || 3000
    this.outlistLocalPath = (options && options.outlistLocalPath) || null
    this.deleteMainframeOutlist = (options && options.deleteMainframeOutlist) || false
    this.loggingFunction = options.loggingFunction || console.log

    this.ftpOptions = {
      host: ftpLogin.host,
      port: ftpLogin.port || 21,
      user: ftpLogin.user,
      password: ftpLogin.pwd
    }
  }

  sub () {
    return new Promise(async (resolve, reject) => {
      if (this.ftp) return reject(new Error(`${this.jcl.name}: Cannot resubmit while Job is Running.`))
      this.status = null
      this.RC = null
      this.outlist = null
      this.id = null
      this.ftp = new PromiseFtp()
      this.ftpOptions.debug = (data) => ftpDebug(data, this, resolve, reject)
      let ftp = this.ftp
      let loggingFunction = this.loggingFunction
      try {
        let greetingMessage = await ftp.connect(this.ftpOptions)
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

async function ftpList (instance, subResolve, subReject) {
  let ftp = instance.ftp
  let loggingFunction = instance.loggingFunction
  try {
    let res = await ftp.list(instance.id)
    let status = res[1].slice(27, 33)

    if (status !== instance.status) {
      instance.status = status
      instance.emit('status-change', status)
    }

    loggingFunction(`${instance.id}: status = ${status}`)
    if (status !== 'OUTPUT') return setTimeout(() => ftpList(instance, subResolve, subReject), instance.watchJobInterval)
    let RC = null
    if (/JCL error/.test(res[1])) loggingFunction(`${instance.id} : JCL error`)
    else {
      RC = res[1].slice(46, 50)
      instance.RC = RC
      loggingFunction(`${instance.id}: ended with Return Code = ${RC}`)
    }
    let stream = await ftp.get(instance.id + '.x')
    const chunks = []
    let outlist = await new Promise((resolve, reject) => {
      stream.resume()
      stream.once('end', () => {
        let result = iconv.decode(Buffer.concat(chunks), instance.encoding)
        resolve(result)
      })
      stream.once('error', reject)
      stream.on('data', chunk => chunks.push(chunk))
    })
    instance.outlist = outlist
    if (instance.outlistLocalPath) {
      await fs.writeFile(path.join(instance.outlistLocalPath, `${instance.id}_${instance.jcl.name}_outlist.txt`), outlist)
      loggingFunction(`${instance.id}: outlist downloaded successfully.`)
    }
    if (instance.deleteMainframeOutlist) {
      await ftp.delete(instance.id)
      loggingFunction(`${instance.id}: outlist deleted on Z/OS`)
    }
    if (RC > instance.jcl.RC) throw new Error(`Execution RC(${RC}) > Expected RC(${instance.jcl.RC})`)
    subResolve({ outlist, RC })
  } catch (err) {
    subReject(err)
  }
  try {
    await ftp.end()
    loggingFunction(`${instance.id}: ftp exiting .... ok!`)
  } catch (e) { }
  instance.ftp = null
  instance.id = null
  instance.status = null
}

async function ftpDebug (data, instance, subResolve, subReject) {
  if (instance.id != null) return
  if (/250-It is known to JES/.test(data)) {
    let jobFound = data.indexOf('JOB')
    if (jobFound === -1) {
      await instance.ftp.end()
      instance.loggingFunction(`Ftp exiting .... ok!`)
      instance.ftp = null
      return subReject(new Error('Jcl Failed to Submit.'))
    }
    instance.id = data.slice(jobFound, jobFound + 8)
    setTimeout(() => ftpList(instance, subResolve, subReject), instance.watchJobInterval)
  }
}

module.exports = ZosJob
