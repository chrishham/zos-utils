

# z/OS Utils

z/OS Utils for NodeJS developers. 

This module exports two Objects:

__1. [ZosJob](###ZosJob) :__ Submit a Job and get a promise , that resolves to execution's outlist.

1. Create a job from a jcl (string/ local file / pds member) : ```let job = new ZosJob(jcl)``` .
2. Submit the Job with ```job.sub()``` and get back a Promise.
3. Watch job's running status by subscribing to ```'status-change'``` event : ```job.on('status-change', newStatus => console.log(newStatus))``` .
4. Cancel job's execution at anytime , with ```job.cancel()```.


__2. [ZosFtp](###ZosFtp) :__ Ftp common operations.

1. Get/Put/Del a dataset or PDS member from/to mainframe, e.g. : ```ZosFtp.del('U001.ZOSUTILS.FILE')```
2. List Directories , e.g. : ```ZosFtp.list('U001.ZOSUTILS.PDS')```


z/OS Utils takes advantage of the ability to [submit jobs to Mainframe via ftp](https://www.ibm.com/support/knowledgecenter/en/SSLTBW_2.1.0/com.ibm.zos.v2r1.halu001/intfjes.htm).

### Prerequisites

NodeJS version >= v8.2.1 .

Works with latest NodeJS releases (v12.4.0 passes all the tests).

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
const config = {
  user: 'ZOS_FTP_USERNAME',      // String: REQUIRED
  password: 'ZOS_FTP_PASSWD',    // String: REQUIRED
  host: 'ZOS_FTP_HOST',          // String: REQUIRED, host's IP address 
  port: 'ZOS_FTP_PORT'           // Number: OPTIONAL, defaults to 21.
}
const { ZosJob, ZosFtp } = zosUtils(config)
```
Now you have available both ```ZosJob & ZosFtp ``` Objects.

For a full list of config properties check the [API](##API) section.

Try to submit a jcl that resides at mainframe , e.g. : ```'U001.ZOSUTILS.PDS(TESTJCL)'```

```javascript
let jcl = {
  name: 'TESTJCL',                      // String: REQUIRED, Assign a name to your job, used for logging and outlist save name
  description: 'Basic Jcl with RC=0',   // String: Optional
  source: 'U001.ZOSUTILS.PDS(TESTJCL)', // String: REQUIRED
  RC: '0000'                            // String: REQUIRED, Maximum expected return code
}

let job = new ZosJob(jcl)
try {
  let outlist = await job.sub()
  console.log('job.RC :',job.RC)
} catch(error) {
  console.log(error)
}
```
## API
```Javascript 
const zosUtils = require('zos-utils')
const { ZosJob, ZosFtp } = zosUtils(config)
```
Initialise ZosJob and ZosFtp by providing the config object:
* ```config```<_object_>:
  * **user** <_string_>: **Required.** 
  * **password** <_string_>: **Required.**
  * **host** <_string_>: **Required.** IP address of the host. 
  * **port** <_number_>: _Optional_. **Default:** 21
  * **encoding** <_string_>: _Optional_. The encoding of the host, used by [iconv-lite](https://www.npmjs.com/package/iconv-lite) to encode-decode z/OS's outlists and datasets. Local JCL's and datasets **should always be in 'UTF8'** before submitting/uploading to host . **Default:** ```'UTF8'```
  * **watchJobInterval** <_number_>: _Optional_. Time interval (**ms**) used internally by ZosJob to watch Job's status during execution. If the host is not powerful enough , increase this number. **Default:** ```1000```
  * **deleteMainframeOutlist** <_boolean_>: _Optional_. Set this to ```true``` if you want  ZosJob to keep outlist at host, after job completion. **Default:** ```false```
  * **loggingFunction**<_function_>: _Optional_. Handle / store logs the way you want, instead of logging them at the terminal. For example you can use ```test/debug.js``` module , to write to a file of your choice. **Default:** ```console.log```

### ZosJob
```Javascript 
const zosUtils = require('zos-utils')
const { ZosJob } = zosUtils(config)
```
* Constructor : 
```javascript 
let job = new ZosJob(jcl)
```

* ```jcl```<_object_>:
  * **name** <_string_>: **Required.** Provide a name for your job. Used by ZosJob for logging and naming outlists. e.g. ```'TESTJCL'```
  * **description** <_string_>: _Optional_.A description of what the job is doing so that you can have all the information attached to the ```job``` object. e.g. ```'Testing ZosJob basic functionality.'```
  * **source** <_string_>: **Required.** This can be a path of a local file , a Javascript string or a host PDS member containing valid JCL code. Examples:
    * Local File:

      ``` 'C:\\local.jcl'``` 
    * Host PDS member:

      ``` 'U001.ZOSUTILS.PDS(TESTJCL)'``` 
    * Javascript String ( **include at least one newline ('\n') character** ):
      ```
      '//U001T JOB (BATI,U001,U001)\n' +
      '// EXEC PGM=IEFBR14'
      ```
  * **RC** <_string_>: **Required.** The maximum RC expected by the execution of the jcl. If the returned RC is greater than the string declared here, the ```job.sub()``` promise will be rejected. e.g. ```'0004'```

* ```ZosJob``` Methods
  * **sub**(): Submits the job to JES. Returned promise resolves to _outlist_ of the execution.
    ```Javascript
    try {
      let outlist = await job.sub()
      console.log('job.RC :',job.RC)
    } catch(error) {
      console.log(error)
    }  
    ```
  * **cancel**() : Cancel job submission. Returned promise resolves to _undefined_.
    ```Javascript
    try {
      await job.cancel()
    } catch(error) {
      console.log(error)
    }  
    ```
* ```ZosJob``` Events
  * **'status-change'**: Emitted whenever job's running status changes e.g. from ```INPUT``` to ```ACTIVE```. 
   ```Javascript
     job.on('status-change', newStatus => console.log(newStatus)) // 'ACTIVE'
   ```
  * **'status-change'**: Emitted when JES assigns ID to job e.g. 'JOB19788'
   ```Javascript
     job.on('job-id', jobId => console.log(jobId)) // 'JOB19788'
   ```
### ZosFtp
* ```ZosFtp``` Methods
  * **put** ( source <_string_>, hostFile <_string_>, options <_object_> ): Put the file or the Javascript String defined by ```source``` , to ```hostFile``` (it will be created if it doesnt exist.) . Returned promise resolves to _undefined_.
    ```Javascript
    // source can be a local file or a Javascript String
    try {
      await ZosFtp.put('C:\\local.txt','U001.ZOSUTILS.FILE',)
    } catch(error) {
      console.log(error)
    }  
    ```

## Running the tests
Create a ```.env``` file at the root of the project and assign the following global variables:

```env
ZOS_FTP_USERNAME='my_user_id'
ZOS_FTP_PASSWD='my_password'
ZOS_FTP_HOST='host_ip_address'
ZOS_FTP_PORT='host_port'
ZOS_ENCODING='host_encoding'
ZOS_JOB_STATEMENT='//jobName JOB (SYSS,userId,userId)' # Minimal JOB statement needed by your z/OS installation for JCL to run 
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
