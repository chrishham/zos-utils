const path = require('path')
const zosUtils = require('../lib/index.js')
const { ZosFtp } = zosUtils(config)
const fs = require('fs-extra')

if (!fs.existsSync(path.join(__dirname, 'bigFile.txt'))) {
  let string = 'This is a really big file!\r\n'
  for (let i = 0; i < 20; i++) {
    string += string
  }
  fs.writeFileSync(path.join(__dirname, 'bigFile.txt'), string)
}
describe('ZosFtp Test Suite', () => {
  describe('FTP: Delete Host files', () => {
    it('should delete host file', async () => {
      try {
        await ZosFtp.del(`${config.user}.ZOSUTILS.FILE`)
        await ZosFtp.del(`${config.user}.ZOSUTILS.BIGFILE`)
        await ZosFtp.del(`${config.user}.ZOSUTILS.STRING`)
      } catch (error) {
        let message = error.message
        if (/PASS command failed/.test(message)) {
          message = `Failed to connect (User:${config.user} / Password : ${config.password}).`
        }
        logError(message)
        process.exit(1)
      }
    })

    it('should delete pds library', async () => {
      return ZosFtp.del(`${config.user}.ZOSUTILS.PDS`)
    })
  })

  describe('FTP: Put files to Host', () => {
    it('should put local file to PDS library', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOSUTILS.PDS(BASIC)`, {
        recfm: 'FB',
        lrecl: 80,
        directory: 50,
        primary: 125
      })
    })

    it('should put local file to z/OS dataset', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOSUTILS.FILE`, {
        recfm: 'FB',
        lrecl: 300
      })
    })

    it('should put big local file to z/OS dataset', async () => {
      return ZosFtp.put(path.resolve(__dirname, 'bigFile.txt'), `${config.user}.ZOSUTILS.BIGFILE`, {
        recfm: 'FB',
        lrecl: 300
      })
    })

    it('should put string to to z/OS dataset', async () => {
      let sampleText = 'I need to have at list 1 newline character \r\n'
      for (let i = 0; i < 5; i++) { sampleText += sampleText }
      return ZosFtp.put(sampleText, `${config.user}.ZOSUTILS.STRING`, {
        recfm: 'FB',
        lrecl: 50
      })
    })
  })

  describe('FTP: Get files from Host', () => {
    it('should get pds member to local dataset', async () => {
      return ZosFtp.get(`${config.user}.ZOSUTILS.PDS(BASIC)`, path.resolve(__dirname, 'output', 'BASIC.txt'))
    })
    it('should get host file to local dataset', async () => {
      return ZosFtp.get(`${config.user}.ZOSUTILS.FILE`, path.resolve(__dirname, 'output', 'ZOSUTILS.txt'))
    })
    it('should get host file to javascript string', async () => {
      return ZosFtp.get(`${config.user}.ZOSUTILS.FILE`)
        .then(result => result.should.be.string)
    })
  })
})
