---
title: Define the JSON Schema
slug: /developers/contribute/developing-a-new-connector/define-json-schema
---

# Define the JSON Schema

The first step when creating a new connector is to create the [JSON Schema](https://json-schema.org/) definition for the connection itself.

This is a JSON file that declares the properties we need for the connection to work, and it will be mapped to a `Java Class` on the Server, a `Python Class` on the Ingestion Framework and a `Typescript Class` on the UI. By using it we can guarantee that everywhere we have the same definition.

These files can be found in the following path:

[`openmetadata-spec/src/main/resources/json/schema/entity/services/connections`](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections)

Here you can check what the different service connections look like and get some inspiration on how to create your own.

{% note %}

**Breathe**

It can be overwhelming doing this for the first time, trying to reuse different schemas and get everything right.

It's a good idea to start little by little and repeat yourself while you get used to working with the definitions.

{% /note %}

## Connection File Anatomy

In order to go through the connection file anatomy, we are going to take a look at the [`mysqlConnection.json`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/mysqlConnection.json)

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=1 %}

* **$id**: Here we are basically referencing the file itself. You will need to change the path to the path for your connection.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

* **title**: Here we need to define the name of the schema. The standard is to use the filename in camelcase. So if you are creating a connection called `ownConnection.json` the title would be `OwnConnection`.
* **description**: Here we also add a small description that explains what the JSON Schema is for.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

* **javaType**: Here we also need to define the javaType this JSONSchema will become. This will also depend on the connection name like the title.

{% note %}
**Info**

Please note that the javaType path is similar to the filepath for the JSON Schema but not the same.

The standard is as follows:


`org.openmetadata.schema.services.connections.{source_type}.{title}`


where
- `{source_type}` depends on the Connector you are building (Database, Dashboard, etc)
- `{title}` is the title attribute from this json file.
{% /note %}

{% /codeInfo %}

{% codeInfo srNumber=4 %}

* **definitions**: Here you can place JSON Schemas that you can reference later within the `properties` attribute.
On this connector we can see two different definitions:

    - **mySQLType**: This definition is a standard for all connectors and it defines which is the Service Type for a given connection.

    If you are creating a connection called `ownConnection.json` you could create a definition like:
    ```json
    "ownType": {
        "description": "Service Type.",
        "type": "string",
        "enum": ["Own"],
        "default": "Own"
    }
    ```

    - **mySQLScheme**: This definition is specific for the connections that use [SQLAlchemy](https://www.sqlalchemy.org/) underneath and it is used to define which is the driver scheme to be used.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

* **properties**: Here we actually define the attributes that our connection will have. In order to understand better what you need to define here we are going to go through a few of the attributes.

    - **type**: As mentioned in the **definitions** section, we define the Service Type. But in order to actually use it we need to reference it in a property. This is exactly what we do here.

    {% note %}
    In order to reference another JSON Schema we use the `$ref` attribute. This will basically put the entire JSON Schema in place and update/add any attributes defined here.
    {% /note %}

    - **authType**: This property is insteresting because it allows us to showcase two different features.
        - **$ref**: As explained above, this attribute is used to reference another JSON Schema. But in this case you can see it being used within the **oneOf** attribute referencing an external JSON Schema and not a definition.

        {% note %}
        When referencing a definition we use the following pattern: `#/definitions/myDefinition`
        When referencing an external JSONSchema we use relative paths: `../common/ownSchema.json`
        {% /note %}

        - **oneOf**: This property allows us to actually have a list of different types that are valid. It is used when there are multiple different ways a configuration might appear.

        On this example we can see it references both `./common/basicAuth.json` and `./common/iamAuthConfig.json`.
        It is this way because we could Authenticate to MySQL either by using the `basicAuth` (Username/Password) or by using `iamAuth` if we are actually running [MySQL as a RDS in AWS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)

    - **supportsMetadataExtraction**: We can also see a couple of different properties that showcase the features this connector supports (**supportsMetadataExtraction**, **supportsDBTExtraction**, **supportsProfiler**, **supportsQueryComment**) They are all different features from OpenMetadata that are not necessarily supported by all connectors.

    The most basic case is **supportsMetadataExtraction** and we should always start from there.

    {% note %}
    Here we can also see `$ref` being used to reference a `definition` on another schema: `../connectionBasicType.json#/definitions/supportsMetadataExtraction`
    {% /note %}

{% /codeInfo %}

{% codeInfo srNumber=6 %}

* **additionalProperties**: To avoid werid behavior, we always prevent additionalProperties to be passed to the schema by setting this parameter to false.

* **required**: Here we can define any properties that are always required or the schema would be invalid otherwise

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="mysqlConnection.json" %}

