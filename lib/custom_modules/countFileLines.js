const fs = require('fs-extra')

module.exports = filePath => {
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
