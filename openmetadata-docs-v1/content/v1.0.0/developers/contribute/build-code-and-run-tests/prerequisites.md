---
title: Prerequisites
slug: /developers/contribute/build-code-and-run-tests/prerequisites
---

# Prerequisites
This guide will help you set up all prerequisites to develop on OpenMetadata.

OpenMetadata being a full stack project, we use the following for development:

- [Docker 20 or higher](https://docs.docker.com/engine/install/)
- [Java JDK 11](https://docs.oracle.com/en/java/javase/11/install/overview-jdk-installation.html)
- [Antlr 4.9.2](https://www.antlr.org/) - `sudo make install_antlr_cli`
- [Maven 3.5.x or higher](https://maven.apache.org/install.html) - (with Java JDK 11)
- [Python 3.7 or higher](https://www.python.org/downloads/)
- [Node >=16.0.0 & Node <= 18.0.0](https://nodejs.org/en/download/)
- [Yarn ^1.22.0](https://classic.yarnpkg.com/lang/en/docs/install/)
- [Rpm (Optional, only to run RPM profile with maven)](https://macappstore.org/rpm/)

- Here is a snapshot of a working environment on a Macbook.

```shell
> docker --version
Docker version 20.10.8, build 3967b7d

> java -version
openjdk version "11.0.11" 2021-04-20
OpenJDK Runtime Environment AdoptOpenJDK-11.0.11+9 (build 11.0.11+9)
OpenJDK 64-Bit Server VM AdoptOpenJDK-11.0.11+9 (build 11.0.11+9, mixed mode)

> antlr4
ANTLR Parser Generator  Version 4.9.2
 -o ___              specify output directory where all output is generated
 -lib ___            specify location of grammars, tokens files
 -atn                generate rule augmented transition network diagrams
 -encoding ___       specify grammar file encoding; e.g., euc-jp
 -message-format ___ specify output style for messages in antlr, gnu, vs2005
 -long-messages      show exception details when available for errors and warnings
 -listener           generate parse tree listener (default)
 -no-listener        don\'t generate parse tree listener
 -visitor            generate parse tree visitor
 -no-visitor         don\'t generate parse tree visitor (default)
 -package ___        specify a package/namespace for the generated code
 -depend             generate file dependencies
 -D<option>=value    set/override a grammar-level option
 -Werror             treat warnings as errors
 -XdbgST             launch StringTemplate visualizer on generated code
 -XdbgSTWait         wait for STViz to close before continuing
 -Xforce-atn         use the ATN simulator for all predictions
 -Xlog               dump lots of logging info to antlr-timestamp.log
 -Xexact-output-dir  all output goes into -o dir regardless of paths/package

> mvn -version
Apache Maven 3.8.2 (ea98e05a04480131370aa0c110b8c54cf726c06f)
Maven home: /usr/local/Cellar/maven/3.8.2/libexec
Java version: 11.0.11, vendor: AdoptOpenJDK, runtime: /Library/Java/JavaVirtualMachines/adoptopenjdk-11.jdk/Contents/Home
Default locale: en_US, platform encoding: UTF-8
OS name: "mac os x", version: "10.15.7", arch: "x86_64", family: "mac"

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

> rpm --version
RPM version 4.17.0
```

### Install pre-commit hooks
We use pre-commit hooks to run checkstyle for Java and Python and format it as per our coding style.

Please install the following to format the code during the git commit process

```shell
git clone https://github.com/open-metadata/OpenMetadata
cd openmetadata
python3 -m venv env
source env/bin/activate  
make install_dev
make install_test precommit_install
```

### OpenMetadata API Backend

We use Java for developing OpenMetadata backend server. Following are the key technologies that we use for the backend:

- [jsonschema2pojo](https://www.jsonschema2pojo.org/) for Java code generation
- [Dropwizard](https://www.dropwizard.io/en/latest/) for the web service application
- [JDBI3](http://jdbi.org/) for database access
