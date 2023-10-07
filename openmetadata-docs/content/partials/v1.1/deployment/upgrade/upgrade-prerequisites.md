## Prerequisites

Everytime that you plan on upgrading OpenMetadata to a newer version, make sure to go over all these steps:

### 1. Backup your Metadata

Before upgrading your OpenMetadata version we strongly recommend backing up the metadata.

The source of truth is stored in the underlying database (MySQL and Postgres supported). During each version upgrade there
is a database migration process that needs to run. It will directly attack your database and update the shape of the
data to the newest OpenMetadata release.

It is important that we backup the data because if we face any unexpected issues during the upgrade process, 
you will be able to get back to the previous version without any loss.

{% note %}

You can learn more about how the migration process works [here](/deployment/upgrade/how-does-it-work).

{% /note %}

- To run the backup and restore commands, please make sure that you are always in the latest `openmetadata-ingestion` version to have all the improvements shipped in the CLI.
- Also, make sure you have connectivity between your database (MySQL / PostgreSQL) and the host machine where you will be running the below commands.

**1. Create a Virtual Environment and Install the Backup CLI**

```python
python -m venv venv
source venv/bin/activate
pip install openmetadata-ingestion~=1.1.5
```

Validate the installed metadata version with `python -m metadata --version`

**2. Run the Backup**

If using MySQL:

```bash
python -m metadata backup -u openmetadata_user -p openmetadata_password -H mysql -d openmetadata_db --port 3306
```

If using Postgres:

```bash
python -m metadata backup -u openmetadata_user -p openmetadata_password -H postgresql -d openmetadata_db --port 5432 -s public
```

**3. Store the backup file somewhere safe**

The above command will generate a backup file with extension as `.sql`. You can copy the name from the backup command output.

Make sure to store it somewhere safe in case you need to restore the data later.

You can refer to the following guide to get more details about the backup and restore:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="luggage"
    bold="Backup Metadata"
    href="/deployment/backup-restore-metadata" %}
      Learn how to back up MySQL or Postgres data.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

### 2. Review the Deprecation Notice and Breaking Changes

Releases might introduce deprecations and breaking changes that you should be aware of and understand before moving forward.

Below in this page you will find the details for the latest release, and you can find older release notes [here](/deployment/upgrade/versions).

The goal is to answer questions like:
- *Do I need to update my configurations?*
- *If I am running connectors externally, did their service connection change?*

Carefully reviewing this will prevent easy errors.

### (Optional) 3. Update your OpenMetadata Ingestion Client

If you are running the ingestion workflows **externally** or using a custom Airflow installation, you need to make sure that the Python Client you use is aligned
with the OpenMetadata server version.

For example, if you are upgrading the server to the version `x.y.z`, you will need to update your client with

```bash
pip install openmetadata-ingestion[<plugin>]==x.y.z
```

The `plugin` parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==1.1.5`.
You will find specific instructions for each connector [here](/connectors).

Moreover, if working with your own Airflow deployment - not the `openmetadata-ingestion` image - you will need to upgrade
as well the `openmetadata-managed-apis` version:

```bash
pip install openmetadata-managed-apis==x.y.z
```

## 1.1.5 - Stable Release 🎉

OpenMetadata 1.1.5 is a stable release. Please check the [release notes](/releases/latest-release).

If you are upgrading production this is the recommended version to upgrade to.

## Deprecation Notice

- The 1.1 Release will be the last one with support for Python 3.7 since it is already [EOL](https://devguide.python.org/versions/).
  OpenMetadata 1.2 will support Python version 3.8 to 3.10.
- In 1.2 we will completely remove the Bots configured with SSO. Only JWT will be available then. Please, upgrade your
  bots if you haven't done so. Note that the UI already does not allow creating bots with SSO.
- 1.1 is the last release that will allow ingesting Impala from the Hive connector. In the next release we will
  only support the Impala scheme from the Impala Connector.

## Breaking Changes for 1.1 Stable Release

### OpenMetadata Helm Chart Values

With `1.1.0` we are moving away from `global.*` helm values under openmetadata helm charts to `openmetadata.config.*`. This change is introduce as helm reserves global chart values across all the helm charts. This conflicted the use of OpenMetadata helm charts along with other helm charts for organizations using common helm values yaml files.

For example, with `1.0.X` Application version Releases, helm values would look like below -
```yaml
global:
  ...
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins:
      - "user1"
    botPrincipals:
      - "<service_application_client_id>"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "google"
    publicKeys:
      - "https://www.googleapis.com/oauth2/v3/certs"
      - "http://openmetadata:8585/api/v1/system/config/jwks"
    authority: "https://accounts.google.com"
    clientId: "{client id}"
    callbackUrl: "http://localhost:8585/callback"
  ...
