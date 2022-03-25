---
description: In this section, we provide guides and reference to use the Glue connector.
---

# Glue Catalog

1. [Requirements](./#1.-requirements)
2. [Install Glue Connector](./#2.-install-glue-connector)
3. [Configure your AWS default profile (optional)](./#3.-configure-your-aws-default-profile-optional)
4. [Configure Glue Connector](./#4.-configure-glue-connector)
5. [Run Glue Connector](./#5.-run-glue-connector)

## **1. Requirements**

Please ensure that your host system meets the requirements listed below.

### **OpenMetadata (version 0.9.0 or later)**

To deploy OpenMetadata, follow the procedure [Try OpenMetadata in Docker](../../../overview/run-openmetadata/).

### **Python (version 3.8.0 or later)**

Use the following command to check your Python version.

```
python3 --version
```

## 2. Install Glue Connector

### **2.1 Prepare a Python virtual environment**

In this step, we’ll create a Python virtual environment. Using a virtual environment enables us to avoid conflicts with other Python installations and packages on your host system.

In a later step, you will install the Python module for this connector and its dependencies in this virtual environment.

#### **1 Create a directory for openmetadata**

Throughout the docs, we use a consistent directory structure for OpenMetadata services and connector installation. If you have not already done so by following another guide, please create an openmetadata directory now and change into that directory in your command line environment.

```
mkdir openmetadata; cd openmetadata
```

#### **2 Create a virtual environment**

Run the following command to create a Python virtual environment called, `env`. You can try multiple connectors in the same virtual environment.

```
python3 -m venv env
```

#### **3 Activate the virtual environment**

Run the following command to activate the virtual environment.

```
source env/bin/activate
```

Once activated, you should see your command prompt change to indicate that your commands will now be executed in the environment named `env`.

#### **4 Upgrade pip and setuptools to the latest versions**

Ensure that you have the latest version of pip by running the following command. If you have followed the steps above, this will upgrade pip in your virtual environment.

```javascript
pip3 install --upgrade pip setuptools
```

### **2.2 Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for the Glue connector.

```javascript
pip3 install 'openmetadata-ingestion[glue]'
```

## 3. **Configure your AWS default profile (optional)**

In order to use the Glue Catalog connector, you will need AWS credentials configured and available to the connector. The best way to do this is by configuring your AWS default profile using the AWS Command-Line Interface (CLI). In this step we will install the AWS CLI and then configure an AWS profile.

{% hint style="info" %}
Note: If you do not have an existing AWS profile and opt not to create one, you will need to supply AWS credentials in your Glue catalog configuration file. We recommend that you use an AWS profile rather than including AWS credentials in your configuration file.
{% endhint %}

#### 3a. Install the AWS CLI

To install the AWS CLI, follow the installation guide for your operating system from the [AWS documentation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

#### 3b. Configure your AWS default profile

With the AWS CLI installed, to configure your AWS profile run the following command.

```bash
aws configure
```

Then enter the appropriate values at the prompts to complete your profile. Your interaction with the `aws configure` command should look something like the following.

```bash
$ aws configure
AWS Access Key ID [None]: <your accesskey>
AWS Secret Access Key [None]: <your secretkey>
Default region name [None]: <your region, e.g., us-west-2>
Default output format [None]:
```

Please enter your `Access Key`, `Secret Key`, and `Region` when prompted. The OpenMetadata Glue Catalog connector will use the credentials from your AWS profile to connect to the right endpoint and authenticate for metadata ingestion.

#### 3c. Test access to your Glue catalog

Run the following command to ensure your AWS credentials and region are configured properly.

```
aws glue list-schemas
```

In response you will either see a formatted list of schemas defined in your Glue catalog or receive a message indicating that no schemas are defined.

## 4. Configure Glue Connector

Please follow the steps relevant to your use case.

1. [Create a configuration file using template JSON](./#4.1-create-a-configuration-file-using-template-json)
2. [Configure service settings](./#4.2-configure-service-settings)
3. [Configure data filters (optional)](./#4.3-configure-data-filters-optional)
4. [Confirm sink settings](./#4.4-confirm-sink-settings)
5. [Confirm metadata\_server settings](./#4.5-confirm-metadata\_server-settings)

### **4.1 Create a configuration file using template JSON**

Create a new file called `glue.json` in the current directory. Note that the current directory should be the `openmetadata` directory.

Copy and paste the configuration template below into the `glue.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

{% code title="glue.json" %}
```javascript
{
  "source": {
    "type": "glue",
    "config": {
      "aws_session_token": "session_token",
      "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
      "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "service_name": "unique_name_to_identify_database_and_table_metadata",
      "pipeline_service_name": "unique_name_to_identify_pipeline_metadata",
      "storage_service_name": "unique_name_to_identify_storage_service_metadata",
      "region_name": "us-east-2",
      "endpoint_url": "glue.us-east-2.amazonaws.com"
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}
```
{% endcode %}

### **4.2 Configure service settings**

In this step we will configure the Glue service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your Glue service as desired.

#### aws\_session\_token (optional)

Edit the value for `source.config.aws_session_token` to specify a session token for your Glue client. This setting is optional.

See [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id\_credentials\_temp\_use-resources.html) for documentation on using AWS session tokens.

```json
"aws_session_token": "session_token"
```

{% hint style="info" %}
Note: While you cannot configure a session token using the `aws configure` command (see Step 3 above), you can edit the `~/.aws/credentials` file to manually add a session token. See [Configuration and credential file settings](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html) for more details.
{% endhint %}

#### aws\_access\_key\_id (optional)

Edit the value for `source.config.aws_access_key_id` to specify the key id for your AWS user. This setting is optional.

```json
"aws_access_key_id": "AKIAIOSFODNN7EXAMPLE"
```

{% hint style="info" %}
Note: We recommend that you use a local AWS profile containing your access key id and secret access key rather than including these values in your configuration file.
{% endhint %}

#### aws\_secret\_access\_key (optional)

Edit the value for `source.config.aws_secret_access_key` to specify the secret for your AWS user. This setting is optional.

```json
"aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

{% hint style="info" %}
Note: We recommend that you use a local AWS profile containing your access key id and secret access key rather than including these values in your configuration file.
{% endhint %}

#### service\_name

OpenMetadata associates each database and table entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata ingested from database services you are using through AWS Glue.

Edit the value for `source.config.service_name` with a name that uniquely identifies this database and table metadata.

```json
"service_name": "unique_name_to_identify_database_and_table_metadata"
```

When the metadata has been ingested you will find it in the OpenMetadata UI databases view under the name you have specified.

#### pipeline\_service\_name

OpenMetadata associates each pipeline entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for pipelines you are using through AWS Glue.

Edit the value for `source.config.pipeline_service_name` with a name that uniquely identifies this pipeline metadata.

```json
"pipeline_service_name": "unique_name_to_identify_pipeline_metadata"
```

When this metadata has been ingested you will find it in the OpenMetadata UI pipelines view under the name you have specified.

#### storage\_service\_name (optional)

OpenMetadata associates objects for each object store entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for the object stores you are using through AWS Glue.

Edit the value for `source.config.storage_service_name` with a name that uniquely identifies this object store metadata.

```json
"storage_service_name": "unique_name_to_identify_storage_service_metadata"
```

#### region\_name

Specify the region in which your Glue catalog is located using `source.config.region_name`.

```
"region_name": "region_for_your_glue_catalog"
```

{% hint style="info" %}
Note: This setting is required even if you have configured a local AWS profile and included a value for `region_name`.
{% endhint %}

#### endpoint\_url (optional)

The Glue connector will automatically determine the AWS Glue endpoint url based on the `region_name`.

You may specify a value for `source.config.endpoint_url` to override this behavior. The value you specify should be a complete url, including the protocol (i.e. “http" or "https”).

```json
"endpoint_url": "endpoint_url"
```

### **4.3 Configure data filters (optional)**

**table\_filter\_pattern (optional)**

Use `source.config.table_filter_pattern` to select tables for metadata ingestion by name.

Use `source.config.table_filter_pattern.excludes` to exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included. See below for an example. This example is also included in the configuration template provided.

```javascript
"table_filter_pattern": {
"excludes": ["information_schema.*", "[\\w]*event_vw.*"]
}
```

Use `source.config.table_filter_pattern.includes` to include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded. See below for an example.

```javascript
"table_filter_pattern": {
"includes": ["corp.*", "dept.*"]
}
```

See the documentation for the[ Python re module](https://docs.python.org/3/library/re.html) for information on how to construct regular expressions.

{% hint style="info" %}
You may use either `excludes` or `includes` but not both in `table_filter_pattern`.
{% endhint %}

### **4.4 Confirm `sink` settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `glue.json` in Step 4. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```

### **4.5 Confirm `metadata_server` settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `glue.json` in Step 4. This part of your configuration file should be as follows.

```javascript
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```

## **5. Run Glue Connector**

Your `glue.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory you created in Step 1.

```
metadata ingest -c ./glue.json
```

### **Setup Glue connector in production (optional)**

If you already have a production Airflow instance on which you would like to schedule OpenMetadata ingestion workflows, follow the procedure [Ingest Metadata in Production](../../ingest-metadata-in-production.md).

## **Next Steps**

To view the metadata ingested from Glue, visit [http://localhost:8585/explore/tables](http://localhost:8585/explore/tables). Select the Glue service to filter for the data you’ve ingested using the workflow you configured and ran following this guide.

![](../../../.gitbook/assets/explore.png)

### **ERROR: Failed building wheel for cryptography**

When attempting to install the `openmetadata-ingestion[glue]` Python package in Step 2, you might encounter the following error. The error might include a mention of a Rust compiler.

```
Failed to build cryptography
ERROR: Could not build wheels for cryptography which use PEP 517 and cannot be installed directly
```

```
pip3 install --upgrade pip setuptools
```

Then re-run the install command in [Step 2](./#2.-install-the-python-module-for-this-connector).

### **requests.exceptions.ConnectionError**

If you encounter the following error when attempting to run the ingestion workflow, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/glue 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, follow the procedure [Try OpenMetadata in Docker](../../../overview/run-openmetadata/) to deploy OpenMetadata.

Then re-run the metadata ingestion workflow in [Run Glue Connector](./#5.-run-glue-connector).
