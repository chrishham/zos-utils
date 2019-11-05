

# z/OS Utils

z/OS Utils for NodeJS developers. 

![npm](https://img.shields.io/npm/v/zos-utils)
![NPM](https://img.shields.io/npm/l/zos-utils)
![npm](https://img.shields.io/npm/dw/zos-utils)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

-----
This module exports two Objects:

__1. [ZosJob](#zosjob) :__ Submit a Job and get a promise , that resolves to execution's outlist.

1. Create a job from a jcl (string/ local file / pds member) : ```let job = new ZosJob(jcl)``` .
2. Submit the Job with ```job.sub()``` and get back a Promise.
3. Watch job's running status by subscribing to ```'status-change'``` event : ```job.on('status-change', newStatus => console.log(newStatus))``` .
4. Cancel job's execution at anytime , with ```job.cancel()```.


__2. [ZosFtp](#zosftp) :__ Ftp common operations.

1. Get/Put/Del a dataset or PDS member from/to mainframe, e.g. : ```ZosFtp.del('U001.ZOSUTILS.FILE')```
2. List Directories , e.g. : ```ZosFtp.list('U001.ZOSUTILS.PDS')```


z/OS Utils takes advantage of the ability to [submit jobs to Mainframe via ftp](https://www.ibm.com/support/knowledgecenter/en/SSLTBW_2.1.0/com.ibm.zos.v2r1.halu001/intfjes.htm).

----
### Prerequisites

NodeJS version >= **v8.2.1** .

**Supports both old and latest NodeJS releases** (v12.4.0 passes all the tests).

Your z/OS UserId should have ftp access.

-----

## Getting Started
Install the package to your project:

```
npm i zos-utils --save 

or

yarn add zos-utils
```

In your code :
```js
const zosUtils = require('zos-utils')
const config = {
  user: 'ZOS_FTP_USERNAME',      // String: REQUIRED
  password: 'ZOS_FTP_PASSWD',    // String: REQUIRED
  host: 'ZOS_FTP_HOST',          // String: REQUIRED, host's IP address 
  port: ZOS_FTP_PORT           // Number: OPTIONAL, defaults to 21.
}
const { ZosJob, ZosFtp } = zosUtils(config)
```
Now you have available both ```ZosJob & ZosFtp ``` Objects.

For a full list of config properties check the [API](#api) section.

Try to submit a jcl that resides at mainframe , e.g. : ```'U001.ZOSUTILS.PDS(TESTJCL)'```

```js
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
----
## API
```js 
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
  * **deleteMainframeOutlist** <_boolean_>: _Optional_. Set this to ```false``` if you want  ZosJob to keep outlist at host, after job completion. **Default:** ```true```
  * **loggingFunction**<_function_>: _Optional_. Handle / store logs the way you want, instead of logging them at the terminal. For example you can use ```test/debug.js``` module , to write to a file of your choice. **Default:** ```console.log```

### ZosJob
```js 
const zosUtils = require('zos-utils')
const { ZosJob } = zosUtils(config)
```
* Constructor : 
```js 
let job = new ZosJob(jcl)
```

* ```jcl```<_object_>:
  * **name** <_string_>: **Required.** Provide a name for your job. Used by ZosJob for logging and naming outlists. e.g. ```'TESTJCL'```
  * **description** <_string_>: _Optional_.A description of what the job is doing so that you can have all the information attached to the ```job``` object. e.g. ```'Testing ZosJob basic functionality.'```
  * **source** <_string_>: **Required.** This can be a path of a local file , a Javascript String or a host PDS member containing valid JCL code. Examples:
    * Local File:

      ``` 'C:\\local.jcl'``` 
    * Host PDS member:

      ``` 'U001.ZOSUTILS.PDS(TESTJCL)'``` 
    * Javascript String ( **has at least one newline ('\n') character** ):
      ```
      '//U001T JOB (BATI,U001,U001)\n' +
      '// EXEC PGM=IEFBR14'
      ```
  * **RC** <_string_>: **Required.** The maximum RC expected by the execution of the jcl. If the returned RC is greater than the string declared here, the ```job.sub()``` promise will be rejected. e.g. ```'0004'```
  * **outlistLocalPath**<_string_>: _Optional_. The local path where to store the outlist execution results. **Default:** ```null``` 

* ```ZosJob``` Methods
  * **sub**(): Submits the job to JES. Returned promise resolves to _outlist_ of the execution.
    ```js
    try {
      let outlist = await job.sub()
      console.log(outlist)
      console.log('job.RC :',job.RC)
    } catch(error) {
      console.log(error)
    }  
    ```
  * **cancel**() : Cancel job submission. Returned promise resolves to _undefined_.
    ```js
    try {
      await job.cancel()
    } catch(error) {
      console.log(error)
    }  
    ```
* ```ZosJob``` Events
  * **'status-change'**: Emitted whenever job's running status changes e.g. from ```INPUT``` to ```ACTIVE```. 
   ```js
     job.on('status-change', newStatus => console.log(newStatus)) // 'ACTIVE'
   ```
  * **'job-id'**: Emitted when JES assigns ID to job e.g. 'JOB19788'
   ```js
     job.on('job-id', jobId => console.log(jobId)) // 'JOB19788'
   ```
### ZosFtp
* ```ZosFtp``` Methods
  * **put** ( source <_string_>:**Required**, hostFile <_string_>:**Required**, options <_object_>:_Optional_): Put the local file or the Javascript String defined by ```source``` , to ```hostFile``` (it will be created if it doesn't exist). Returned promise resolves to _undefined_.
    * **options**
      * **sourceType**<_string_>: _Optional_. Can be either ```'localFile'``` or ```'string'```. **Default:** ```'localFile'``` 
      
         When one or more of the following keys is not provided,then the defaults from z/OS ```TCPIP.SEZAINST(FTPSDATA)``` server ftp configuration values will be applied. Keys are case insensitive, e.g. ```RECfm``` and ```recfm``` are both valid.
      * **recfm**<_string_>: _Optional_. ```'FB' || 'VB' || 'FBA'```
      * **lrecl**<_number_>: _Optional_. The length of 1 row of the  file.
      * **primary**<_number_>: _Optional_. The primary cyliders that will be allocated.
      * **directory**<_number_>: _Optional_. If provided then a PDS library will be created(if it doesn't already exist), with the directory blocks specified
    ```js
    try {
      // source can be a path to local file 
      await ZosFtp.put('C:\\local.txt','U001.ZOSUTILS.FILE')
      // or a Javascript String. Pass {sourceType: 'string'} in the options Object.
      await ZosFtp.put('I am going to host!','U001.ZOSUTILS.STRING',{ sourceType: 'string'})
      // supply allocation parameters
      await ZosFtp.put('C:\\local.txt','U001.ZOSUTILS.FILE2',{recfm : 'FB', lrecl:50, primary:30})
    } catch(error) {
      console.log(error)
    }  
    ```
  * **get** ( hostFile <_string_>:**Required**, localFile <_string_>:_Optional_): Download the ```hostFile```z/OS dataset or PDS member to a ```localFile``` path. If ```localFile``` is omitted ,  then the Promise will resolve with the contents of the host file as a Javascript String.

    ```js
    try {
      // download hostFile to localFile
      await ZosFtp.get('U001.ZOSUTILS.FILE','C:\\local3.txt')
      // get contents of hostFile as a Javascript String.
      const result = await ZosFtp.get('U001.ZOSUTILS.STRING')
      console.log(result) // 'I am going to host!'
    } catch(error) {
      console.log(error)
    }  
    ```
  * **del** ( hostFile <_string_>:**Required**): Delete the ```hostFile``` Dataset , PDS or PDS member.
    ```js
    try {
      await ZosFtp.del('U001.ZOSUTILS.FILE')
    } catch(error) {
      console.log(error)
    }  
    ```
  * **list** ( hostPath <_string_>:**Required**): List dataset or PDS members defined by the ```hostpath``` variable.
    ```js
      try {
        const result = await ZosFtp.list('U001.ZOSUTILS.PDS')
        console.log(result) 
        // Header fields may differ from installation to installation.
        // [
        // ' Name     VV.MM   Created       Changed      Size  Init   Mod  Id',
        //'STRING    01.04 2015/02/02 2015/02/02 14:25    27    15     0 U001    ',
        //'BASIC     01.03 2015/02/17 2015/02/20 14:55   180   180     0 U001    ',
        //'TEST      01.01 2016/09/28 2016/09/28 13:04   181   180     0 U001    ',
        //'TRIAL     01.00 2019/11/05 2019/11/05 11:44     2     2     0 U001    '
        // ]
      } catch(error) {
        console.log(error)
      }  
      ```
-----

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

------

## Authors

* **Christopher Chamaletsos** 

See also the list of [contributors](https://github.com/chrishham/zos-utils/graphs/contributors) who participated in this project.

------
## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
