# Build the code & run tests

## Prerequisites

* Clone the project on your local computer

  ```
  git https://github.com/open-metadata/OpenMetadata.git
  ```
* Make sure you are using maven 3.5.x or higher and JDK 11 or higher.
* Make sure you have a local instance of MySQL and ElasticSearch.
    * For an easy install of MySQL and ES, just install Docker on your local machine and run the following commands from the top-level directory

      ```
      docker-compose -f docker/local-metadata/docker-compose-dev.yml up
      ```
* Bootstrap MySQL with tables and ES with indexes
    1. [Install the packages](build-code-run-tests.md#building) in your local maven repository.

       ```
       ./bootstrap/bootstrap_storage.sh drop-create-all
       ```
* Load sample data into MySQL
    1. Run OpenMetadata service instances through IntelliJ IDEA following the instructions [here](build-code-run-tests.md#run-instance-through-intellij-idea)
    2. Once the logs indicate that the instance is up, run the following commands from the top-level directory

       ```
       cd ingestion
       python3 -m venv venv
       source venv/bin/activate
       pip install -e '.[sample-data, elasticsearch]'
       metadata ingest -c ./pipelines/sample_data.json
       metadata ingest -c ./pipelines/sample_usage.json
       # optional when the indexes of ES are misaligned with the tables of MySQL
       metadata ingest -c ./pipelines/metadata_to_es.json
       ```
* You are now ready to explore the app by going to http://localhost:8585 
* If the web page doesn't work as intended, please take a look at the troubleshooting steps [here](build-code-run-tests.md#troubleshooting)

## Building

The following commands must be run from the top-level directory.

`mvn clean install`

If you wish to skip the unit tests you can do this by adding `-DskipTests` to the command line.

## Create a distribution (packaging)

You can create a _distribution_ as follows.

```
$ mvn clean install
```

The binaries will be created at:

```
openmetadata-dist/target/open-metadata-<version>.pom
openmetadata-dist/target/open-metadata-<version>.tar.gz
```

## Run instance through IntelliJ IDEA

Add a new Run/Debug configuration like the below screenshot.

1. Click on Intellij - Run menu
2. Click on "Edit Configurations"
3. Click + sign and Select Application and make sure your config looks similar to the below image

![Intellij Runtime Configuration](<../../.gitbook/assets/Intellij-Runtime Config.png>)

## Troubleshooting

* If you see blank page at http://localhost:8585 , please check the logs at `logs/openmetadata.log`. You might be encountering one of the following errors:
  * `connection refused` or `unreachable` - please confirm that MySQL and ES are reachable outside of docker by running `docker ps` and checking that ports 3306 and 9200 are listening on 0.0.0.0
    * If ElasticSearch in Docker on Mac is crashing, try changing Preferences -> Resources -> Memory to 4GB
    * If ElasticSearch logs show `high disk watermark [90%] exceeded`, try changing Preferences -> Resources -> Disk Image Size to at least 16GB
  * `Public Key Retrieval is not allowed` - verify that the JDBC connect URL in `conf/openmetadata.yaml` is configured with the parameter `allowPublicKeyRetrieval=true`
  * Browser console shows javascript errors, try doing a [clean build](build-code-run-tests.md#building). Some npm packages may not have been built properly.

## Coding Style

* Get familiar with [pre-commit](https://pre-commit.com/) and run the following commands from the top-level directory.

  ```shell
  brew install pre-commit
  make precommit_install
  ```

* Follow the instructions of the [google java format](https://github.com/google/google-java-format#intellij-android-studio-and-other-jetbrains-ides) plugin for Intellij.

  1. Install the google-java-format plugin
  ![Install the google-java-format plugin](<../../.gitbook/assets/Intellij03.jpg>)
  1. Enable the plugin
  ![Enable the plugin](<../../.gitbook/assets/Intellij04.jpg>)
  1. Import the Java GoogleStyle
  ![Import the Java GoogleStyle](<../../.gitbook/assets/Intellij01.jpg>)
  1. Fix the order of the imports
  ![Fix the order of the imports](<../../.gitbook/assets/Intellij02.jpg>)

* Refer to the [coding guidelines](coding-style.md)
* Configure IntelliJ to disable the [wild-card imports](https://www.jetbrains.com/help/idea/creating-and-optimizing-imports.html#disable-wildcard-imports)
