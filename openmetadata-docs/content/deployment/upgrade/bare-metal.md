---
title: Upgrade on Bare Metal
slug: /deployment/upgrade/bare-metal
---

# Upgrade on Bare Metal

This guide will help you upgrade an OpenMetadata deployment using release binaries.

## Requirements 

This guide assumes that you have an OpenMetadata deployment that you installed and configured following the
[Bare Metal deployment](/deployment/bare-metal) guide.

## Procedure

Below procedure is to go from  **0.11.5 to 0.12.1**

### 1. Back up metadata

Before proceeding, pleae make sure you made a backup of your MySQL/Postgres DB behind OpenMetadata server. This step is extremely important for you to restore to your current state if any issues come up during the upgrade 

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="luggage"
    bold="Backup Metadata"
    href="/deployment/upgrade/backup-metadata"
  >
    Learn how to back up MySQL data.
  </InlineCallout>
</InlineCalloutContainer>


### 2. Download the binaries for the release you want to install

OpenMetadata release binaries are maintained as GitHub releases.

To download a specific release binary:
1. Visit [github.com/open-metadata/OpenMetadata/releases](github.com/open-metadata/OpenMetadata/releases). The latest
  release will be at the top of this page. 
2. Locate the Assets' section for the release you want to upgrade to. 
3. Download the release binaries. The release binaries will be in a compressed tar file named using the following 
  convention, `openmetadata-x.y.z.tar.gz` Where `x`, `y`, `z` are the major, minor, and patch release numbers, respectively.

### 2. Extract the release binaries from the download file

Using the command-line tool or application of your choice, extract the release binaries. 

For example, to extract using `tar`, run the following command. 

```commandline
tar xfz openmetadata-0.12.1.tar.gz
```

This will create a directory with the same name as the download file minus the `.tar` and `.gz` extensions.

### 3. Navigate into the directory created by extracting the release binaries

Change into the new directory by issuing a command similar to the following.

```commandline
cd openmetadata-x.y.z
```

For example, to navigate into the directory created by issuing the tar command above, you would run the following
command.

```commandline
cd openmetadata-0.12.1
```

### 4. Stop the OpenMetadata server

OpenMetadata ships with a few control scripts. One is `openmetadata.sh`. This script enables you to start, stop, and
perform other deployment operations on the OpenMetadata server. 

Most OpenMetadata releases will require you to migrate your data to updated schemas. 

Before you migrate your data to the new release you are upgrading to, stop the OpenMetadata server from the
directory of your current installation by running the following command:

```commandline
./bin/openmetadata.sh stop
```

### 5. Update the configurations

#### Database Connection Environment Variables

On 0.11, the Environment Variables to connect to Database used were

* MYSQL_USER
* MYSQL_USER_PASSWORD
* MYSQL_HOST
* MYSQL_PORT
* MYSQL_DATABASE

These environment variables are changed in 0.12.1 Release

* DB_USER
* DB_USER_PASSWORD
* DB_HOST
* DB_PORT
* OM_DATABASE

This will effect to all the bare metal and docker instances which configures a custom database depending on the above environment variable values.

#### Config updates

If you configured SSO and authorizer please make sure you changed the following configs

```
authorizerConfiguration:
  className: ${AUTHORIZER_CLASS_NAME:-org.openmetadata.service.security.DefaultAuthorizer}
  containerRequestFilter: ${AUTHORIZER_REQUEST_FILTER:-org.openmetadata.service.security.JwtFilter}
  
```

Make sure all of the following configs are properly udpated with the new java package name **org.openmetadata.service**

Event Handlers

```
eventHandlerConfiguration:
  eventHandlerClassNames:
    - "org.openmetadata.service.events.AuditEventHandler"
    - "org.openmetadata.service.events.ChangeEventHandler"
```

Swagger docs

```
swagger:
  resourcePackage: org.openmetadata.service.resources
```

Logging

```
logging:
  level: ${LOG_LEVEL:-DEBUG}
  loggers:
    org.openmetadata.service.events: DEBUG
    io.swagger: ERROR
```




### 6. Migrate the database schemas and ElasticSearch indexes

The bootstrap/bootstrap_storage.sh script enables you to perform a number of operations on the OpenMetadata database (in
MySQL) and index (in Elasticsearch).

```commandline
./bootstrap/bootstrap_storage.sh migrate-all
```

<Note>

This step will be different in the 0.9 to 0.10 upgrade as it is a backward incompatible change.

Find specific instructions [here](/deployment/upgrades/versions/090-to-010).

</Note>

### 7. Restart the OpenMetadata server

Once you've dropped and recreated your data in the new version, restart the OpenMetadata server using the new release
binaries. You may restart the server by running the following command.

```commandline
./bin/openmetadata.sh start
```

### 8. Reindex ElasticSearch

We have added a conditional suggestion mapping for all of the elasticsearch indexes. This may require re-indexing. With 0.12.1 its never been easier to index your metadata

#### 8.1 Go to Settings -> Event Publishers -> ElasticSearch

<Image src="/images/deployment/upgrade/elasticsearch-re-index.png" alt="create-project" caption="Create a New Project"/>

#### 8.2 Make sure you select "Recreate Indexes"

Click on the "Recreate Indexes" lable and click "Re Index All"




###  Upgrade all your connectors

If you are ingesting data manually or in a custom scheduler using OpenMetadata connectors,
upgrade all your connectors by running the following command for each connector.

You will need to replace `<connectorname>` in the command below with the name of the connector you are upgrading.

```commandline
pip3 install --upgrade "openmetadata-ingestion[<connectorname>]"
```