```json
{
```
```json {% srNumber=1 %}
"$id": "https://open-metadata.org/schema/entity/services/connections/database/mysqlConnection.json",
```
```json
  "$schema": "http://json-schema.org/draft-07/schema#",
```
```json {% srNumber=2 %}
"title": "MysqlConnection",
"description": "Mysql Database Connection Config",
```
```json
  "type": "object",
```
```json {% srNumber=3 %}
"javaType": "org.openmetadata.schema.services.connections.database.MysqlConnection",
```
```json {% srNumber=4 %}
"definitions": {
    "mySQLType": {
      "description": "Service type.",
      "type": "string",
      "enum": ["Mysql"],
      "default": "Mysql"
    },
    "mySQLScheme": {
      "description": "SQLAlchemy driver scheme options.",
      "type": "string",
      "enum": ["mysql+pymysql"],
      "default": "mysql+pymysql"
    }
  },
```
```json {% srNumber=5 %}
"properties": {
    "type": {
      "title": "Service Type",
      "description": "Service Type",
      "$ref": "#/definitions/mySQLType",
      "default": "Mysql"
    },
    "scheme": {
      "title": "Connection Scheme",
      "description": "SQLAlchemy driver scheme options.",
      "$ref": "#/definitions/mySQLScheme",
      "default": "mysql+pymysql"
    },
    "username": {
      "title": "Username",
      "description": "Username to connect to MySQL. This user should have privileges to read all the metadata in Mysql.",
      "type": "string"
    },
    "authType": {
      "title": "Auth Configuration Type",
      "description": "Choose Auth Config Type.",
      "oneOf": [
        {
          "$ref": "./common/basicAuth.json"
        },
        {
          "$ref": "./common/iamAuthConfig.json"
        }
      ]
    },
    "hostPort": {
      "title": "Host and Port",
      "description": "Host and port of the MySQL service.",
      "type": "string"
    },
    "databaseName": {
      "title": "Database Name",
      "description": "Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.",
      "type": "string"
    },
    "databaseSchema": {
      "title": "Database Schema",
      "description": "Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.",
      "type": "string"
    },
    "sslCA": {
      "title": "SSL CA",
      "description": "Provide the path to ssl ca file",
      "type": "string"
    },
    "sslCert": {
      "title": "SSL Client Certificate File",
      "description": "Provide the path to ssl client certificate file (ssl_cert)",
      "type": "string"
    },
    "sslKey": {
      "title": "SSL Client Key File",
      "description": "Provide the path to ssl client certificate file (ssl_key)",
      "type": "string"
    },
    "connectionOptions": {
      "title": "Connection Options",
      "$ref": "../connectionBasicType.json#/definitions/connectionOptions"
    },
    "connectionArguments": {
      "title": "Connection Arguments",
      "$ref": "../connectionBasicType.json#/definitions/connectionArguments"
    },
    "supportsMetadataExtraction": {
      "title": "Supports Metadata Extraction",
      "$ref": "../connectionBasicType.json#/definitions/supportsMetadataExtraction"
    },
    "supportsDBTExtraction": {
      "$ref": "../connectionBasicType.json#/definitions/supportsDBTExtraction"
    },
    "supportsProfiler": {
      "title": "Supports Profiler",
      "$ref": "../connectionBasicType.json#/definitions/supportsProfiler"
    },
    "supportsQueryComment": {
      "title": "Supports Query Comment",
      "$ref": "../connectionBasicType.json#/definitions/supportsQueryComment"
    },
    "sampleDataStorageConfig": {
      "title": "Storage Config for Sample Data",
      "$ref": "../connectionBasicType.json#/definitions/sampleDataStorageConfig"
    }
  },
```
```json {% srNumber=6 %}
"additionalProperties": false,
"required": ["hostPort", "username"]
```
```json
}
```

{% /codeBlock %}

{% /codePreview %}

## Making the new Connection configuration available to the Service

Once the connection file is properly created, we still need to take one extra step to make it available for the Service.

{% note %}
**Note**

The connection is part of a Service (Dashboard, Database, Messaging, etc) and this step should be done on the correct service.
{% /note %}

Following with the `mysqlConnection.json` example, we now need to make it available to the `Database Service` by updating the [`databaseService.json`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/databaseService.json) file within [`openmetadata-spec/src/main/resources/json/schema/entity/services`](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/entity/services)
{% note %}
The file will be shortened and parts of it will be replaced with `...` for readability.
{% /note %}

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=7 %}

* **databaseServiceType**: Here we need to add our connector type to the `enum` and `javaEnums` properties. It should be the same value as the `type` property that we defined on the JSON Schema.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

* **databaseConnection**: Here we need to point to our JSON Schema within the `config` property by adding it to the `oneOf` list.

{% /codeInfo %}


{% /codeInfoContainer %}

{% codeBlock fileName="mysqlConnection.json" %}
```json
{
  "$id": "https://open-metadata.org/schema/entity/services/databaseService.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Database Service",
  "description": "This schema defines the `Database Service` is a service such as MySQL, BigQuery, Redshift, Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server instance are also used for database service.",
  "type": "object",
  "javaType": "org.openmetadata.schema.entity.services.DatabaseService",
  "javaInterfaces": [
    "org.openmetadata.schema.EntityInterface",
    "org.openmetadata.schema.ServiceEntityInterface"
  ],
  "definitions": {
```
```json {% srNumber=7 %}
  "databaseServiceType": {
      "description": "Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...",
      "javaInterfaces": ["org.openmetadata.schema.EnumInterface"],
      "type": "string",
      "enum": [
        ...
        "Mysql"
      ],
      "javaEnums": [
        ...
        {
          "name": "Mysql"
        }
      ]
    },
```
```json {% srNumber=8 %}
  "databaseConnection": {
      "type": "object",
      "description": "Database Connection.",
      "javaInterfaces": [
        "org.openmetadata.schema.ServiceConnectionEntityInterface"
      ],
      "properties": {
        "config": {
          "mask": true,
          "oneOf": [
            ...
            {
              "$ref": "./connections/database/mysqlConnection.json"
            }
          ]
        }
      },
      "additionalProperties": false
    }
```
```json
  },
  ...
}
```
{% /codeBlock %}

{% /codePreview %}

## Next Step

Now that you have your Connection defined in the JSON Schema, we can proceed to actually implement the Python Code to perform the Ingestion.

{%inlineCallout
  color="violet-70"
  bold="Develop the Ingesion Code"
  icon="MdArrowForward"
  href="/developers/contribute/developing-a-new-connector/develop-ingestion-code"%}
  Learn what you need to implement for the Connector's logic
{%/inlineCallout%}
