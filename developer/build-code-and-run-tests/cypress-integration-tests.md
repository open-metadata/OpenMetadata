# Cypress Integration Tests

### Pre-requisites

Before proceeding ensure that you have followed all the pre-requisites in the [OpenMetadata UI section](ui.md#pre-requisites)

Cypress tests also require all the services to be up and running in a clean slate including Elastic Search, Airflow and MySQL database. The quickest way to bring all the services up and running in local is to use the following script which will start all the required docker containers.

```
sh docker/run_local_docker.sh
```

### Steps to run Cypress tests in local

* Start Cypress

```
cd openmetadata-ui/src/main/resources/ui
yarn run cypress:open
```

* Select a browser of your choice from the dropdown list and click on the "Run {n} integration specs" button to run all the tests

![Screen-shot of Cypress window](<../../.gitbook/assets/Screen Shot 2022-05-30 at 11.00.32 PM.png>)

### Troubleshooting

Cypress tests can leave side effects on the environment and can result in failures when run repeatedly. If the tests are to be run for the second time, the database needs to be reset to a clean slate and the OM server needs to be restarted.\
\
Find the distribution tar file from `openmetadata-dist/target/openmetadata-$VERSION.tar.gz` and follow the instructions in this [section](../../deploy/deploy-on-bare-metal.md#2.-untar-the-release-download) to execute the drop-create-all command. After that restart the server and then run the Cypress tests again.
