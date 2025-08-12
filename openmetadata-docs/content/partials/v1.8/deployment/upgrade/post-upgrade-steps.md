# Post-Upgrade Steps

### Reindex

#### With UI

{% partial file="/v1.8/deployment/reindex.md" /%}

Since this is required after the upgrade, we want to reindex `All` the entities.

### (Optional) Update your OpenMetadata Ingestion Client

If you are running the ingestion workflows **externally** or using a custom Airflow installation, you need to make sure that the Python Client you use is aligned
with the OpenMetadata server version.

For example, if you are upgrading the server to the version `x.y.z`, you will need to update your client with

```bash
pip install openmetadata-ingestion[<plugin>]==x.y.z
```

#### With Kubernetes
Follow these steps to reindex using the CLI:

1.	List the CronJobs
Use the following command to check the available CronJobs:
```bash
kubectl get cronjobs
```
Upon running this command you should see output similar to the following.
```CommandLine
kubectl get cronjobs
NAME                    SCHEDULE      TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
cron-reindex            0/5 * * * *   <none>     True      0        <none>          31m
```

2.	Create a Job from a CronJob
Create a one-time job from an existing CronJob using the following command:
```bash
kubectl create job --from=cronjob/cron-reindex <job_name>
```
{% note %} Replace `<job_name>` with the actual name of the job.{% /note %}

Upon running this command you should see output similar to the following.
```CommandLine
kubectl create job --from=cronjob/cron-reindex cron-reindex-one
job.batch/cron-reindex-one created
```
3.	Check the Job Status
Verify the status of the created job with:
```bash
kubectl get jobs
```
Upon running this command you should see output similar to the following.
```CommandLine
kubectl get jobs
NAME                       STATUS     COMPLETIONS   DURATION   AGE
cron-reindex-one           Complete   1/1           20s        109s
```
4. view logs 
To view the logs use the below command.
```bash
kubectl logs job/<job_name>
```
{% note %} Replace `<job_name>` with the actual job name.{% /note %}


The `plugin` parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==1.2.0`.
You will find specific instructions for each connector [here](/connectors).

Moreover, if working with your own Airflow deployment - not the `openmetadata-ingestion` image - you will need to upgrade
as well the `openmetadata-managed-apis` version:

```bash
pip install openmetadata-managed-apis==x.y.z
```

### Re Deploy Ingestion Pipelines

#### With UI

{% partial file="/v1.8/deployment/redeploy.md" /%}

#### With Kubernetes

Follow these steps to deploy pipelines using the CLI:
1.	List the CronJobs
Use the following command to check the available CronJobs:
```bash
kubectl get cronjobs
```
Upon running this command you should see output similar to the following.
```commandline
kubectl get cronjobs
NAME                    SCHEDULE      TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
cron-deploy-pipelines   0/5 * * * *   <none>     True      0        <none>          4m7s
```
2.	Create a Job from a CronJob
Create a one-time job from an existing CronJob using the following command:
```bash
kubectl create job --from=cronjob/cron-reindex <job_name>
```
{% note %} 
Replace `<job_name>` with the actual name of the job.
{% /note %}

Upon running this command you should see output similar to the following.
```commandline
kubectl create job --from=cronjob/cron-deploy-pipelines cron-deploy-pipeline-one
job.batch/cron-deploy-pipeline-one created
```
3.	Check the Job Status
Verify the status of the created job with:
```bash
kubectl get jobs
```
Upon running this command you should see output similar to the following.
```CommandLine
kubectl get jobs
NAME                       STATUS     COMPLETIONS   DURATION   AGE
cron-deploy-pipeline-one   Complete   1/1           13s        3m35s
```
4. view logs 
To view the logs use the below command.
```bash
kubectl logs job/<job_name>
```
{% note %} Replace `<job_name>` with the actual job name.{% /note %}

If you are seeing broken dags select all the pipelines from all the services and re deploy the pipelines.

# Openmetadata-ops Script

## Overview

The `openmetadata-ops` script is designed to manage and migrate databases and search indexes, reindex existing data into Elastic Search or OpenSearch, and redeploy service pipelines.

## Usage

``` bash
sh openmetadata-ops.sh [-dhV] [COMMAND]
```

#### Commands
* analyze-tables 

Migrates secrets from the database to the configured Secrets Manager. Note that this command does not support migrating between external Secrets Managers.

* changelog

Prints the change log of database migration.

* check-connection

Checks if a connection can be successfully obtained for the target database.

* deploy-pipelines

Deploys all the service pipelines.

* drop-create

Deletes any tables in the configured database and creates new tables based on the current version of OpenMetadata. This command also re-creates the search indexes.

* info

Shows the list of migrations applied and the pending migrations waiting to be applied on the target database.

* migrate

Migrates the OpenMetadata database schema and search index mappings.

* migrate-secrets

Migrates secrets from the database to the configured Secrets Manager. Note that this command does not support migrating between external Secrets Managers.

* reindex

Reindexes data into the search engine from the command line.

* repair

Repairs the DATABASE_CHANGE_LOG table, which is used to track all the migrations on the target database. This involves removing entries for the failed migrations and updating the checksum of migrations already applied on the target database.

* validate

Checks if all the migrations have been applied on the target database.

### Examples

Display Help To display the help message:

```bash
sh openmetadata-ops.sh --help
```

### Migrate Database Schema

To migrate the database schema and search index mappings:
```bash
sh openmetadata-ops.sh migrate
```

### Reindex Data

To reindex data into the search engine:
```bash
sh openmetadata-ops.sh reindex
```
