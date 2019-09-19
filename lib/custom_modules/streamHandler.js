const fs = require('fs-extra')
const iconv = require('iconv-lite')

module.exports = (stream, encoding, target = 'jsString') => {
  return new Promise(function (resolve, reject) {
    let finalString = ''
    let writable = target === 'jsString'
      ? null
      : fs.createWriteStream(target)

    let timeoutResolve

    stream.resume()

    stream.on('data', chunk => {
      clearTimeout(timeoutResolve)
      let str = iconv.decode(chunk, encoding)
      if (target === 'jsString') finalString += str
      else writable.write(str)
      timeoutResolve = setTimeout(resolveFunction, 1500)
    })

    stream.on('end', resolveFunction)

    function resolveFunction () {
      stream.destroy()
      if (writable) writable.end()
      resolve(finalString)
    }
  })
}
