const path = require('path')
const zosUtils = require('../lib/index.js')
const { ZosFtp } = zosUtils(config)

describe('FTP:delete Host files', () => {
  it('should delete host file', async () => {
    return ZosFtp.del(`${config.user}.ZOSUTILS.FILE`)
  })

  it('should delete pds library', async () => {
    return ZosFtp.del(`${config.user}.ZOSUTILS.PDS`)
  })
})

describe('FTP: Put files to Host', () => {
  it('should put local file to PDS library', async () => {
    return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOSUTILS.PDS(BASIC)`)
  })

  it('should put local file to z/OS dataset', async () => {
    return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOSUTILS.FILE`, {
      recfm: 'FB',
      lrecl: 122
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

describe('FTP:get files from Host', () => {
  it('should get pds member to local dataset', async () => {
    return ZosFtp.get(`${config.user}.ZOSUTILS.PDS(BASIC)`, path.resolve(__dirname, 'output', 'BASIC.txt'))
  })
  it('should get host file to local dataset', async () => {
    return ZosFtp.get(`${config.user}.ZOSUTILS.FILE`, path.resolve(__dirname, 'output', 'ZOSUTILS.txt'))
  })
})
