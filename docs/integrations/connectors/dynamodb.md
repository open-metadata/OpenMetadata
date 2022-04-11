---
description: >-
  This guide will help you install and configure the DynamoDB and run metadata
  ingestion workflows manually.
---

# DynamoDB

## **Requirements**

Using the OpenMetadata DynamoDB requires supporting services and software. Please ensure that your host system meets the requirements listed below. Then continue to follow the procedure for installing and configuring this connector.

### **OpenMetadata (version 0.8.0 or later)**

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows

If you have not already deployed OpenMetadata, please follow the instructions to [Run OpenMetadata](https://docs.open-metadata.org/install/run-openmetadata) to get up and running.

### **Python (version 3.8.0 or later)**

Please use the following command to check the version of Python you have.

```
python3 --version
```

## **Procedure**

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. [Prepare a Python virtual environment](dynamodb.md#1.-prepare-a-python-virtual-environment)
2. [Install the Python module for this connector](dynamodb.md#2.-install-the-python-module-for-this-connector)
3. [Configure your AWS default profile](dynamodb.md#3.-configure-a-local-aws-profile-optional)
4. [Create a configuration file using template JSON](dynamodb.md#4.-create-a-configuration-file-using-template-json)
5. [Configure service settings](dynamodb.md#5.-configure-service-settings)
6. [Confirm sink settings](dynamodb.md#7.-confirm-sink-settings)
7. [Confirm metadata\_server settings](dynamodb.md#8.-confirm-metadata\_server-settings)
8. [Run ingestion workflow](dynamodb.md#9.-run-ingestion-workflow)

### **1. Prepare a Python virtual environment**

In this step, we’ll create a Python virtual environment. Using a virtual environment enables us to avoid conflicts with other Python installations and packages on your host system.

In a later step, you will install the Python module for this connector and its dependencies in this virtual environment.

#### **1.1 Create a directory for openmetadata**

Throughout the docs, we use a consistent directory structure for OpenMetadata services and connector installation. If you have not already done so by following another guide, please create an openmetadata directory now and change into that directory in your command line environment.

```
mkdir openmetadata; cd openmetadata
```

#### **1.2 Create a virtual environment**

Run the following command to create a Python virtual environment called, `env`. You can try multiple connectors in the same virtual environment.

```
python3 -m venv env
```

#### **1.3 Activate the virtual environment**

Run the following command to activate the virtual environment.

```
source env/bin/activate
```

Once activated, you should see your command prompt change to indicate that your commands will now be executed in the environment named `env`.

#### **1.4 Upgrade pip and setuptools to the latest versions**

Ensure that you have the latest version of pip by running the following command. If you have followed the steps above, this will upgrade pip in your virtual environment.

```javascript
pip3 install --upgrade pip setuptools
```

### **2. Install the Python module for this connector**

Once the virtual environment is set up and activated as described in Step 1, run the following command to install the Python module for the DynamoDB connector.

```javascript
pip3 install 'openmetadata-ingestion[dynamodb]'
```

### **3. Configure your AWS default profile (optional)**

In order to use the DynamoDB connector, you will need AWS credentials configured and available to the connector. The best way to do this is by configuring your AWS default profile using the AWS Command-Line Interface (CLI). In this step we will install the AWS CLI and then configure an AWS profile.

{% hint style="info" %}
Note: If you do not have an existing AWS profile and opt not to create one, you will need to supply AWS credentials in your DynamoDB configuration file. We recommend that you use an AWS profile rather than including AWS credentials in your configuration file.
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

Please enter your access key, secret key, and region when prompted. The OpenMetadata DynamoDB connector will use the credentials from your AWS profile to connect to the right endpoint and authenticate for metadata ingestion.

#### 3c. Test access to your DynamoDB

Run the following command to ensure your AWS credentials and region are configured properly.

```
aws dynamodb list-schemas
```

In response you will either see a formatted list of schemas defined in your DynamoDB or receive a message indicating that no schemas are defined.

### **4. Create a configuration file using template JSON**

Create a new file called `dynamodb.json` in the current directory. Note that the current directory should be the `openmetadata` directory you created in Step 1.

Copy and paste the configuration template below into the `dynamodb.json` file you created.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. In the steps below we describe how to customize the key-value pairs in the `source.config` field to meet your needs.
{% endhint %}

### **5. Configure service settings**

In this step we will configure the DynamoDB service settings required for this connector. Please follow the instructions below to ensure that you’ve configured the connector to read from your DynamoDB service as desired.

{% code title="dynamodb.json" %}
```javascript
{
    "source": {
      "type": "dynamodb",
      "config": {
        "aws_access_key_id": "aws_access_key_id",
        "aws_secret_access_key": "aws_secret_access_key",
        "service_name": "DynamoDB",
        "region_name": "region_for_your_dynamodb",
        "endpoint_url": "endpoint_url",
        "db_name":"custom_database_name"
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

#### aws\_session\_token (optional)

Edit the value for `source.config.aws_session_token` to specify a session token for your DynamoDB client. This setting is optional.

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

OpenMetadata associates each database and table entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata ingested from database services you are using through DynamoDB.

Edit the value for `source.config.service_name` with a name that uniquely identifies this database and table metadata.

```json
"service_name": "unique_name_to_identify_database_and_table_metadata"
```

When the metadata has been ingested you will find it in the OpenMetadata UI databases view under the name you have specified.

#### region\_name

Specify the region in which your DynamoDB is located using `source.config.region_name`.

```javascript
"region_name": "region_for_your_dynamodb"
```

{% hint style="info" %}
Note: This setting is required even if you have configured a local AWS profile and included a value for `region_name`.
{% endhint %}

#### db\_name

Specify the database name for DynamoDB using `source.config.db_name`

```javascript
"db_name":"custom_database_name"
```

#### endpoint\_url (optional)

The DynamoDB connector will automatically determine the DynamoDB endpoint url based on the `region_name`.

You may specify a value for `source.config.endpoint_url` to override this behavior. The value you specify should be a complete url, including the protocol (i.e. “http" or "https”).

```json
"endpoint_url": "endpoint_url"
```

### **6. Confirm sink settings**

You need not make any changes to the fields defined for `sink` in the template code you copied into `dynamodb.json` in Step 4. This part of your configuration file should be as follows.

```javascript
"sink": {
    "type": "metadata-rest",
    "config": {}
},
```

### **7. Confirm metadata\_server settings**

You need not make any changes to the fields defined for `metadata_server` in the template code you copied into `dynamodb.json` in Step 4. This part of your configuration file should be as follows.

```javascript
"metadata_server": {
    "type": "metadata-server",
    "config": {
        "api_endpoint": "http://localhost:8585/api",
        "auth_provider_type": "no-auth"
    }
}
```

### **8. Run ingestion workflow**

Your `dynamodb.json` configuration file should now be fully configured and ready to use in an ingestion workflow.

To run an ingestion workflow, execute the following command from the `openmetadata` directory you created in Step 1.

```
metadata ingest -c ./dynamodb.json
```

## **Next Steps**

As the ingestion workflow runs, you may observe progress both from the command line and from the OpenMetadata user interface. To view the metadata ingested from DynamoDB, visit [http://localhost:8585/explore/tables](http://localhost:8585/explore/tables). Select the DynamoDB service to filter for the data you’ve ingested using the workflow you configured and ran following this guide. The image below provides an example.

![](<../../.gitbook/assets/next\_steps (1).png>)

## **Troubleshooting**

### **ERROR: Failed building wheel for cryptography**

When attempting to install the `openmetadata-ingestion[dynamodb]` Python package in Step 2, you might encounter the following error. The error might include a mention of a Rust compiler.

```
Failed to build cryptography
ERROR: Could not build wheels for cryptography which use PEP 517 and cannot be installed directly
```

This error usually occurs due to an older version of pip. Try upgrading pip as follows.

```
pip3 install --upgrade pip setuptools
```

Then re-run the install command in [Step 2](dynamodb.md#2.-install-the-python-module-for-this-connector).

### **requests.exceptions.ConnectionError**

If you encounter the following error when attempting to run the ingestion workflow in Step 12, this is probably because there is no OpenMetadata server running at http://localhost:8585.

```
requests.exceptions.ConnectionError: HTTPConnectionPool(host='localhost', port=8585): 
Max retries exceeded with url: /api/v1/services/databaseServices/name/dynamodb 
(Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x1031fa310>: 
Failed to establish a new connection: [Errno 61] Connection refused'))
```

To correct this problem, please follow the steps in the [Run OpenMetadata ](https://docs.open-metadata.org/install/run-openmetadata)guide to deploy OpenMetadata in Docker on your local machine.

Then re-run the metadata ingestion workflow in [Step 12](dynamodb.md#12.-run-ingestion-workflow).