```

With OpenMetadata Application version `1.1.0` and above, the above config will need to be updated as
```yaml
openmetadata:
  config:
    authorizer:
      className: "org.openmetadata.service.security.DefaultAuthorizer"
      containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
      initialAdmins:
        - "user1"
        - "user2"
      botPrincipals:
        - "<service_application_client_id>"
      principalDomain: "open-metadata.org"
    authentication:
      provider: "google"
      publicKeys:
        - "https://www.googleapis.com/oauth2/v3/certs"
        - "http://openmetadata:8585/api/v1/system/config/jwks"
      authority: "https://accounts.google.com"
      clientId: "{client id}"
      callbackUrl: "http://localhost:8585/callback"
```

A quick and easy way to update the config is to use [yq](https://mikefarah.gitbook.io/yq/) utility to manipulate YAML files.

```bash
yq -i -e '{"openmetadata": {"config": .global}}' openmetadata.values.yml
```

The above command will update `global.*` with `openmetadata.config.*` yaml config. Please note, the above command is only recommended for users with custom helm values file explicit for OpenMetadata Helm Charts.

For more information, visit the official helm docs for [global chart values](https://helm.sh/docs/chart_template_guide/subcharts_and_globals/#global-chart-values).

### Update `sort_buffer_size` (MySQL) or `work_mem` (Postgres)

Before running the migrations, it is important to update these parameters to ensure there are no runtime errors.
A safe value would be setting them to 10MB.

**If using MySQL**

You can update it via SQL (note that it will reset after the server restarts):

```sql
SET GLOBAL sort_buffer_size = 10485760
```

To make the configuration persistent, you'd need to navigate to your MySQL Server install directory and update the
`my.ini` or `my.cnf` [files](https://dev.mysql.com/doc/refman/8.0/en/option-files.html) with `sort_buffer_size = 10485760`.

If using RDS, you will need to update your instance's [Parameter Group](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithParamGroups.html)
to include the above change.

**If using Postgres**

You can update it via SQL (not that it will reset after the server restarts):

```sql
SET work_mem = '10MB';
```

To make the configuration persistent, you'll need to update the `postgresql.conf` [file](https://www.postgresql.org/docs/9.3/config-setting.html)
with `work_mem = 10MB`.

If using RDS, you will need to update your instance's [Parameter Group](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithParamGroups.html)
to include the above change.

### Elasticsearch and OpenSearch

We now support ES version up to 7.16. However, this means that we need to handle the internals a bit differently
for Elasticsearch and OpenSearch. In the server configuration, we added the following key:

```yaml
elasticsearch:
  searchType: ${SEARCH_TYPE:- "elasticsearch"} # or opensearch
```

If you use Elasticsearch there's nothing to do. However, if you use OpenSearch, you will need to pass the new
parameter as `opensearch`.

### Pipeline Service Client Configuration

If reusing an old YAML configuration file, make sure to add the following inside `pipelineServiceClientConfiguration`:

```yaml
pipelineServiceClientConfiguration:
  # ...
  # Secrets Manager Loader: specify to the Ingestion Framework how to load the SM credentials from its env
  # Supported: noop, airflow, env
  secretsManagerLoader: ${PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER:-"noop"}
  healthCheckInterval: ${PIPELINE_SERVICE_CLIENT_HEALTH_CHECK_INTERVAL:-300}
