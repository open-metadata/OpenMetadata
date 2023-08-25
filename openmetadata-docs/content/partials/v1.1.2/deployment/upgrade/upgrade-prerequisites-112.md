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
pip install openmetadata-ingestion~=1.1.2
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

If you are running the ingestion workflows **externally**, you need to make sure that the Python Client you use is aligned
with the OpenMetadata server version.

For example, if you are upgrading the server to the version `x.y.z`, you will need to update your client with

```
pip install openmetadata-ingestion[<plugin>]==x.y.z
```

The `plugin` parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==1.1.2`.
You will find specific instructions for each connector [here](/connectors).

## 1.1.2 - Stable Release 🎉

OpenMetadata 1.1.2 is a stable release. Please check the [release notes](/releases/latest-release).

If you are upgrading production this is the recommended version to upgrade to.

## Deprecation Notice

In 1.2 we will completely remove the Bots configured with SSO. Only JWT will be available then. Please, upgrade your bots if you haven't done so. Note that the UI already does not allow creating bots with SSO.

## Breaking Changes for 1.1.2 Stable Release

**Openmetadata yaml config updates**

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



### Service Connection Changes

`Trino` has deprecated the params property. The contents will automatically be passed to `connectionOptions`. We have added support for authType to distinguish between `basicAuth` and `jwtAuth`.


