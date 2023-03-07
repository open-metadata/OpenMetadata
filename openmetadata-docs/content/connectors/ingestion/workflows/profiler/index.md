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
    src={"/images/openmetadata/ingestion/workflows/profiler/profiler-summary-table.png"}
    alt="Table profile summary page"
    caption="Table profile summary page"
/>

<Image
    src={"/images/openmetadata/ingestion/workflows/profiler/profiler-summary-colomn.png"}
    alt="Column profile summary page"
    caption="Column profile summary page"
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

**Database filter pattern (Optional)**
regex expression to filter databases.

**Schema filter pattern (Optional)**
regex expression to filter schemas.

**Table filter pattern (Optional)**
regex expression to filter tables.

**Profile Sample (Optional)**
Set the sample to be use by the profiler for the specific table.
- `Percentage`: Value must be between 0 and 100 exclusive (0 < percentage < 100). This will sample the table based on a percentage
- `Row Count`: The table will be sampled based on a number of rows (i.e. `1,000`, `2,000`), etc.

**Thread Count (Optional)**
Number of thread to use when computing metrics for the profiler. For Snowflake users we recommend setting it to 1. There is a known issue with one of the dependency (`snowflake-connector-python`) affecting projects with certain environments. 

**Auto PII Tag**
Here, the sample data will be analysed to determine appropriate PII tags for each column.
For more information click [here](/connectors/ingestion/auto_tagging)

**Timeout in Seconds (Optional)**
This will set the duration a profiling job against a table should wait before interrupting its execution and moving on to profiling the next table. It is important to note that the profiler will wait for the hanging query to terminiate before killing the execution. If there is a risk for your profiling job to hang, it is important to also set a query/connection timeout on your database engine. The default value for the profiler timeout is 12-hours.

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
**Profile Sample**
Set the sample to be use by the profiler for the specific table.
- `Percentage`: Value must be between 0 and 100 exclusive (0 < percentage < 100). This will sample the table based on a percentage
- `Row Count`: The table will be sampled based on a number of rows (i.e. `1,000`, `2,000`), etc.

**Profile Sample Query**
Use a query to sample data for the profiler. This will overwrite any profle sample set.

**Enable Column Profile**
This setting allows user to exclude or include specific columns and metrics from the profiler.

*Note: for Google BigQuery tables partitioned on timestamp/datetime column type, month and year interval are not supported. You will need to set the `Interval Unit` to `DAY` or `HOUR`.*

**Enable Partition**
If your table includes a timestamp, date or datetime column type you can enable partitionning. If enabled, the profiler will fetch the last `<interval>` `<interval unit>` of data to profile the table. Note that if "profile sample" is set, this configuration will be used against the partitioned data and not the whole table.
- `Column Name`: this is the name of the column that will be used as the partition field
- `Interval Type`:
  - `TIME-UNIT`: a business logical timestamp/date/datetime (e.g. order date, sign up datetime, etc.)
  - `INGESTION-TIME`: a process logical timestamp/date/datetime (i.e. when was my data ingested in my table)
- `Interval`: the interval value (e.g. `1`, `2`, etc.)
- `Interval Unit`: 
  - `HOUR`
  - `DAY`
  - `MONTH`
  - `YEAR`


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
      profileSampleType: ROWS
      #profileSampleType: PERCENTAGE
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
