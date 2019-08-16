

# z/OS Utils

z/OS Utils for nodejs developers. 

Two main functions:

__1. ZosJob :__ Submit a Job and get a promise , that resolves to execution's outlist.

1. Create a job from a jcl (string/ local file / pds member) : ```let job = new ZosJob(jcl)``` .
2. Submit the Job with ```job.sub()``` and get back a Promise.
3. Watch job's running status by subscribing to 'status-change' event : ```job.on('status-change', newStatus => console.log(newStatus))``` .
4. Cancel job's execution at anytime , with ```job.cancel()```.


__2. ZosFtp :__ Ftp common operations.

1. Get/Put/Del a dataset or PDS member from/to mainframe, e.g. : ```ZosFtp.del('U001.ZOSUTILS.FILE')```


z/OS Utils takes advantage of the ability to [submit jobs to Mainframe via ftp](https://www.ibm.com/support/knowledgecenter/en/SSLTBW_2.1.0/com.ibm.zos.v2r1.halu001/intfjes.htm).

### Prerequisites

Minimum supported node version : v8.2.1

Your z/OS UserId should have ftp access.

## Getting Started
Install the package to your project:

```
npm i zos-utils --save 

or

yarn add zos-utils
```

In your code :
```javascript
const zosUtils = require('zos-utils')

// For a full list of config properties check the API section
let config = {
  user: 'ZOS_FTP_USERNAME',      // String: REQUIRED
  password: 'ZOS_FTP_PASSWD',    // String: REQUIRED
  host: 'ZOS_FTP_HOST',          // String: REQUIRED, host's IP address 
  port: 'ZOS_FTP_PORT',          // Number: OPTIONAL, defaults to 21.
  jobStatement: 'Minimal job card needed by your installation for a JCL to run' //String : REQUIRED for ZosFtp.put to work e.g. //U001T JOB (SYSS,U001,U001)
}

let { ZosJob, ZosFtp } = zosUtils(config)
```
Now you have available both ```ZosJob & ZosFtp ``` functions.

Try to submit a jcl that resides at mainframe , e.g. : ```'U001.ZOSUTILS.PDS(TESTJCL)'```

```javascript
let jcl = {
  name: 'TESTJCL',                      // String: REQUIRED, Assign a name to your job, used for logging and outlist save name
  description: 'Basic Jcl with RC=4',   // String: Optional
  source: 'U001.ZOSUTILS.PDS(TESTJCL)', // String: REQUIRED
  RC: '0000'                            // String: REQUIRED, Maximum expected return code
}

let job = new ZosJob(jcl)

job.sub(jcl)
  .then(outlist => {
    console.log(outlist)
    console.log('job.RC :',job.RC)

  })
  .catch(error => console.log(error))

```
## API



## Running the tests
Create a ```.env``` file at the root of the project and assign the following global variables:

```env
ZOS_FTP_USERNAME='my_user_id'
ZOS_FTP_PASSWD='my_password'
ZOS_FTP_HOST='host_ip_address'
ZOS_FTP_PORT='host_port'
ZOS_ENCODING='host_encoding'
ZOS_JOB_STATEMENT='//jobName JOB (SYSS,userId,userId)' # Minimal JOB statement needed by your installation for JCL to run 
```
Then issue the test command:

```
npm run test

or 

yarn test
```
## Authors

* **Christopher Chamaletsos** 

See also the list of [contributors](https://github.com/your/project/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
