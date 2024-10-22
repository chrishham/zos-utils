const ZosJobModule = require('./ZosJob')
const ZosFtpModule = require('./ZosFtp')

module.exports = config => {
  if (!config) throw new Error('You have to supply a config object.')
  config = Object.assign({}, config)
  if (!config.user || !config.password || !config.host) throw new Error('Config object is missing some properties.')
  config.port = config.port || 21
  config.encoding = config.encoding || 'UTF8'
  const ZosJob = ZosJobModule(config)
  const ZosFtp = ZosFtpModule(config)
  return { ZosJob, ZosFtp }
}
