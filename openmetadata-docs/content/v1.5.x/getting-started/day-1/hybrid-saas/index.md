---
title:  Hybrid SaaS | Secure Metadata Ingestion for Collate
slug: /getting-started/day-1/hybrid-saas
collate: true
---

# Hybrid SaaS

{%  youtube url="https://drive.google.com/file/d/16-2l9EYBE9DjlHepPKTpVFvashMy1buu/preview" start="0:00" end="6:47" width="560px" height="315px" /%}

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

## Collate Ingestion Agent  

The Collate Ingestion Agent is designed to facilitate metadata ingestion for hybrid deployments, allowing organizations to securely push metadata from their infrastructure into the Collate platform without exposing their internal systems. It provides a secure and efficient channel for running ingestion workflows while maintaining full control over data processing within your network. This document outlines the setup and usage of the Collate Ingestion Agent, emphasizing its role in hybrid environments and key functionalities.

### Overview  

The Collate Ingestion Agent is ideal for scenarios where running connectors on-premises is necessary, providing a secure and efficient way to process metadata within your infrastructure. This eliminates concerns about data privacy and streamlines the ingestion process.

With the Collate Ingestion Agent, you can:  
- Set up ingestion workflows easily without configuring YAML files manually.  
- Leverage the Collate UI for a seamless and user-friendly experience.  
- Manage various ingestion types, including metadata, profiling, lineage, usage, DBT, and data quality.

### Setting Up the Collate Ingestion Agent  

#### 1. Prepare Your Environment  
To begin, download the Collate-provided Docker image for the Ingestion Agent. The Collate team will provide the necessary credentials to authenticate and pull the image from the repository.  

**Run the following commands:**  
- **Log in to Docker**: Use the credentials provided by Collate to authenticate.  
- **Pull the Docker Image**: Run the command to pull the image into your local environment.  

Once the image is downloaded, you can start the Docker container to initialize the Ingestion Agent.  

#### 2. Configure the Agent  

#### Access the Local Agent UI:  
- Open your browser and navigate to the local instance of the Collate Ingestion Agent.  

#### Set Up the Connection:  
- Enter your Collate platform URL (e.g., `https://<your-company>.collate.com/api`).  
- Add the ingestion bot token from the Collate settings under **Settings > Bots > Ingestion Bot**.  

#### Verify Services:  
- Open the Collate UI and confirm that all available services (e.g., databases) are visible in the Ingestion Agent interface.  

#### 3. Add a New Service  

1. Navigate to the **Database Services** section in the Ingestion Agent UI.  
2. Click **Add New Service** and select the database type (e.g., Redshift).  
3. Enter the necessary service configuration:  
   - **Service Name**: A unique name for the database service.  
   - **Host and Port**: Connection details for the database.  
   - **Username and Password**: Credentials to access the database.  
   - **Database Name**: The target database for ingestion.  
4. Test the connection to ensure the service is properly configured.

#### 4. Run Metadata Ingestion  

1. After creating the service, navigate to the **Ingestion** tab and click **Add Ingestion**.  
2. Select the ingestion type (e.g., metadata) and specify any additional configurations:  
   - Include specific schemas or tables.  
   - Enable options like DDL inclusion if required.  
3. Choose whether to:  
   - Run the ingestion immediately via the agent.  
   - Download the YAML configuration file for running ingestion on an external scheduler.  
4. Monitor the logs in real-time to track the ingestion process.

#### 5. Verify Ingested Data  

1. Return to the Collate platform and refresh the database service.  
2. Verify that the ingested metadata, including schemas, tables, and column details, is available.  
3. Explore additional ingestion options like profiling, lineage, or data quality for the service.  

### Additional Features  

The Collate Ingestion Agent supports various ingestion workflows, allowing you to:  
- **Generate YAML Configurations**: Download YAML files for external scheduling.  
- **Manage Ingestion Types**: Run metadata, profiling, lineage, usage, and other workflows as needed.  
- **Monitor Progress**: View logs and monitor real-time ingestion activity.

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