```

### Secrets Manager YAML config

If you are using the Secrets Manager and running ingestion via the CLI or Airflow, your workflow config looked
as follows:

```yaml
workflowConfig:
  openMetadataServerConfig:
    secretsManagerProvider: <Provider>
    secretsManagerCredentials:
      awsAccessKeyId: <aws access key id>
      awsSecretAccessKey: <aws secret access key>
      awsRegion: <aws region>
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

We are removing the `secretsManagerCredentials` key as a whole, so instead you'll need to configure:

```yaml
workflowConfig:
  openMetadataServerConfig:
    secretsManagerProvider: aws
    secretsManagerLoader: airflow  # if running on Airflow, otherwise `env`
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

You can find further details on this configuration [here](/deployment/secrets-manager/supported-implementations/aws-secrets-manager).

## For 1.1.4: Openmetadata yaml config updates

Following are the changes in the `openmetadata.yaml` which needs to be verified before going forward:

1. Searchtype has been added in the `elasticsearch` configuration to choose between `opensearch` or `elasticsearch`:

```
elasticsearch:
  searchType: ${SEARCH_TYPE:- "elasticsearch"}
```

2. Migration configuration:

```
migrationConfiguration:
  flywayPath: "./bootstrap/sql/migrations/flyway"
  nativePath: "./bootstrap/sql/migrations/native"
```

3. Web Configuration:

```
web:
  uriPath: ${WEB_CONF_URI_PATH:-"/api"}
  hsts:
    enabled: ${WEB_CONF_HSTS_ENABLED:-false}
    maxAge: ${WEB_CONF_HSTS_MAX_AGE:-"365 days"}
    includeSubDomains: ${WEB_CONF_HSTS_INCLUDE_SUBDOMAINS:-"true"}
    preload: ${WEB_CONF_HSTS_PRELOAD:-"true"}
  frame-options:
    enabled: ${WEB_CONF_FRAME_OPTION_ENABLED:-false}
    option: ${WEB_CONF_FRAME_OPTION:-"SAMEORIGIN"}
    origin: ${WEB_CONF_FRAME_ORIGIN:-""}
  content-type-options:
    enabled: ${WEB_CONF_CONTENT_TYPE_OPTIONS_ENABLED:-false}
  xss-protection:
    enabled: ${WEB_CONF_XSS_PROTECTION_ENABLED:-false}
    on: ${WEB_CONF_XSS_PROTECTION_ON:-true}
    block: ${WEB_CONF_XSS_PROTECTION_BLOCK:-true}
  csp:
    enabled: ${WEB_CONF_XSS_CSP_ENABLED:-false}
    policy: ${WEB_CONF_XSS_CSP_POLICY:-"default-src 'self'"}
    reportOnlyPolicy: ${WEB_CONF_XSS_CSP_REPORT_ONLY_POLICY:-""}
  referrer-policy:
    enabled: ${WEB_CONF_REFERRER_POLICY_ENABLED:-false}
    option: ${WEB_CONF_REFERRER_POLICY_OPTION:-"SAME_ORIGIN"}
  permission-policy:
    enabled: ${WEB_CONF_PERMISSION_POLICY_ENABLED:-false}
    option: ${WEB_CONF_PERMISSION_POLICY_OPTION:-""}
```

## Service Connection Changes

### In 1.1.4: Trino

`Trino` has deprecated the `params` property. The contents will automatically be passed to `connectionOptions`. We have added support for authType to distinguish between `basicAuth` and `jwtAuth`.

### MySQL and Postgres Connection

Adding IAM role support for their auth requires a slight change on their JSON Schemas:

#### From

```yaml
...
  serviceConnection:
    config: Mysql # or Postgres
    password: Password
```

#### To

If we want to use the basic authentication:

```yaml
...
  serviceConnection:
    config: Mysql # or Postgres
    authType:
      password: Password
```

Or if we want to use the IAM auth:

```yaml
...
  serviceConnection:
    config: Mysql # or Postgres
    authType:
      awsConfig:
        awsAccessKeyId: ...
        wsSecretAccessKey: ...
        awsRegion: ...
```

### Looker Connection

Now support GitHub and BitBucket as repositories for LookML models.

#### From

```yaml
...
  serviceConnection:
    config:
      type: Looker
      clientId: ...
      clientSecret: ...
      hostPort: ...
      githubCredentials:
        repositoryOwner: ...
        repositoryName: ...
        token: ...
