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
    step: 4,
    title: 'Service Created Successfully',
    description:
      'The <Service Name> has been created successfully. Visit the newly created service to take a look at the details. You can also set up the metadata ingestion.',
  },
];

const schedulingIngestionGuide = {
  step: 3,
  title: 'Schedule for Ingestion',
  description:
    'Scheduling can be set up at an hourly, daily, or weekly cadence. The timezone is in UTC. Select a Start Date to schedule for ingestion. It is optional to add an End Date.',
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
    title: 'Configure DBT Model',
    description: `A DBT model provides transformation logic that creates a table from raw data. Lineage traces the path of data across tables, but a DBT model provides specifics. 
    Select the  required DBT source provider and fill in the mandatory fields. Integrate with DBT from OpenMetadata to view the models used to generate tables.`,
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 4,
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
    step: 4,
    title: 'Usage Ingestion Added Successfully',
    description:
      'You are all set! The <Ingestion Pipeline Name> has been successfully deployed. The usage will be ingested at a regular interval as per the schedule.',
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
    step: 4,
    title: 'Profiler Ingestion Added Successfully',
    description:
      'You are all set! The <Ingestion Pipeline Name> has been successfully deployed. The profiler will run at a regular interval as per the schedule.',
  },
];
