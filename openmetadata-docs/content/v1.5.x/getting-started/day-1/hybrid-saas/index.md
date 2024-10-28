---
title: Hybrid SaaS
slug: /getting-started/day-1/hybrid-saas
collate: 
---

# Hybrid SaaS

There's two options on how to set up a data connector:
1. **Run the connector in Collate SaaS**: In this scenario, you'll get an IP when you add the service. You need to give
   access to this IP in your data sources.
2. **Run the connector in your infrastructure or laptop**: In this case, Collate won't be accessing the data, but rather
   you'd control where and how the process is executed and Collate will only receive the output of the metadata extraction.
   This is an interesting option for sources lying behind private networks or when external SaaS services are not allowed to
   connect to your data sources.

Any tool capable of running Python code can be used to configure the metadata extraction from your sources.

{% partial file="/v1.5/connectors/python-requirements.md" /%}

In this section we'll show you how the ingestion process works and how to test it from your laptop.

## 1. How does the Ingestion Framework work?

The Ingestion Framework contains all the logic about how to connect to the sources, extract their metadata
and send it to the OpenMetadata server. We have built it from scratch with the main idea of making it an independent
component that can be run from - **literally** - anywhere.

In order to install it, You need to first find out which connector you are interested in running from your laptop.
For exammple, snowflake you can refer to document here and go through the requirements https://docs.getcollate.io/connectors/database/snowflake/yaml#requirements
Below is the command to install the connector. 

**The version of 1.5.8.0 must match your Collate/OpenMetadata version**

```shell
pip install openmetadata-ingestion[snowflake]==1.5.8.0
```

We will show further examples later, but a piece of code is the best showcase for its simplicity. In order to run
a full ingestion process, you just need to execute a single command. For example, if we wanted to run the metadata
ingestion from within a simple Python script:

```
metadata ingestion -c config.yaml
```


## 2. Ingestion Configuration

In the example above, the config.yaml must be copied from the respective connector page. For examle, incase of snowflake 
you can copy the config from https://docs.getcollate.io/connectors/database/snowflake/yaml#1.-define-the-yaml-config


{% note %}
You will find examples of all the workflow's YAML files at each Connector [page](/connectors).
{% /note %}

We will now show you examples on how to configure and run every workflow in a laptop by using Snowflake as an example. But
first, let's digest some information that will be common everywhere, the `workflowConfig`.

### Workflow Config

Here you will define information such as where are you hosting the OpenMetadata server, and the JWT token to authenticate.

{% note noteType="Warning" %}

Review this section carefully to ensure you are properly managing service credentials and other security configurations.

{% /note %}

**Logger Level**

You can specify the `loggerLevel` depending on your needs. If you are trying to troubleshoot an ingestion, running
with `DEBUG` will give you far more traces for identifying issues.

**JWT Token**

JWT tokens will allow your clients to authenticate against the Collate server.
As an admin log into your Collate Server and goto Settings -> bots -> ingestion bot and copy the token into your config


**Store Service Connection**

If set to `false`, the service will be created, but the service connection information will only be used by the Ingestion
Framework at runtime, and won't be sent to the OpenMetadata server.

If set to `true` (default), we will store the sensitive information encrypted in the database
or externally, if you have configured any [Secrets Manager](/deployment/secrets-manager).

**Workflow Configuration**

```yaml
workflowConfig:
  loggerLevel: INFO  # DEBUG, INFO, WARNING or ERROR
  openMetadataServerConfig:
    hostPort: "https://customer.getcollate.io/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
    ## Store the service Connection information
    storeServiceConnection: false
```

1. make sure hostPort is pointing to your Collate server instance
2. jwtToken is copied from Settings -> Bots -> IngestionBot
3. set storeServiceConnection to false


## Running

You can easily run every connector configuration using the `metadata` CLI from the Ingestion Framework.
In order to install it, you just need to get it from [PyPI](https://pypi.org/project/openmetadata-ingestion/).

```
metadata ingest -c config.yaml
```