```

#### To

```yaml
...
  serviceConnection:
    config:
      type: Looker
      clientId: ...
      clientSecret: ...
      hostPort: ...
      gitCredentials:
        type: GitHub # or BitBucket
        repositoryOwner: ...
        repositoryName: ...
        token: ...
```

### From GCS to GCP

We are renaming the `gcsConfig` to `gcpConfig` to properly define their role as generic Google Cloud configurations. This
impacts BigQuery, Datalake and any other source where you are directly passing the GCP credentials to connect to.

#### From

```yaml
...
  credentials:
    gcsConfig:
...
```

#### To

```yaml
...
  credentials:
    gcpConfig:
...
```

### Data Quality
#### From
```yaml
source:
  type: TestSuite
  serviceName: MyAwesomeTestSuite
  sourceConfig:
    config:
      type: TestSuite
    
processor:
  type: "orm-test-runner"
  config:
    testSuites:
      - name: test_suite_one
        description: this is a test testSuite to confirm test suite workflow works as expected
        testCases:
          - name: a_column_test
            description: A test case
            testDefinitionName: columnValuesToBeBetween
            entityLink: "<#E::table::local_redshift.dev.dbt_jaffle.customers::columns::number_of_orders>"     
            parameterValues:
              - name: minValue
                value: 2
              - name: maxValue
                value: 20
```

#### To
```yaml
source:
  type: TestSuite
  serviceName: <your_service_name>
  sourceConfig:
    config:
      type: TestSuite
      entityFullyQualifiedName: <entityFqn>

processor:
  type: "orm-test-runner"
  config:
    forceUpdate: <false|true>
    testCases:
      - name: <testCaseName>
        testDefinitionName: columnValueLengthsToBeBetween
        columnName: <columnName>
        parameterValues:
          - name: minLength
            value: 10
          - name: maxLength
            value: 25
      - name: <testCaseName>
        testDefinitionName: tableRowCountToEqual
        parameterValues:
          - name: value
            value: 10
```

### Entity Changes

- **Pipeline Entity**: `pipelineUrl` and `taskUrl` fields of pipeline entity has now been renamed to `sourceUrl`.
- **Chart Entity**: `chartUrl` field of chart entity has now been renamed to `sourceUrl`.
- **Dashboard Entity**: `dashboardUrl` field of dashboard entity has now been renamed to `sourceUrl`.
- **Table Entity**: `sourceUrl` field has been added to table entity which will refer to the url of data source portal (if exists). For instance, in the case of BigQuery, the `sourceUrl` field will store the URL to table details page in GCP BigQuery portal.

### Other changes

- Glue now supports custom database names via `databaseName`.
- Snowflake supports the `clientSessionKeepAlive` parameter to keep the session open for long processes.
- Databricks now supports the `useUnityCatalog` parameter to extract the metadata from unity catalog instead of hive metastore.
- Kafka and Redpanda now have the `saslMechanism` based on enum values `["PLAIN", "GSSAPI", "SCRAM-SHA-256", "SCRAM-SHA-512", "OAUTHBEARER"]`.
- OpenMetadata Server Docker Image now installs the OpenMetadata Libraries under `/opt/openmetadata` directory
- Bumped up ElasticSearch version for Docker and Kubernetes OpenMetadata Dependencies Helm Chart to `7.16.3`
- Bumped up PostgreSQL Database Container in Docker Compose quickstart to version 15
- `docker.getcollate.io/openmetadata/ingestion` now uses Airflow version `2.5.3` as base image version
- Bumped up Airflow Charts for Kubernetes OpenMetadata Dependencies Helm Chart to `7.6.1`

### Data Quality Migration

With 1.1.0 version we are migrating existing test cases defined in a test suite to the corresponding table, with this change you might need to recreate the pipelines for the test suites, since due to this restructuring the existing ones are removed from Test Suites - more details about the new data quality can be found [here](/connectors/ingestion/workflows/data-quality).

**As a user you will need to redeploy data quality workflows**. You can go to `Quality > By Tables` to view the tables with test cases that need a workflow to be set up.
