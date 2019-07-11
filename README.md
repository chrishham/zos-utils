

# z/OS Utils

z/OS Utils for nodejs developers.

Features:

* Submit a Job and and get a Promise that resolves to execution outlist.
* Get/Put a dataset or PDS member from/to mainframe.

z/OS Utils takes advantage of the ability to [submit jobs to Mainframe via ftp](https://www.ibm.com/support/knowledgecenter/en/SSLTBW_2.1.0/com.ibm.zos.v2r1.halu001/intfjes.htm).

### Prerequisites

Minimum supported node version : v8.2.1

Your z/OS UserId should have ftp access enabled by your Sys Admins.

## Getting Started

```
npm i zos-utils
```

In your code :
```

```

### Installing

A step by step series of examples that tell you how to get a development env running

Say what the step will be

```
Give the example
```

And repeat

```
until finished
```

End with an example of getting some data out of the system or using it for a little demo

## Running the tests
Create a ```.env``` file at the root of the project and assign the following global variables:

```
ZOS_FTP_USERNAME= ...
ZOS_FTP_PASSWD=...
ZOS_FTP_HOST=....
ZOS_FTP_PORT=...
ZOS_JOB_STATEMENT=... - The minimal JOB statement needed by your installation to run
```

### Break down into end to end tests

Explain what these tests test and why

```
Give an example
```

## Contributing

Please read [CONTRIBUTING.md](https://gist.github.com/PurpleBooth/b24679402957c63ec426) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/your/project/tags). 

## Authors

* **Christopher Chamaletsos** 

See also the list of [contributors](https://github.com/your/project/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

* Hat tip to anyone whose code was used
* Inspiration
* etc