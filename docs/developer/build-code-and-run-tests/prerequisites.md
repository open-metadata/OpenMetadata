---
description: This guide will help you set up all prerequisites to develop on OpenMetadata.
---

# Prerequisites

OpenMetadata being a full stack project, we use the following for development:

* [Docker 20 or higher](https://docs.docker.com/engine/install/)
* [Java JDK 11 or higher](https://docs.oracle.com/en/java/javase/17/install/overview-jdk-installation.html)
* [Maven 3.5.x or higher](https://maven.apache.org/install.html)
* [Python 3.7 or higher](https://www.python.org/downloads/)
* [Node >=10.0.0](https://nodejs.org/en/download/)
* [Yarn ^1.22.0](https://classic.yarnpkg.com/lang/en/docs/install/)

Here is a snapshot of a working environment on a Macbook.

```
> docker --version
Docker version 20.10.8, build 3967b7d

> mvn -version
Apache Maven 3.8.2 (ea98e05a04480131370aa0c110b8c54cf726c06f)
Maven home: /usr/local/Cellar/maven/3.8.2/libexec
Java version: 11.0.11, vendor: AdoptOpenJDK, runtime: /Library/Java/JavaVirtualMachines/adoptopenjdk-11.jdk/Contents/Home
Default locale: en_US, platform encoding: UTF-8
OS name: "mac os x", version: "10.15.7", arch: "x86_64", family: "mac"

> java -version
openjdk version "11.0.11" 2021-04-20
OpenJDK Runtime Environment AdoptOpenJDK-11.0.11+9 (build 11.0.11+9)
OpenJDK 64-Bit Server VM AdoptOpenJDK-11.0.11+9 (build 11.0.11+9, mixed mode)

>  make -version
GNU Make 3.81
Copyright (C) 2006  Free Software Foundation, Inc.
This is free software; see the source for copying conditions.
There is NO warranty; not even for MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.

This program built for i386-apple-darwin11.3.0
> python --version
Python 3.9.9

> node --version
v17.3.0

> yarn --version
1.22.17
```

### Install pre-commit hooks

We use pre-commit hooks to run checkstyle for Java and Python and format it as per our coding style.&#x20;

Please install the following to format the code during the git commit process

```
git clone https://github.com/open-metadata/OpenMetadata
cd openmetadata
make install_dev
make install_test precommit_install
```

### OpenMetadata API Backend

We use Java for developing OpenMetadata backend server. Following are the key technologies that we use for the backend:

* [jsonschema2pojo](https://www.jsonschema2pojo.org) for Java code generation
* [Dropwizard](https://www.dropwizard.io/en/latest/) for the web service application
* [JDBI3](http://jdbi.org) for database access

