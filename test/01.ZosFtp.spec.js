const path = require('path')
const fs = require('fs-extra')
const zosUtils = require('../lib/index.js')
const { ZosFtp } = zosUtils(config)

describe.only('put files to Host', () => {
  it('should put local file to dataset', async () => {
    return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOSUTILS.PDS(TEST)`)
  })

  it('should put local file to pds library', async () => {
    return ZosFtp.put(path.resolve(__dirname, 'local.jcl'), `${config.user}.ZOSUTILS.FILE`, {
      recfm: 'FB',
      lrecl: 122
    })
  })

  it('should put string to local File', async () => {
    let sampleText = 'I need to have at list 1 newline character κατάλαβες? \r\n'
    for (let i = 0; i < 22; i++) { sampleText += sampleText }
    fs.writeFileSync(path.join(__dirname, 'local.txt'), sampleText)
    return ZosFtp.put(sampleText, `${config.user}.ZOSUTILS.STRING`, {
      recfm: 'FB',
      lrecl: 50
    })
  })
})

describe('get files from Host', () => {
  it('should get pds member to local dataset', async () => {
    return ZosFtp.get(`${config.user}.ZOSUTILS.PDS(PA47X)`, path.resolve(__dirname, 'pa47x.txt'))
  })
  it('should get host file to local dataset', async () => {
    return ZosFtp.get(`${config.user}.ZOSUTILS.FILE`, path.resolve(__dirname, 'ZOSUTILS.txt'))
  })

  it('should delete host file', async () => {
    return ZosFtp.del(`${config.user}.ZOSUTILS.FILE`)
  })

  it('should delete pds library', async () => {
    return ZosFtp.del(`${config.user}.ZOSUTILS.PDS`)
  })
})
