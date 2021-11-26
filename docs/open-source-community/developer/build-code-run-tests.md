# Build the code & run tests

## Prerequisites

* Make sure you are using maven 3.5.x or higher and JDK 11 or higher.
*   Make sure you have a local instance of MySQL and ElasticSearch.

    * For an easy install of MySQL and ES, just install Docker on your local machine and run the following commands from the top-level directory

    ```
    cd docker/local-metadata
    docker-compose -f docker-compose-dev.yml up
    ```
*   Bootstrap MySQL with tables

    1. Create a distribution as explained [here](build-code-run-tests.md#create-a-distribution-packaging)
    2. Extract the distribution tar.gz file and run the following command

    ```
    cd open-metadata-<version>/bootstrap
    sh bootstrap_storage.sh drop-create
    ```
*   Bootstrap ES with indexes and load sample data into MySQL

    1. Run OpenMetadata service instances through IntelliJ IDEA following the instructions [here](build-code-run-tests.md#run-instance-through-intellij-idea)
    2. Once the logs indicate that the instance is up, run the following commands from the top-level directory

    ```
    python3 -m venv /tmp/venv
    source /tmp/venv/bin/activate
    pip install -r ingestion/requirements.txt
    make install_dev generate
    cd ingestion
    pip install -e '.[sample-data, elasticsearch]'
    metadata ingest -c ./pipelines/sample_data.json
    metadata ingest -c ./pipelines/sample_usage.json
    metadata ingest -c ./pipelines/metadata_to_es.json
    ```
* You are now ready to explore the app by going to http://localhost:8585 \*If the web page doesn't work as intended, please take a look at the troubleshooting steps [here](build-code-run-tests.md#troubleshooting)

## Building

The following commands must be run from the top-level directory.

`mvn clean install`

If you wish to skip the unit tests you can do this by adding `-DskipTests `to the command line.

## Create a distribution (packaging)

You can create a _distribution_ as follows.

```
$ mvn clean install

# Create the binary distribution.
$ cd dist && mvn package
```

The binaries will be created at:

```
openmetadata-dist/target/open-metadata-<version>.pom
openmetadata-dist/target/open-metadata-<version>.tar.gz
```

## Run instance through IntelliJ IDEA

Add a new Run/Debug configuration like the below screenshot.

![Intellij Run Configuration](<../../.gitbook/assets/image (1).png>)

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

## Troubleshooting

* If you see blank page at http://localhost:8585 , please check the logs at `logs/openmetadata.log`. You might be encountering one of the following errors:
  * `connection refused` or `unreachable` - please confirm that MySQL and ES are reachable outside of docker by running `docker ps` and checking that ports 3306 and 9200 are listening on 0.0.0.0
    * If ElasticSearch in Docker on Mac is crashing, try changing Preferences -> Resources -> Memory to 4GB
    * If ElasticSearch logs show `high disk watermark [90%] exceeded`, try changing Preferences -> Resources -> Disk Image Size to at least 16GB
  * `Public Key Retrieval is not allowed` - verify that the JDBC connect URL in `conf/openmetadata.yaml` is configured with the parameter `allowPublicKeyRetrieval=true`
  * Browser console shows javascript errors, try doing a [clean build](build-code-run-tests.md#building). Some npm packages may not have been built properly.

## Coding Style

1. [Refer to coding guidelines](coding-style.md)
2.  Configure IntelliJ to disable the \[wild-card imports]

    ([https://www.jetbrains.com/help/idea/creating-and-optimizing-imports.html#disable-wildcard-imports](https://www.jetbrains.com/help/idea/creating-and-optimizing-imports.html#disable-wildcard-imports))
