---
title: Run the Salesforce Connector Externally
description: Configure Salesforce database connectors with OpenMetadata using YAML. Step-by-step setup guide, configuration examples, and best practices included.
slug: /connectors/database/salesforce/yaml
---

{% connectorDetailsHeader
name="Salesforce"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Stored Procedures", "Owners", "Tags", "Sample Data"]
/ %}

In this section, we provide guides and references to use the Salesforce connector.

Configure and schedule Salesforce metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Enable Security](#securing-salesforce-connection-with-ssl-in-openmetadata)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

Following are the permissions you will require to fetch the metadata from Salesforce.

**API Access**: You must have the API Enabled permission in your Salesforce organization.

**Object Permissions**: You must have read access to the Salesforce objects that you want to ingest.


### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

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

**Organization ID**: Salesforce Organization ID is the unique identifier for your Salesforce identity. You can check out [this doc](https://help.salesforce.com/s/articleView?id=000385215&type=1) on how to get the your Salesforce Organization ID.
{% note %}
**Note**: You need to provide `15` digit organization id in this section. for e.g. `00DIB000004nDEq`, which you can find by following the steps mentioned in above doc (`Salesforce dashboard->Setup->Company Profile->Company Information->Salesforce.com Organization Id`).
{% /note %}
{% note %}
**Note**: If you want to access salesforce metadata without token(only by using organization id), you will need to setup your ip in trusted ip ranges. You can go (`Salesforce dashboard->Setup->Security->Network Access->Trusted IP Ranges`) to configure this. You can check [here](https://help.salesforce.com/s/articleView?id=sf.security_networkaccess.htm&type=5) to configure your ip in trusted ip ranges.
{% /note %}
{% /codeInfo %}

{% codeInfo srNumber=6 %}

**sobjectName**: Specify the Salesforce Object Name in case you want to ingest a specific object.  If left blank, we will ingest all the Objects.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**salesforceApiVersion**: Follow the steps mentioned [here](https://help.salesforce.com/s/articleView?id=000386929&type=1) to get the API version. Enter the numerical value in the field, For example `42.0`.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**salesforceDomain**: When connecting to Salesforce, you can specify the domain to use for accessing the platform. The common domains include `login` and `test`, and you can also utilize Salesforce My Domain.
By default, the domain `login` is used for accessing Salesforce.

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=9 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=10 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
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
      organizationId: organizationId
```
```yaml {% srNumber=6 %}
      sobjectName: sobjectName
```
```yaml {% srNumber=7 %}
      salesforceApiVersion: "42.0"
```
```yaml {% srNumber=8 %}
      salesforceDomain: login
```
```yaml {% srNumber=9 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=10 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.7/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}

## Securing Salesforce Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and Salesforce, navigate to the Advanced Config section. Here, you can provide the CA certificate used for SSL validation by specifying the `caCertificate`. Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl_key`, `ssl_cert`, and `ssl_ca`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `ssl_ca` for the CA certificate to validate the server’s certificate.

```yaml
      sslConfig:
            caCertificate: "/path/to/ca_certificate"
            sslCertificate: "/path/to/your/ssl_cert"
            sslKey: "/path/to/your/ssl_key"
```
