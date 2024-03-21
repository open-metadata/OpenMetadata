---
title: Run the Salesforce Connector Externally
slug: /connectors/database/salesforce/yaml
---

{% connectorDetailsHeader
name="Salesforce"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Stored Procedures", "Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Salesforce connector.

Configure and schedule Salesforce metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

Following are the permissions you will require to fetch the metadata from Salesforce.

**API Access**: You must have the API Enabled permission in your Salesforce organization.

**Object Permissions**: You must have read access to the Salesforce objects that you want to ingest.


### Python Requirements

To run the Salesforce ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[salesforce]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/salesforceConnection.json)
you can find the structure to create a connection to Salesforce.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Salesforce:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Username to connect to the Salesforce. This user should have the access as defined in requirements.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Salesforce.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**securityToken**: Salesforce Security Token is required to access the metadata through APIs. You can checkout [this doc](https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm&type=5) on how to get the security token.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**sobjectName**: Specify the Salesforce Object Name in case you want to ingest a specific object.  If left blank, we will ingest all the Objects.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**salesforceApiVersion**: Follow the steps mentioned [here](https://help.salesforce.com/s/articleView?id=000386929&type=1) to get the API version. Enter the numerical value in the field, For example `42.0`.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**salesforceDomain**: When connecting to Salesforce, you can specify the domain to use for accessing the platform. The common domains include `login` and `test`, and you can also utilize Salesforce My Domain.
By default, the domain `login` is used for accessing Salesforce.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=8 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=9 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: salesforce
  serviceName: local_salesforce
  serviceConnection:
    config:
      type: Salesforce
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      password: password
```
```yaml {% srNumber=4 %}
      securityToken: securityToken
```
```yaml {% srNumber=5 %}
      sobjectName: sobjectName
```
```yaml {% srNumber=6 %}
      salesforceApiVersion: 42.0
```
```yaml {% srNumber=7 %}
      salesforceDomain: login
```
```yaml {% srNumber=8 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=9 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
