const path = require('path')
const { ZosJob } = require('../lib/index.js')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

// const debug = require('./debug')
chai.use(chaiAsPromised)
// const expect = chai.expect
let ftpLogin = {
  user: process.env.ZOS_FTP_USERNAME, // String: REQUIRED
  pwd: process.env.ZOS_FTP_PASSWD, // String: REQUIRED
  host: process.env.ZOS_FTP_HOST, // String: REQUIRED
  port: process.env.ZOS_FTP_PORT, // Number: OPTIONAL, defaults to 21.
  encoding: 'ISO8859-7' // String: OPTIONAL, defaults to 'UTF8'
  // loggingFunction: debug('./')
}
let filename = 'APROV.DATA'

let jcl = {
  name: 'ISEMPTY',
  description: 'Έλεγχος για την ύπαρξη του αρχείου. ',
  type:
    // 'string',
    'localFile',
  // 'hostFile',
  string:
    `
//${ftpLogin.user}E JOB (SYSS,${ftpLogin.user},${ftpLogin.user}),CLASS=T,MSGCLASS=X,TIME=1440,
//           MSGLEVEL=(1,1),REGION=0M,SYSTEM=SYA
//******************************************
//* Έλεγχος για την ύπαρξη του αρχείου.
//  EXEC PGM=ICETOOL                        
//TOOLMSG DD SYSOUT=X                    
//DFSMSG DD SYSOUT=X                  
//INDD DD DSN=${ftpLogin.user}.${filename},DISP=SHR   
//TOOLIN DD *                          
COUNT FROM(INDD) EMPTY                 
/*`,
  localFile: path.join(__dirname, 'local.jcl'), // has to be utf8 and \r\n
  hostFile: 'U764.SOURCE.PDS(LINKDB2)',
  watchJobInterval: 2000,
  outlistLocalPath: './outlist.txt',
  deleteMainframeOutlist: false // default= true
}

let job = new ZosJob({ ftpLogin, jcl })

job.sub()
  .then(() => {
    console.log('Job Finished!')
  })
  .catch(error => console.log(error))

job.on('status-change', (newStatus) => console.log(newStatus))

setTimeout(() => job.cancel()
  .then(() => console.log('Job Canceled'))
  .catch(error => console.log(error.message)), 5000)
