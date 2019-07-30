const ZosJobModule = require('./ZosJob')
const ZosFtpModule = require('./ZosFtp')

module.exports = (config) => {
  if (!config) throw new Error('You have to supply a config object.')
  config = Object.assign({}, config)
  if (!config.user || !config.password || !config.host) throw new Error('Config object is missing some properties.')
  const ZosJob = ZosJobModule(config)
  const ZosFtp = ZosFtpModule(config)
  return { ZosJob, ZosFtp }
}
