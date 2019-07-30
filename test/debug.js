const fs = require('fs-extra')
const path = require('path')

module.exports = function (outlist) {
  const logger = fs.createWriteStream(path.resolve(outlist, 'log.txt'), {
    flags: 'a' // 'a' means appending (old data will be preserved)
  })

  async function debug (msg) {
    if (typeof msg === 'object') {
      msg = JSON.stringify(msg)
    }
    let date = new Date()
    let dateFrm = date.getFullYear() + '/' + ('0' + (date.getMonth() + 1)).slice(-2) + '/' +
      ('0' + date.getDate()).slice(-2) + ' ' + ('0' + date.getHours()).slice(-2) + ':' +
      ('0' + date.getMinutes()).slice(-2) + ':' + ('0' + date.getSeconds()).slice(-2)
    logger.write(`\r\n${dateFrm} : ${msg}`)
  }
  return debug
}
