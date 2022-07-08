---
description: >-
  Learn how to configure and run the Profiler Workflow to extract Profiler data
  and execute the Data Quality.
---

# Profiler Workflow

This workflow is available for ALL connectors!

## UI configuration

After the metadata ingestion has been done correctly, we can configure and deploy the Profiler Workflow.

This Pipeline will be in charge of feeding the Profiler tab of the Table Entity, as well as running any tests configured in the Entity.

![Profiler tab of a Table Entity](<../.gitbook/assets/image (27).png>)

![Data Quality tab of a Table Entity](<../.gitbook/assets/image (77).png>)

You can learn how to configure the Data Quality of a Table Entity [here](broken-reference).

### 1. Add a Profiler Ingestion

From the Service Page, go to the _Ingestions_ tab to add a new ingestion and click on _Add Profiler Ingestion_.

![Add Ingestion](<../.gitbook/assets/image (92).png>)

If you already added a Usage ingestion, the button will directly specify to _Add Profiler Ingestion_.

### 2. Configure the Profiler Ingestion

Here you can enter the Profiler Ingestion details.

![Profiler Workflow Details](<../.gitbook/assets/image (195).png>)

<details>

<summary>Profiler Options</summary>

**Name**

Define the name of the Profiler Workflow. While we only support a single workflow for the Metadata and Usage ingestion, users can define different schedules and filters for Profiler workflows.

As profiling is a costly task, this enables a fine-grained approach to profiling and running tests by specifying different filters for each pipeline.

**FQN Filter Pattern**

Regex patterns to be applied to the Tables' Fully Qualified Names. Note that Tables' FQNs are built as `serviceName.DatabaseName.SchemaName.TableName`, with a dot `.` as the FQN separator.

**Description**

Give the Ingestion Pipeline a description to show what type of data we are profiling.

</details>

### 3. Schedule and Deploy

After clicking _Next_, you will be redirected to the Scheduling form. This will be the same as the Metadata and Usage Ingestions. Select your desired schedule and click on Deploy to find the usage pipeline being added to the Service Ingestions.

## YAML Configuration

In the [connectors](../integrations/connectors/) section we showcase how to run the metadata ingestion from a JSON file using  the Airflow SDK or the CLI via `metadata ingest`. Running a profiler workflow is also possible using a JSON configuration file.&#x20;

This is a good option if you which to execute your workflow via the Airflow SDK or using the CLI. The `serviceConnection` config will be specific to your connector (you can find more information in the [connectors](../integrations/connectors/) section), though the `sourceConfig` for the profiler will be similar across all connectors.

```
  [...]
  sourceConfig:
    config:
      type: Profiler
      generateSampleData: true
      fqnFilterPattern:
        includes: 
          - <fqn>
        excludes: 
          - <fqn>
  [...]
```

##
