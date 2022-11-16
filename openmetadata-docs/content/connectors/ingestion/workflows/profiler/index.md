---
title: Profiler Workflow
slug: /connectors/ingestion/workflows/profiler
---

# Profiler Workflow

Learn how to configure and run the Profiler Workflow to extract Profiler data and execute the Data Quality.

## UI configuration
After the metadata ingestion has been done correctly, we can configure and deploy the Profiler Workflow.

This Pipeline will be in charge of feeding the Profiler tab of the Table Entity, as well as running any tests configured in the Entity.

<Image
    src={"/images/openmetadata/ingestion/workflows/profiler/profiler-summary.png"}
    alt="Profiler summary page"
    caption="Profiler summary page"
/>


### 1. Add a Profiler Ingestion
From the Service Page, go to the Ingestions tab to add a new ingestion and click on Add Profiler Ingestion.

<Image
    src={"/images/openmetadata/ingestion/workflows/profiler/add-profiler-workflow.png"}
    alt="Add a profiler service"
    caption="Add a profiler service"
/>

### 2. Configure the Profiler Ingestion
Here you can enter the Profiler Ingestion details.

<Image
    src={"/images/openmetadata/ingestion/workflows/profiler/configure-profiler-workflow.png"}
    alt="Set profiler configuration"
    caption="Set profiler configuration"
/>

#### Profiler Options
**Name**
Define the name of the Profiler Workflow. While we only support a single workflow for the Metadata and Usage ingestion, users can define different schedules and filters for Profiler workflows.

As profiling is a costly task, this enables a fine-grained approach to profiling and running tests by specifying different filters for each pipeline.

**Database filter pattern**
regex expression to filter databases.

**Schema filter pattern**
regex expression to filter schemas.

**Table filter pattern**
regex expression to filter tables.

**Profile Sample**
Sampling percentage to apply for profiling tables.

**Thread Count**
Number of thread to use when computing metrics for the profiler. For Snowflake users we recommend setting it to 1. There is a known issue with one of the dependency (`snowflake-connector-python`) affecting projects with certain environments. 

**Ingest Sample Data**
Whether the profiler should ingest sample data

### 3. Schedule and Deploy
After clicking Next, you will be redirected to the Scheduling form. This will be the same as the Metadata and Usage Ingestions. Select your desired schedule and click on Deploy to find the usage pipeline being added to the Service Ingestions.

### 4. Updating Profiler setting at the table level
Once you have created your profiler you can adjust some behavior at the table level by going to the table and clicking on the profiler tab 

<Image
    src={"/images/openmetadata/ingestion/workflows/profiler/accessing-table-profile-settings.png"}
    alt="table profile settings"
    caption="table profile settings"
/>

<Image
    src={"/images/openmetadata/ingestion/workflows/profiler/table-profile-summary-view.png"}
    alt="table profile settings"
    caption="table profile settings"
/>

#### Profiler Options
**Profile Sample %**
Set the sample percentage to be use by the profiler for the specific table. This will overwrite the workflow sample percentage.

**Profile Sample Query**
Use a query to sample data for the profiler. This will overwrite any profle sample set.

**Enable Column Profile**
This setting allows you exclude or include specific column from the profiler. It also allows you to exclude the computation of specific metrics.


## YAML Configuration

In the [connectors](/connectors) section we showcase how to run the metadata ingestion from a JSON file using the Airflow SDK or the CLI via metadata ingest. Running a profiler workflow is also possible using a JSON configuration file.

This is a good option if you which to execute your workflow via the Airflow SDK or using the CLI; if you use the CLI a profile workflow can be triggered with the command `metadata profile -c FILENAME.yaml`. The `serviceConnection` config will be specific to your connector (you can find more information in the [connectors](/connectors) section), though the sourceConfig for the profiler will be similar across all connectors.

```yaml

  [...]
  sourceConfig:
    config:
      type: Profiler
      generateSampleData: true
      profileSample: 60
      databaseFilterPattern: 
        includes: 
          - dev
      schemaFilterPattern:
        includes: 
          - dbt_jaffle
      tableFilterPattern:
        includes: 
          - orders
          - customers
  [...]
```
