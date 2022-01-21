---
description: This page provides details on shared configuration settings for connectors.
---

# Connector Configuration

OpenMetadata connectors require a configuration file with a number of fields to specify settings for the service, data profiler, data filters, sample data, DBT, and security. See below for a simple example of a connector file.&#x20;

```json
{
  "source": {
    "type": "redshift",
    "config": {
      "host_port": "cluster.name.region.redshift.amazonaws.com:5439",
      "username": "username",
      "password": "strong_password",
      "service_name": "aws_redshift",
      "data_profiler_enabled": "false",
      "table_filter_pattern": {
        "excludes": ["[\\w]*event_vw.*"]
      },
      "schema_filter_pattern": {
        "excludes": ["information_schema.*"]
      }
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

In the sections below we describe all configuration fields and their settings.

{% hint style="info" %}
Note: The `source.config` field in the configuration JSON will include the majority of the settings for your connector. We reference this field through the service connector documentation.
{% endhint %}

## Service Settings&#x20;

Use service settings to configure your connector to read from the desired service and, optionally, database.&#x20;

#### host\_port

Use `source.config.host_port` to send the endpoint for your data service. Use the `host:port` format illustrated in the example below.&#x20;

```json
"host_port": "cluster.name.region.redshift.amazonaws.com:5439"
```

Please ensure your service is reachable from the host you are using to run metadata ingestion.

#### username

Edit the value for `source.config.username` to identify your service user.

```json
"username": "username"
```

{% hint style="danger" %}
Note: The user specified should be authorized to read all databases you want to include in the metadata ingestion workflow.
{% endhint %}

#### password

Edit the value for `source.config.password` with the password for your service user.

```json
"password": "strong_password"
```

#### service\_name

OpenMetadata uniquely identifies services by their `service_name`. Edit the value  for `source.config.service_name` with a name that distinguishes this deployment from other services from which you ingest metadata.

```json
"service_name": "aws_redshift"
```

#### database (optional)

If you want to limit metadata ingestion to a single database, include the  `source.config.database` field in your configuration file. If this field is not included, the connector will ingest metadata from all databases the specified user is authorized to read.&#x20;

To specify a single database to ingest metadata from, provide the name of the database as the value for the `source.config.database` key as illustrated in the example below.

```json
"database": "warehouse"
```

If you want to ingest metadata from two or more databases in a services but not all databases, use the `schema_filter_pattern` described below to match databases by name using regular expressions or define different workflows using separate config files for each database.

## Data Profiler Settings

The data profiler ingests usage information for tables. This enables you to assess frequency of use, reliability, and other details.&#x20;

#### data\_profiler\_enabled

When enabled, the data profiler will run as part of metadata ingestion. Running the data profiler increases the amount of time metadata ingestion requires, but provides the benefits described above.

You may disable the data profiler by including the following field in the `source.config` object of your configuration file.

```json
"data_profiler_enabled": "false"
```

If you want to enable the data profiler, update your configuration file as follows.&#x20;

```json
"data_profiler_enabled": "true"
```

{% hint style="info" %}
Note: The data profiler is enabled by default if no setting is provided for `data_profiler_enabled`.
{% endhint %}

#### data\_profiler\_offset (optional)&#x20;

Use `source.config.data_profiler_offset` to specify the row offset at which the profiler should begin scanning each table. See below for an example.&#x20;

```
"data_profiler_offset": "1000"
```

{% hint style="info" %}
Note: The key source.config.data\_profiler\_offset value is set to "0" by default.
{% endhint %}

{% hint style="info" %}
Note: The source.config.data\_profiler\_offset field will be removed in a future release of OpenMetadata.
{% endhint %}

#### data\_profiler\_limit (optional)&#x20;

Use `source.config.data_profiler_limit` to specify the row limit at which the profiler should conclude scanning each table. You may specify the profiler row limit by including a key-value pair such as the following in the source.config field of your configuration file.&#x20;

```
"data_profiler_limit": "50000" 
```

{% hint style="info" %}
Note: The value for source.config.data\_profiler\_limit is set to 50000 by default.&#x20;
{% endhint %}

{% hint style="info" %}
Note: The source.config.data\_profiler\_limit field will be removed in a future release of OpenMetadata.
{% endhint %}

## Data Filter Settings

#### include\_views (optional)

Use `source.config.include_views` to control whether or not to include views as part of metadata ingestion and data profiling.

Explicitly include views by adding the following key-value pair in the `source.config` field of your configuration file.

```json
"include_views": "true"
```

Exclude views as follows.

```json
"include_views": "false"
```

{% hint style="info" %}
Note: `source.config.include_views` is set to `true` by default.
{% endhint %}

#### include\_tables (optional)

Use `source.config.include_tables` to control whether or not to include tables as part of metadata ingestion and data profiling.

Explicitly include tables by adding the following key-value pair in the `source.config` field of your configuration file.

```json
"include_tables": "true"
```

Exclude tables as follows.

```json
"include_tables": "false"
```

{% hint style="info" %}
Note: `source.config.include_tables` is set to `true` by default.
{% endhint %}

#### table\_filter\_pattern (optional)

Use `source.config.table_filter_pattern` to select tables for metadata ingestion by name.&#x20;

Use `source.config.table_filter_pattern.excludes` to exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included. See below for an example. This example is also included in the configuration template provided.

```json
"table_filter_pattern": {
    "excludes": ["information_schema.*", "[\\w]*event_vw.*"]
}
```

Use `source.config.table_filter_pattern.includes` to include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded. See below for an example.

```json
"table_filter_pattern": {
    "includes": ["corp.*", "dept.*"]
}
```

See the documentation for the [Python re module](https://docs.python.org/3/library/re.html) for information on how to construct regular expressions.

{% hint style="info" %}
You may use either `excludes` or `includes` but not both in `table_filter_pattern.`
{% endhint %}

#### schema\_filter\_pattern (optional)

Use `source.config.schema_filter_pattern.excludes` and `source.config.schema_filter_pattern.includes` field to select schemas for metadata ingestion by name. The configuration template provides an example.

The syntax and semantics for `schema_filter_pattern` are the same as for [`table_filter_pattern`](connector-configuration.md#table\_filter\_pattern-optional). Please see that section for details on use.

## Sample Data Settings

#### generate\_sample\_data (optional)

Use the `source.config.generate_sample_data` field to control whether or not to generate sample data to include in table views in the OpenMetadata user interface. See the figure below for an example.

![](../.gitbook/assets/sample-data.png)

Explicitly include sample data by adding the following key-value pair in the `source.config` field of your configuration file.

```json
"generate_sample_data": "true"
```

If set to true, the connector will collect the first 50 rows of data from each table included in ingestion and catalog that data as sample data to which users can refer in the OpenMetadata user interface.

You can exclude collection of sample data by adding the following key-value pair in the `source.config` field of your configuration file.

```json
"generate_sample_data": "false"
```

{% hint style="info" %}
Note: `generate_sample_data` is set to `true` by default.
{% endhint %}

## DBT Settings

DBT provides transformation logic that creates tables and views from raw data. OpenMetadata includes an integration for DBT that enables you to see the models used to generate a table from that table's details page in the OpenMetadata user interface. See the figure below for an example.

![](../.gitbook/assets/dbt-tab.png)

To include DBT models and metadata in your ingestion workflows, specify the location of the DBT manifest and catalog files as fields in your configuration file.

#### dbt\_manifest\_file (optional)

Use the field `source.config.dbt_manifest_file` to specify the location of your DBT manifest file. See below for an example.

```json
"dbt_manifest_file": "./dbt/manifest.json"
```

#### dbt\_catalog\_file (optional)

Use the field `source.config.dbt_catalog_file` to specify the location of your DBT catalog file. See below for an example.

```json
"dbt_catalog_file": "./dbt/catalog.json"
```
