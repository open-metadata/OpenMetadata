---
title: Prerequisites | OpenMetadata Developer Setup Requirements
description: Complete prerequisite steps for contributing code including environment, dependencies, and access setup.
slug: /developers/contribute/build-code-and-run-tests/prerequisites
---

# Prerequisites
This guide will help you set up all prerequisites to develop on OpenMetadata.

OpenMetadata being a full stack project, we use the following for development:

- [Docker 20 or higher](https://docs.docker.com/engine/install/)
- [Java JDK 21](https://docs.oracle.com/en/java/javase/21/install/overview-jdk-installation.html)
- [Antlr 4.9.2](https://www.antlr.org/) - `sudo make install_antlr_cli`
- [JQ](https://jqlang.github.io/jq/) - `brew install jq` (osx)  `apt-get install jq` (Ubuntu)
- [Maven 3.5.x or higher](https://maven.apache.org/install.html) - (with Java JDK 11)
- [Python 3.9 to 3.11](https://www.python.org/downloads/)
- [Node 18.x](https://nodejs.org/en/download/)
- [Yarn ^1.22.0](https://classic.yarnpkg.com/lang/en/docs/install/)
- [Rpm (Optional, only to run RPM profile with maven)](https://macappstore.org/rpm/)

To validate the installation of the above tools, you can run: 

```shell
make prerequisites
```

### Example Snapshot on a Macbook

```shell
> docker --version
Docker version 20.10.8, build 3967b7d

> java -version
openjdk version "21.0.7" 2025-04-15
OpenJDK Runtime Environment Homebrew (build 21.0.7)
OpenJDK 64-Bit Server VM Homebrew (build 21.0.7, mixed mode, sharing)

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
Apache Maven 3.9.9 (8e8579a9e76f7d015ee5ec7bfcdc97d260186937)
Maven home: /opt/homebrew/Cellar/maven/3.9.9/libexec
Java version: 23.0.2, vendor: Homebrew, runtime: /opt/homebrew/Cellar/openjdk/23.0.2/libexec/openjdk.jdk/Contents/Home
Default locale: en_IN, platform encoding: UTF-8
OS name: "mac os x", version: "15.5", arch: "aarch64", family: "mac"

>  make -version
GNU Make 3.81
Copyright (C) 2006  Free Software Foundation, Inc.
This is free software; see the source for copying conditions.
There is NO warranty; not even for MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.

This program built for i386-apple-darwin11.3.0
> python --version
Python 3.10.17

> node --version
v20.19.2

> yarn --version
1.22.22

> rpm --version
RPM version 4.17.0

> jq --version                                                                                       
jq-1.7.1

```

### Install pre-commit hooks
We use pre-commit hooks to run checkstyle for Java and Python and format it as per our coding style.

Please install the following to format the code during the git commit process

```shell
git clone https://github.com/open-metadata/OpenMetadata
cd openmetadata
python3 -m venv env
source env/bin/activate
pip install pre-commit
make install_dev
make install_test precommit_install
```

### OpenMetadata API Backend

We use Java for developing OpenMetadata backend server. Following are the key technologies that we use for the backend:

- [jsonschema2pojo](https://www.jsonschema2pojo.org/) for Java code generation
- [Dropwizard](https://www.dropwizard.io/en/latest/) for the web service application
- [JDBI3](http://jdbi.org/) for database access
