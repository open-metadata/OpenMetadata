---
title: Profiler Workflow
slug: /openmetadata/ingestion/workflows/profiler
---

# Profiler Workflow
Learn how to configure and run the Profiler Workflow to extract Profiler data and execute the Data Quality.
This workflow is available for ALL connectors!
## UI configuration

After the metadata ingestion has been done correctly, we can configure and deploy the Profiler Workflow.

This Pipeline will be in charge of feeding the Profiler tab of the Table Entity, as well as running any tests configured in the Entity.


<Image
    src={"/images/openmetadata/ingestion/workflows/profiler/profiler-tab-table-entity.png"}
    alt="Profiler Tab for Table entity"
    caption="Profiler tab of a Table Entity"
/>  


<Image
    src={"/images/openmetadata/ingestion/workflows/profiler/data-quality-tab-table-entity.png"}
    alt="Data Quality tab of a Table Entity"
    caption="Data Quality tab of a Table Entity"
/>  

You can learn how to configure the Data Quality of a Table Entity [here](/openmetadata/data-quality).

### 1. Add a Profiler Ingestion

From the Service Page, go to the _Ingestions_ tab to add a new ingestion and click on _Add Profiler Ingestion_.

<Image
    src={"/images/openmetadata/ingestion/workflows/profiler/add-profiler-ingestion.png"}
    alt="Add Ingestion"
    caption="Add Ingestion"
/>  

If you already added a Usage ingestion, the button will directly specify to _Add Profiler Ingestion_.

### 2. Configure the Profiler Ingestion

Here you can enter the Profiler Ingestion details.

<Image
    src={"/images/openmetadata/ingestion/workflows/profiler/profiler-workflow-details.png"}
    alt="Add Ingestion"
    caption="Add Ingestion"
/>  

#### Profiler Options

- **Name**: Define the name of the Profiler Workflow. While we only support a single workflow for the Metadata and Usage ingestion, users can define different schedules and filters for Profiler workflows. As profiling is a costly task, this enables a fine-grained approach to profiling and running tests by specifying different filters for each pipeline.
- **FQN Filter Pattern**: Regex patterns to be applied to the Tables' Fully Qualified Names. Note that Tables' FQNs are built as `serviceName.DatabaseName.SchemaName.TableName`, with a dot `.` as the FQN separator.
- **Description**: Give the Ingestion Pipeline a description to show what type of data we are profiling.


### 3. Schedule and Deploy

After clicking _Next_, you will be redirected to the Scheduling form. This will be the same as the Metadata and Usage Ingestions. Select your desired schedule and click on Deploy to find the usage pipeline being added to the Service Ingestions.
