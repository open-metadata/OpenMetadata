# Build the code & run tests

## Prerequisites

First of all, you need to make sure you are using maven 3.5.x or higher and JDK 11 or higher.

## Building

The following commands must be run from the top-level directory.

`mvn clean install`

If you wish to skip the unit tests you can do this by adding `-DskipTests` to the command line.

## Create a distribution \(packaging\)

You can create a _distribution_ as follows.

```text
$ mvn clean install

# Create the binary distribution.
$ cd dist && mvn package
```

The binaries will be created at:

```text
dist/target/open-metadata-<version>.pom
dist/target/open-metadata-<version>.tar.gz
```

## Run instance through IntelliJ IDEA

Add a new Run/Debug configuration like the below screenshot.

![Intellij Run Configuration](../../.gitbook/assets/image%20%281%29.png)

## Add missing dependency

Right-click on catalog-rest-service

![](../../.gitbook/assets/image-1-.png)

Click on "Open Module Settings"

![](../../.gitbook/assets/image-2-.png)

Go to "Dependencies"

![](../../.gitbook/assets/image-3-.png)

Click “+” at the bottom of the dialog box and click "Add"

![](../../.gitbook/assets/image-4-.png)

Click on Library

![](../../.gitbook/assets/image-5-.png)

In that list look for "jersey-client:2.25.1"

![](../../.gitbook/assets/image-6-.png)

Select it and click "OK". Now run/debug the application.

## Coding Style

1. [Refer to coding guidelines](https://github.com/open-metadata/OpenMetadata/blob/main/docs/open-source-community/developer/coding-style.md)
2. Configure IntelliJ to disable the \[wild-card imports\]

   \([https://www.jetbrains.com/help/idea/creating-and-optimizing-imports.html\#disable-wildcard-imports](https://www.jetbrains.com/help/idea/creating-and-optimizing-imports.html#disable-wildcard-imports)\)

