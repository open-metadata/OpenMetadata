/*
 *  Copyright 2022 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
export const addServiceGuide = [
  {
    step: 1,
    title: 'Add a New Service',
    description: `Choose from the range of services that OpenMetadata integrates with. 
    To add a new service, start by selecting a Service Category (Database, Messaging, Dashboard, or Pipeline). 
    From the list of available services, select the one you’d want to integrate with.`,
  },
  {
    step: 2,
    title: 'Configure a Service',
    description: `Enter a unique service name. The name must be unique across the category of services. 
      For e.g., among database services, both MySQL and Snowflake cannot have the same service name (E.g. customer_data). 
      However, different service categories (dashboard, pipeline) can have the same service name. 
      Spaces are not supported in the service name. Characters like - _ are supported. Also, add a description.`,
  },
  {
    step: 3,
    title: 'Connection Details',
    description: `Every service comes with its standard set of requirements and here are the basics of what you’d need to connect. 
      The connection requirements are generated from the JSON schema for that service. The mandatory fields are marked with an asterisk.`,
  },
  {
    step: 5,
    title: 'Service Created Successfully',
    description:
      'The <Service Name> has been created successfully. Visit the newly created service to take a look at the details. You can also set up the metadata ingestion.',
  },
];

export const addServiceGuideWOAirflow = {
  title: 'Service Created Successfully',
  description:
    'The <Service Name> has been created successfully. Visit the newly created service to take a look at the details. Ensure that you have Airflow set up correctly before heading to ingest metadata.',
};

const schedulingIngestionGuide = {
  step: 4,
  title: 'Schedule for Ingestion',
  description:
    'Scheduling can be set up at an hourly, daily, or weekly cadence. The timezone is in UTC.',
};

export const addMetadataIngestionGuide = [
  {
    step: 1,
    title: 'Add Metadata Ingestion',
    description: `Based on the service type selected, enter the filter pattern details for the schema or table (database), or topic (messaging), or dashboard. 
      You can include or exclude the filter patterns. Choose to include views, enable or disable the data profiler, and ingest sample data, as required.`,
  },
  {
    step: 2,
    title: 'Configure dbt Model',
    description: `A dbt model provides transformation logic that creates a table from raw data. Lineage traces the path of data across tables, but a dbt model provides specifics. 
    Select the  required dbt source provider and fill in the mandatory fields. Integrate with dbt from OpenMetadata to view the models used to generate tables.`,
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: 'Metadata Ingestion Added Successfully',
    description:
      'You are all set! The <Ingestion Pipeline Name> has been successfully deployed. The metadata will be ingested at a regular interval as per the schedule.',
  },
];

export const addUsageIngestionGuide = [
  {
    step: 1,
    title: 'Add Usage Ingestion',
    description: `Usage ingestion can be configured and deployed after a metadata ingestion has been set up. The usage ingestion workflow obtains the query log 
    and table creation details from the underlying database and feeds it to OpenMetadata. Metadata and usage can have only one pipeline for a database service. 
    Define the Query Log Duration (in days), Stage File Location, and Result Limit to start.`,
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: 'Usage Ingestion Added Successfully',
    description:
      'You are all set! The <Ingestion Pipeline Name> has been successfully deployed. The usage will be ingested at a regular interval as per the schedule.',
  },
];

export const addLineageIngestionGuide = [
  {
    step: 1,
    title: 'Add Lineage Ingestion',
    description: `Lineage ingestion can be configured and deployed after a metadata ingestion has been set up. The lineage ingestion workflow obtains the query history,
    parses CREATE, INSERT, MERGE... queries and prepares the lineage between the involved entities. The lineage ingestion can have only one pipeline for a database service. 
    Define the Query Log Duration (in days) and Result Limit to start.`,
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: 'Lineage Ingestion Added Successfully',
    description:
      'You are all set! The <Ingestion Pipeline Name> has been successfully deployed. The lineage will be ingested at a regular interval as per the schedule.',
  },
];

export const addProfilerIngestionGuide = [
  {
    step: 1,
    title: 'Add Profiler Ingestion',
    description: `A profiler workflow can be configured and deployed after a metadata ingestion has been set up. Multiple profiler pipelines can be set up for the same database service. 
    The pipeline feeds the Profiler tab of the Table entity, and also runs the tests configured for that entity. Add a Name, FQN, and define the filter pattern to start.`,
  },
  { ...schedulingIngestionGuide },
  {
    step: 5,
    title: 'Profiler Ingestion Added Successfully',
    description:
      'You are all set! The <Ingestion Pipeline Name> has been successfully deployed. The profiler will run at a regular interval as per the schedule.',
  },
];

export const addDBTIngestionGuide = [
  {
    step: 2,
    title: 'Add dbt Ingestion',
    description: `A dbt workflow can be configured and deployed after a metadata ingestion has been set up. 
     Multiple dbt pipelines can be set up for the same database service. The pipeline feeds the dbt tab of the 
     Table entity, creates lineage from dbt nodes and adds tests from dbt. Add the source configuration of the
      dbt files to start.`,
  },
  { ...schedulingIngestionGuide },
  {
    step: 5,
    title: 'dbt Ingestion Added Successfully',
    description:
      'You are all set! The <Ingestion Pipeline Name> has been successfully deployed. The profiler will run at a regular interval as per the schedule.',
  },
];
