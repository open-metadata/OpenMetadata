/*
 *  Copyright 2022 Collate.
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

/* eslint-disable max-len */

export const LATEST_VERSION_ID = 12;

export const COOKIE_VERSION = 'VERSION_0_13_2'; // To be changed with each release.

// for youtube video make isImage = false and path = {video embed id}
// embed:- youtube video => share => click on embed and take {url with id} from it

export const WHATS_NEW = [
  {
    id: 0,
    version: 'v0.4.0',
    description: 'Released on 20 Sept 2021.',
    features: [
      {
        title: 'Dashboards',
        description:
          'In 0.4.0 release, Users can now integrate dashboard services, such as Apache Superset, Tableau, and Looker, and discover dashboards and charts in their organizations in a single place along with other data assets., Similar to Tables and Databases, users can describe the dashboard, tier them, add tags, and ownership.',
        isImage: false,
        path: 'https://www.youtube.com/embed/131LfI0eMNc',
      },
      {
        title: 'Messaging service',
        description:
          'Users can also integrate with messaging services, such as Apache Kafka (and Apache Pulsar in progress) to discover Topics. Our Message Queue connectors extractTopic configurations, cluster information, and schemas from Apache Kafka and Confluent’s Schema Registry to provide all important information at your fingertips. Users can provide rich descriptions, tiering, ownership, and tags to the topics through the UI or APIs.',
        isImage: false,
        path: 'https://www.youtube.com/embed/vHM99KC2A2w',
      },
      {
        title: 'Data Profiler & Sample Data',
        description:
          'The Data Profiler is a new feature that generates a data profile for a table during the ingestion process. The data profile will include information that will help understand data quality, such as data uniqueness, null counts, max and min, etc. The Data Sampler will collect sample data from an ingested table so that it can be subsequently used to get a sense of the data',
        isImage: false,
        path: 'https://www.youtube.com/embed/0NKBPWUcG9M',
      },
    ],
    changeLogs: {
      OpenMetadata: `- Support for Kafka (and Pulsar WIP)\n- Support for Message Service and Topic entities in schemas, APIs, and UI\n- Kafka connector and ingestion support for Confluent Schema Registry\n- Support for Dashboards\n- Support for Dashboard services, Dashboards, and Charts entities in schemas, APIs, and UI\n- Looker, Superset, Tableau connector, and ingestion support`,
      'Data Quality': `- Data Profiler - The Data Profiler is a new feature that generates a data profile for a table during the ingestion process. The data profile will include information that will help understand data quality, such as data uniqueness, null counts, max and min\n - Sample Data, The Data Sampler will collect sample data from an ingested table so that it can be subsequently used to get a sense of the data.`,
      'Other features': `- Pluggable SSO integration - Auth0 support\n- Support for Presto`,
      'User Interface': `- Sort search results based on Usage, Relevance, and Last updated time\n- Search string highlighted in search results\n- Support for Kafka and Dashboards from Looker, SuperSet, and Tableau`,
      'Work in progress': `- Salesforce CRM connector\n- Data profiler to profile tables in ingestion framework and show it table details page\n- Redash dashboard connector`,
    },
  },
  {
    id: 1,
    version: 'v0.5.0',
    description: 'Released on 19 Oct 2021.',
    features: [
      {
        title: 'Lineage',
        description:
          'Schema and API support for Lineage.\n\nUI integration to show the lineage for Pipelines and Tables.\n\nIngestion support for Airflow to capture lineage.',
        isImage: false,
        path: 'https://www.youtube.com/embed/8-CwuKsf8Oc',
      },
      {
        title: 'Data Profiler',
        description:
          'In 0.5 release we are enhancing data profiler integration. UI now visualizes data profiler details. Users can understand column data in a table.',
        isImage: false,
        path: 'https://www.youtube.com/embed/FRP_bgWbZCc',
      },
      {
        title: 'Pipelines',
        description:
          'Pipelines are new entity addition to OpenMetadata. Add Airflow as a service ingest all pipelines metadata into OpenMetadata. Explore and Discover all your pipelines in single place.',
        isImage: false,
        path: 'https://www.youtube.com/embed/V7rYKdJe67U',
      },
      {
        title: 'Complex Types',
        description:
          'With 0.5 release we are supporting Complex Types in table schema through APIs and ingestion now supports Redshift, BigQuery, Snowflake, Hive to extract complex data types. UI Integration will allow users to expand and add description, tags to nested fields.',
        isImage: false,
        path: 'https://www.youtube.com/embed/35XfeP2--b4',
      },
      {
        title: 'Trino & Redash',
        description: 'We added two new connectors, Trino and Redash.',
        isImage: false,
        path: 'https://www.youtube.com/embed/Tugbk6_uELY',
      },
    ],
    changeLogs: {
      Lineage: `- Schema and API support for Lineage\n- UI integration to show the lineage for Pipelines  and Tables\n- Ingestion support for Airflow to capture lineage`,
      'Data Reliability': `- UI Integration for Data profiler\n- Unique , Null proportion\n- See how the table data grows through interactive visualization`,
      'New Entities: Pipeline': `- Add Apache Airflow as a pipeline service\n- Ingest all of your pipeline's metadata into OpenMetadata\n- Explore and Search Pipelines\n- Add description, tags, ownership and tier your pipelines`,
      'Complex Data types': `- Schema and API support to capture complex data types\n- Ingestion support to capture complex data types from Redshift, BigQuery, Snowflake and Hive\n- UI Support for nested complex data types, users can add description, tags to nested fields`,
      'New Connectors': `- Trino connector\n- Redash connector\n- Amazon Glue - In progress`,
      'User Interface': `- UI now completely built on top of JsonSchema generated code\n- Expand complex data types and allow users to update descriptions and tags\n- Pipeline Service and Details page\n- Pipeline Explore & Search integration\n- Search results will show if the query matches description or column names, description `,
    },
  },
  {
    id: 2,
    version: 'v0.6.0',
    description: 'Released on 17 Nov 2021.',
    features: [
      {
        title: 'Metadata Versioning',
        description:
          'OpenMetadata captures the changes in metadata as new versions of an entity. The version history for all entities is maintained in the Major.Minor number.',
        isImage: false,
        path: 'https://www.youtube.com/embed/0O0IbGerHtA',
      },
      {
        title: 'One-Click Deployment of Ingestion Pipelines',
        description:
          'OpenMetadata is providing a UI integration with Apache Airflow as a workflow engine to run ingestion, data profiling, data quality and other automation jobs.',
        isImage: false,
        path: 'https://www.youtube.com/embed/eDTDT_ZLeyk',
      },
    ],
    changeLogs: {
      'Metadata Versioning': `- OpenMetadata captures the changes in metadata as new versions of an entity.\n- The version history for all entities is maintained in the _Major.Minor_ number.\n- The initial version of an entity is 0.1\n- A backward compatible change will result in a _Minor_ version change (e.g., from 0.1 to 0.2)\n- A backward incompatible changes result in a _Major_ version change (e.g., from 0.2 to 1.2)\n- Timeline visualization tracks all the metadata changes from version to version.\n- Built _Versions_ APIs for developers to access a list of all versions, and also to get a specific version of an entity.\n- Helps debugging as users can identify changes that led to a data issue.\n- Helps crowdsourcing and collaboration within organizations as more users can be given access to change metadata and to be held accountable.`,
      'Events API': `- When the state of metadata changes, an event is produced that indicates which entity changed, who changed it, and how it changed.\n- Events can be used to integrate metadata into other tools, or to trigger actions.\n- Followers of data assets can be notified of events that interest them.\n- Alerts can be sent to followers and downstream consumers about table schema changes, or backward incompatible changes, like when a column is deleted.\n- Events can be used to build powerful apps and automation that respond to the changes from activities.\n- See issue-[1138](https://github.com/open-metadata/OpenMetadata/issues/1138) for more details about this feature.`,
      'One-Click Deployment of Ingestion Pipelines': `- OpenMetadata is providing a UI integration with Apache Airflow as a workflow engine to run ingestion, data profiling, data quality and other automation jobs.\n- From the UI, admins can configure a service to run the OpenMetadata pipelines, and add an ingestion schedule to automatically kick off the ingestion jobs.\n- This deploys a workflow onto the cluster.\n- This forms the basis for all the future automation workflows.`,
      'New Entities: ML Models and Data Models': `- Two new data assets have been added - ML Models and Data Models.\n- ML Models are algorithms trained on data to find patterns or to make predictions.\n- We’ve added support for dbt to get the data models into OpenMetadata, so that users get to see what models are being used to generate the tables.`,
      'New Connectors': `- AWS Glue\n- DBT\n- Maria DB`,
      'User Interface': `- UI displays all the metadata changes of an entity over time as Version History. Clicking on the Version button, users can view the change log of an entity from the very beginning.\n- The UI supports setting up metadata ingestion workflows.\n- Improvements have been made in drawing the entity node details for lineage.\n- Entity link is supported for each tab on the details page.\n- Guided steps have been added for setting up ElasticSearch.\n- The entity details, search results page (Explore), landing pages, and components have been redesigned for better project structure and code maintenance.`,
      'OpenMetadata Quickstart':
        '- Shipped a Python package to simplify OpenMetadata docker installation.\n<code class="tw-bg-grey-muted-lite tw-text-grey-body tw-font-medium">pip install openmetadata-ingestion[docker]\n\nmetadata docker --run</code>',
      'Helm Charts': `- Installing OpenMetadata in your cloud provider or on-premise got easier.\n- We worked on Helm charts to get the OpenMetadata and dependencies up and running on Kubernetes.`,
      'Other Features':
        '- Upgraded from JDBI 2 to JDBI 3, which will support newer versions.',
    },
  },
  {
    id: 3,
    version: 'v0.7.0',
    description: 'Released on 15 Dec 2021.',
    features: [
      {
        title: 'New Home Screen',
        description:
          'New and improved UX has been implemented for search and its resulting landing pages.',
        isImage: false,
        path: 'https://www.youtube.com/embed/PMc7huRR5HQ',
      },
      {
        title: 'Change Activity Feeds',
        description:
          'Enables users to view a summary of the metadata change events. The most recent changes are listed at the top.',
        isImage: false,
        path: 'https://www.youtube.com/embed/xOQMvn3iPhM',
      },
      {
        title: 'Lineage Updates',
        description:
          'Improved discoverability. Implemented incremental loading to lineage.',
        isImage: false,
        path: 'https://www.youtube.com/embed/dWc73gWryDw',
      },
      {
        title: 'DBT Integration',
        description:
          'DBT integration enables users to see what models are being used to generate tables.',
        isImage: false,
        path: 'https://www.youtube.com/embed/tQ6iBBnzpGc',
      },
      {
        title: 'Automatic Indexing',
        description:
          'SSL-enabled Elasticsearch (including self-signed certs) is supported. Automatically runs an indexing workflow as new entities are added or updated through ingestion workflows.',
        isImage: false,
        path: 'https://www.youtube.com/embed/Znr2UsbKAPk',
      },
    ],
    changeLogs: {
      'Activity Feeds': `- Enables users to view a summary of the metadata change events.\n- The most recent changes are listed at the top.\n- Entities (tables, dashboards, team names) are clickable.\n- Displays 'All Changes' and 'My Changes'.\n- A feed has been provided for data you are 'Following'.`,
      'UX Improvements': `- New and improved UX has been implemented for search and its resulting landing pages.\n- The Explore page has an updated UI. Introduced a 3-column layout to present the search results and several visual element improvements to promote readability and navigation of the search results.\n- Users can filter by database name on the Explore page.\n- Support has been added to view the recent search terms.\n- Major version changes for backward incompatible changes are prominently displayed.`,
      'DBT Integration': `- DBT integration enables users to see what models are being used to generate tables.\n- DBT models have been associated with Tables and are no longer treated as a separate Entity on the UI.\n- Each DBT model can produce a Table, and all the logic and metadata is now being captured as part of it.\n- DBT model is accessible from a tab in the table view.`,
      'Storage Location': `- UI supports StorageLocation.\n- Can extract the location information from Glue.\n- The ingestion framework gets the details from Glue to publish the location information (such as S3 bucket, HDFS) for the external tables.\n- The table results view now displays the table location in addition to the service.`,
      Elasticsearch: `- SSL-enabled Elasticsearch (including self-signed certs) is supported.\n- Automatically runs an indexing workflow as new entities are added or updated through ingestion workflows.\n- Metadata indexing workflow is still available; in case indexes need to be cleanly created from the ground up.`,
      'New Connectors': `- *Metabase*, an open-source BI solution\n- *Apache Druid* has been added to integrate Druid metadata.\n- *MLflow*, an open-source platform for the machine learning lifecycle\n- *Apache Atlas import connector*, imports metadata from Atlas installations into OpenMetadata.\n- *Amundsen import connector*, imports metadata from Amundsen into OpenMetadata.\n- *AWS Glue* - improved to extract metadata for tables and pipelines. Now uses the AWS boto session to get the credentials from the different credential providers, and also allows the common approach to provide credentials. Glue ingestion now supports Location.\n- *MSSQL* now has SSL support.`,
      'Lineage View Improvements': `- Improved discoverability\n- Implemented incremental loading to lineage.\n- Users can inspect the Table’s columns.\n- Users can expand entity nodes to view more upstream or downstream lineage.\n- Helps data consumers and producers to assess the impact of changes to the data sources.`,
      'Other Features': `- Admins can now access the user listing page, filter users by team, and manage admin privileges\n- Updated the Redoc version to support search in the API, as well as to add query parameter fields fixes.\n- 'Entity Name' character size has been increased to 256.`,
    },
  },
  {
    id: 4,
    version: 'v0.8.0',
    description: 'Released on 26 Jan 2022.',
    features: [
      {
        title: 'Role Based Access Control',
        description:
          'In the 0.8 release, Role Based Access Control (RBAC) policy for metadata operations has been designed. New entities ‘Role’ and ‘Policy’ have been added to support access control. A User has a ‘Role’. Further, the Role is associated with a  ‘Policy’. The ‘Policy’ has a set of ‘Rules’. Rules are used to provide access to metadata operations such as Update Description, Update Tags and Update Owners.',
        isImage: false,
        path: 'https://www.youtube.com/embed/m5_tIcNCxiM',
      },
      {
        title: 'Manually Edit Lineage Metadata ',
        description:
          'The manual lineage feature aims at the curation of lineage to make it richer by allowing users to edit the lineage and connect the entities with a no-code editor. A drag and drop UI has been designed to allow users to add lineage information manually. Entities like table, pipeline, and dashboard can be dragged and dropped to the lineage graph to create a node. The required entity can be searched and clicked to insert into the graph. Users can add a new edge as well as delete an existing edge. The lineage data updates in realtime. The nodes load incrementally.',
        isImage: false,
        path: 'https://www.youtube.com/embed/oII-ZXm0smc',
      },
      {
        title: 'Event Notification via Webhooks and Slack Integration',
        description:
          'The webhook interface allows you to build applications that receive all the data changes happening in your organization through APIs. We’ve worked on webhook integration to register URLs to receive metadata event notifications. These events will be pushed to Elasticsearch and Slack via Pluggable Consumers that can read the events published to LMAX. We’ve done a Slack integration through webhook, allowing users to set up Slack notifications.',
        isImage: false,
        path: 'https://www.youtube.com/embed/3flJMXmJqfk',
      },
      {
        title: 'Maintain Metadata for Deleted Entities',
        description:
          'Entities have a lot of user-generated metadata, such as descriptions, tags, ownership, tiering. There’s also rich metadata generated by OpenMetadata through the data profiler, usage data, lineage, test results, and other graph relationships with other entities. When an entity is deleted, all of this rich information is lost, and it’s not easy to recreate it. Now OpenMetadata supports soft deletion in the UI, and soft and permanent deletion in the API.',
        isImage: false,
        path: 'https://www.youtube.com/embed/PNrTX1D8e-E',
      },
      {
        title: 'Integrated Service and Ingestion Creation',
        description:
          'Service and ingestion creation has been integrated into a single workflow.',
        isImage: false,
        path: 'https://www.youtube.com/embed/fGVyIHIA6w4',
      },
      {
        title: 'Feature Tour',
        description: 'A tour of the key features in OpenMetadata 0.8.',
        isImage: false,
        path: 'https://www.youtube.com/embed/ZNGyjiQqS1w',
      },
    ],
    changeLogs: {
      'Access Control Policy': `- Role Based Access Control (RBAC) policy has been designed for metadata operations.\n- New entities called ‘Role’ and ‘Policy’ have been added.\n- A User has a ‘Role’. A  ‘Policy’ can be assigned to a Role. \n- A Policy has a set of ‘Rules’. Rules are used to provide access to functions like updateDescription, updateTags, updateOwner and so on.\n- Can provide access to metadata operations on any entity.\n- A standard set of Roles with their Policies have been added in the new release.\n- ‘Admins’ and ‘Bots’ can perform any metadata operation on any entity.\n- Admins can define policies through the Policy UI, and assign roles to the Users.\n- Rules can be enabled or disabled, as well as an entire policy can be disabled.`,
      'Manual Lineage': `- Enhance the lineage captured from machine metadata with user knowledge.\n- Users can edit the lineage and connect the entities with a no-code editor.\n- Drag and drop UI has been designed to add lineage information manually for the table and column levels.\n- Entities like table, pipeline, and dashboard can be dragged and dropped to the lineage graph to create a node.\n- The required entity can be searched and clicked to insert into the graph.\n- Users can add a new edge as well as delete an existing edge.\n- Lineage data updates in realtime.\n- Nodes load incrementally.`,
      'Event Notification via Webhooks': `- Subscribe event notifications via webhooks.`,
      'Slack Integration': `- Send metadata change events as Slack notifications\n- Provide timely updates to keep the data team informed of changes\n- Worked on LMAX disruptor integration to publish change events.\n- Worked on webhook integration to register URLs to receive metadata event notifications.\n- These events will be pushed to Elasticsearch and Slack via pluggable consumers that can read the events published to LMAX.\n- Supports a Slack integration through webhook, allowing users to set up Slack notifications.`,
      'Data Profiler': `- Earlier, we were using the Great Expectations profiler.\n- We have replaced it with a new and more efficient data profiler.`,
      'Entity Deletion': `- API support has been added for entity deletion, both for soft delete and hard delete.\n- A deleted dataset is marked as deactivated in the OpenMetadata backend instead of hard deleting it.\n- Users can restore the accidentally deleted entities.\n- Ingestion support has been added to publish entity deletion.\n- Enabled version support for deleted entities.\n- Added support for deleted entities in Elasticsearch.`,
      'Updates to Metadata Versioning': `- Version panel has been added for all the entities- Table, Topic, Pipeline, and Dashboard.\n- Previously, we were getting the change descriptions for a limited set of fields for the Topic entity; several other fields have now been included.`,
      'New Connectors': `- Supports [Delta Lake](https://delta.io/), an open source project that enables building a Lakehouse architecture on top of data lakes.\n- Worked on the refactor of SQL connectors to extract the lineage.\n- Connector API was refactored to capture the configs on the OpenMetadata side and to schedule the ingestion via UI.`,
      'Other Features': `- DataSource attribute has been added to the ML model entity.\n- Python API has been updated to add lineage for ML Model entities.\n- Supports the ingestion via environment variables to configure connectivity for both Elasticsearch and Airflow.\n- A new tab called ‘Bots’ has been added to group users with isBot set to true.\n- Support Application Default Credentials or a keyless, default service account in BigQuery data ingestion.\n- Improved usability of the metadata docker commands.\n- Includes a feature tour for new users.`,
    },
  },
  {
    id: 5,
    version: 'v0.9.0',
    description: 'Released on 9 Mar 2022.',
    features: [
      {
        title: 'Release Feature Tour',
        description:
          'Collaboration is one of the founding principles behind OpenMetadata. The OpenMetadata 0.9 release focuses on Conversation Threads in the Activity Feed, Data Quality, and Glossary. We are iteratively building many important features based on community feedback.',
        isImage: false,
        path: 'https://www.youtube.com/embed/VbNurSHA5cc',
      },
      {
        title: 'Profiler, metrics, and data quality tests',
        description:
          'For Data Quality, we previously shipped the profiler and standard metrics. In 0.9, we enable users to choose which tables should be profiled and define data quality tests at a table and column level.',
        isImage: false,
        path: 'https://www.youtube.com/embed/cKUhFlKOdoM',
      },
      {
        title: 'Conversation threads for collaboration',
        description:
          'With Conversation Threads, users can track the data as it changes, comment on it, request changes, and ask questions without having to jump to another tool. Threaded discussions on data assets enable users to collaborate to improve the data within an organization.',
        isImage: false,
        path: 'https://www.youtube.com/embed/48CbISIGkGs',
      },
      {
        title: 'Glossaries for shared and consistent descriptions of data',
        description:
          'OpenMetadata now enables you to build a Glossary - a Controlled Vocabulary to describe important concepts and terminologies related to data within your organization to foster a common and consistent understanding of data.',
        isImage: false,
        path: 'https://www.youtube.com/embed/xSSCoKdgZZ4',
      },
    ],
    changeLogs: {
      'Activity Feeds & Conversation Threads': `- A collaboration aspect has been built into Activity Feeds with conversation threads.\n- Users can ask questions, ask for a description, and comment on the change events.\n- Users can create conversations around data entities.\n- A chat icon is displayed next to all the data entities that have conversation threads.\n- Owners of assets, the followers and mentions, or users who created the thread will be part of the conversation.\n- Each data entity and its fields can have multiple threads.\n- A thread can have only one level of replies.\n- Currently, editing of posts is not supported.\n- Users will be able to tag the data entity or include users/teams in a conversation by using #mentions and @mentions.\n- In the Data Entity pages, 'Activity Feed' tab has been introduced to display all the activities related to that entity.\n- Feeds from conversation threads are included in the Activity Feeds.`,
      'Data Quality and Writing Tests': `- The metadata extraction process and data profiling have been separated into two different jobs.\n- The ingestion job will extract the metadata from sources and update the entities' instances.\n- The profiling job will extract the metrics from SQL sources, and configure and run data quality tests.\n- Data Quality is supported only in the context of quality metrics.\n- Data profiling can be configured for specific tables.\n- Follow the same configuration as in the ingestion workflow to filter out specific tables and schemas.\n- The metadata ingestion as well as the profiling and testing workflows can be scheduled to run at a different cadence. \n- Data quality test support has been added with JSON Schemas and APIs.\n- Tests can be defined at the Table and Column levels from the UI or in the profiler workflow configuration.\n- To run the tests, users need to deploy the workflows on Airflow or use the CLI manually.\n- Table and Column profiling data are defined as a time series.\n- Table health can be tracked in the Data Quality tab.`,
      Glossary: `- Glossary support has been introduced.\n- Glossaries are a controlled vocabulary in an organization used to define the concepts and terminologies specific to a particular domain.\n- OpenMetadata uses a Thesaurus to build a glossary.\n- The terms are organized hierarchically with equivalent and associative relationships.\n- Multiple glossaries can be built, like Business Glossary, Baking Glossary, etc.\n- A glossary has Terms, to define the data with a clear and unique definition.\n- Terms can have Synonyms, based on the different terms used in the organization.\n- Terms can have Associated Terms like parent or child terms.\n- Related Terms or concepts can be added to the glossary.\n- Terms have a life cycle status (e.g., Active, Deprecated).\n- Reviewers can accept or reject the suggested terms.\n- Terms from the glossary can be used for labeling and tagging.`,
      Connectors: `- Twelve new connectors have been added: **Apache Atlas, Azure SQL, ClickHouse, ClickHouse Usage, Databricks, Delta Lake, DynamoDB, IBM Db2, Power BI, MSSQL Usage, SingleStore**\n- We support the ingestion of **Apache Iceberg** tables as a tableType. Iceberg tables are pulled in as part of the Hive or Glue ingestion and marked as external tables.\n- Added lineage support to fetch the upstreams and downstream from the queries for several connectors.\n- Lineage for Snowflake is supported via Usage as well as View definitions.\n- Lineage via View Definitions is supported for databases using SQLAlchemy, such as MySQL, Athena, AzureSQL, BigQuery, ClickHouse, Databricks, IBM Db2, Druid, Hive, MariaDB, MSSQL, Oracle, Postgres, Presto, Redshift, SingleStore, Snowflake, Trino, and Vertica.\n- Added lineage support for the dashboard connectors: Tableau, Metabase, and Superset.\n- The Tableau connector has been upgraded to support Personal access token name and Secret.\n- Application Default Credentials (ADC) have been implemented for BigQuery and BigQuery Usage connectors.\n- The Amundsen connector has been updated.`,
      'UI Improvements': `- The Queries tab in the Table Details page displays the queries that run against a table.\n- The trendline on the UI displays the number of rows next to it.\n- Users can update teams based on updateTeams permission.\n- Admins can now remove users from Teams.\n- Users can delete their recently searched terms.`,
      'Other Features': `- We support Azure SSO as a new integration in security.\n- Improvements have been made to the Single-Sign-On authentication from Okta and Google SSO.\n- We also accommodate the OAuthProxy handler, which authenticates the user and returns the user’s email address in HTTP headers to login to OpenMetadata.\n- Owner support has been added for all services and databases to ensure that all services have an owner. Databases can have an owner independent of the table it contains.\n- RBAC has been implemented for role-based permissions. \n- Permissions API integrated into the UI to get permissions for a logged-in user.\n- Authorization checks added to the UI based on the logged-in user permissions.\n- Admins can choose a default role to assign to users during sign-up.\n- Dataset level and column level lineage can be added manually.\n- Table entity page loads the data incrementally.`,
    },
  },
  {
    id: 6,
    version: 'v0.10.0',
    description: 'Released on 26 Apr 2022.',
    features: [
      {
        title: 'Deploy Ingestion from UI',
        description:
          'OpenMetadata has refactored the service connections to simplify the ingestion jobs from both the ingestion framework as well as the UI. We now use the pydantic models automatically generated from the JSON schemas for the connection definition. The ‘Add Service’ form is automatically generated in the UI based on the JSON schema specifications for the various connectors that are supported in OpenMetadata.',
        isImage: false,
        path: 'https://www.youtube.com/embed/veK7PrmhXWE',
      },
      {
        title: 'Support for Database Schema',
        description:
          'OpenMetadata supports databases, service name databases, and tables. Based on community demand, we’ve also added Database Schema as part of the FQN. For each external data source, we ingest the database, as well as the tables that are contained underneath the schemas.',
        isImage: false,
        path: 'https://www.youtube.com/embed/zkEmbNNMdso',
      },
      {
        title: 'Support for Hard Delete',
        description:
          'OpenMetadata supported soft deletions. Now, we also support the hard deletion of entities through the UI, APIs, and ingestion. Hard deleting an entity removes the entity and all of its relationships. This will also generate a change event.',
        isImage: false,
        path: 'https://www.youtube.com/embed/6VILlkwQudo',
      },
    ],
    changeLogs: {
      'Backend APIs': `- **Fully Qualified Name (FQN) Separator:** Allows "." in the entity names and is handled as an internal detail in OpenMetadata. Improved the fullyQualifiedName. The "." is still the separator and the entity names from source will not be changed at all.\n- **Consistent FQN Changes** across the OpenMetadata UI, backend, Python framework, or any client that you might use.\n- **Introduced Database Schema as part of FQN:** For each external data source, we ingest the database, as well as the tables that are contained underneath the schemas. The database schema has been added into the hierarchy. Displays the fully qualified name, instead of a snippet of the table name.\n- **[Authorizer and Policy Changes](https://github.com/open-metadata/OpenMetadata/issues/4199):** Enhanced flexibility for creating policies and assigning roles. The policies can be authored at a field level or domain level. \n- **User permissions** to update descriptions and tags will be dependent on the roles and permissions. One can create a role and provide the role permissions to update users in all teams.\n- **Supports Hard Deletion** of Entities through the UI, APIs, and ingestion: Hard deleting an entity removes the entity and all of its relationships. This will also generate a change event.`,
      Ingestion: `- **Refactored Service Connections:** To simplify the ingestion jobs from both the ingestion framework as well as the UI.\n- **JSON Schema based Connection Definition:** Worked on the full refactoring of the ingestion framework. We use the pydantic models automatically generated from the JSON schemas for the connection definition. A change in the JSON schema will reflect the changes in the UI form.\n- **Test Credentials:** Users can test the connector credentials to ensure that it reaches the source to extract metadata.\n- **Refactored Airflow Rest APIs:** Creating a custom airflow rest API directly on top of Airflow using plugins. This passes the connection information to automatically generate all the dags and prepares handy methods to help us test the connection to the source before creating the service.\n- **Dynamically Download DBT Manifest Files from Amazon S3 or Google Cloud Storage:** This way we can have any other process to connect to the DBT, extract the catalog, and put it into any cloud service. We just need the path name and workflow job details from the metadata extraction to be able to ingest metadata.`,
      'Frontend or UI Changes': `- **Supports Hard Deletion of Entities:** Permanently delete tables, topics, or services. When the entity is hard deleted, the entity and all its relationships are removed. Also generates a  change event.\n- **Dynamic “Add Service” Forms:** ‘Add Service’ form is automatically generated in the UI based on the JSON schema specifications for the various connectors supported in OpenMetadata.\n- **UI Support for Database Schema as part of FQN:**  All the entity pages now support Database Schema in the UI.\n- **Lineage Editor:** Improvements have been made to the lineage editor.\n- **Teams:** While signing up in OpenMetadata, the teams with restricted access are hidden and only the joinable teams are displayed.\n- **Team Owner:** An Owner field has been added to the Team entity. Only team owners can update the teams.\n- **Activity Feeds:** The Activity Feeds UI supports infinite scrolling.\n- **Add User:** A user can be added from the Users page`,
      'Security Changes': `- **Support Added to Refresh Tokens for Auth0 and Okta SSO:** The JWT tokens are refreshed silently behind the scenes to provide an uninterrupted user experience.\n- **Supports Custom OIDC SSO:** Integrate with your custom built OIDC SSO for authentication. This is supported both on the front end for user authentication as well as on the ingestion side.\n- **Azure SSO:** Support has been added for Azure SSO on Airflow.`,
      'Data Quality and Writing Tests': `- The Data Quality tab now displays the **description of tests**.\n- To improve performance, a **max time limit** has been set on queries. If they exceed the max time, then the query is canceled and the profiler will process the next query.\n- **Profiler Workflows** can now be deployed from the UI, allowing scheduled computations of the Data Profiler and Quality Tests. \n- **Multiple workflows** can be run for a single service in order to batch tables with similar requirements.`,
      Connectors: `- The service connection string has been **refactored** to be specific to each service. \n- A **dynamic service config form builder** has been implemented. \n- A **Test connection** button has been added for service connectors, so the configs can be tested and validated.\n- **Snowflake** connector has been optimized to extract only the relevant metadata.\n- Private key support has been implemented for **Snowflake** and **BigQuery** to allow users to connect with the data source using a private key.\n- **Hive** connector has been improved to support running against a secured Hive cluster.\n- **Databricks** data profiling requirements have been changed. Some changes have been made for ingesting the tables and the corresponding catalog and manifest file from DBT.\n- **BigQuery** and **Hive** now support partitioning. The partitioning details can be used by the Profiler to sample data and to capture metrics.\n- Lineage has been added to **MSSQL Usage**.\n- Lineage has been refactored in Usage sources.\n- Dashboard and chart filtering has been added for the **Tableau** connector.`,
      'Other Changes': `- OpenMetadata can now reach the services running in **Docker's host machine** by using “host.docker.internal” or “gateway.docker.internal” as the hostname.\n- A flag has been added to control if the **sample data** should be ingested or not when starting up Docker from CLI.\n- Now there's a way to differentiate if a **data source** is a table or a view. Also, one can know how many views are chained in **Lineage**.\n- Support has been added to **reset** the database and to **restart** the OpenMetadata server.\n- The Activity feed API supports **pagination**.`,
    },
  },
  {
    id: 7,
    version: 'v0.11.0',
    description: 'Released on 30 Jun 2022.',
    features: [
      {
        title: 'Collaborations & tasks',
        description:
          'Data Collaboration has been the prime focus of the 0.11 Release, the groundwork for which has been laid in the past several releases. In the 0.9 release, we introduced Activity Feeds, Conversation Threads, and the ability to request descriptions. In this release, we’ve added Tasks, as an extension to the ability to create conversations and post replies.',
        isImage: false,
        path: 'https://www.youtube.com/embed/XZAZAJsFCVk',
      },
      {
        title: 'Column-level lineage',
        description:
          'We’ve added column level lineage API support. The UI now supports exploring this rich column level lineage for understanding the relationship between tables and to perform impact analysis. While exploring the lineage, users can manually edit both the table and column level lineage to capture any information that is not automatically surfaced.',
        isImage: false,
        path: 'https://www.youtube.com/embed/HTkbTvi2H9c',
      },
      {
        title: 'Advanced search',
        description:
          'An advanced search option has been added, where users can search by column, schema, database, owner, tag, and service. Users can search by multiple parameters to narrow down the search results. Separate advanced search options are available for Tables, Topics, Dashboards, Pipelines, and ML Models.',
        isImage: false,
        path: 'https://www.youtube.com/embed/DUq-c7OLQpQ',
      },
    ],
    changeLogs: {
      'Data Collaboration - Tasks, Announcements, & Emojis': `- **Tasks** have been introduced as an extension to the ability to create conversations and post replies.\n- Tasks can be created around **descriptions** for tables, pipelines, dashboards, and topics. \n- Users can **Request a description**, or even **Suggest a new description** and make **edits** to an existing description. \n- Submitting the request automatically creates a task for the owner of a data asset. \n- Tasks can be further **reassigned** to the relevant user. \n- Other users can participate in this activity by posting a **reply**, **comment**, or **react** to conversations with **emojis**.\n- All the tasks assigned to a user can be tracked in the **User Profile** page.\n- Tasks associated with a particular data asset are kept track of in the **dataset details** page.\n- Task owners can provide description or accept/reject suggestions and those tasks are **automatically closed**.`,
      'Column Level Lineage': `- Column level lineage **API** support has been added in the **backend**.\n- Supports table level and column level lineage from **Snowflake**, **Redshift**, and **BigQuery**.`,
      'Custom Properties': `- Now supports adding **new types** and **extending entities** when organizations need to capture custom metadata.\n- New types and **custom fields** can be added to entities either using **API** or in **OpenMetadata UI**.`,
      'Advanced Search': `- Users can **search by** column, schema, database, owner, tag, and service. \n- Users can search by **multiple parameters** to narrow down the search results.\n- Separate advanced search options are available for **Tables**, **Topics**, **Dashboards**, **Pipelines**, and **ML Models**. \n- All entities are searchable by **common search options** such as Owner, Tag, and Service. \n- **Entity specific search options** are also available - table specific options include Column, Schema, and Database, pipeline specific options include Task, and dashboards specific option includes Chart.`,
      'Glossary UI Updates': `- The Glossary UI has been **upgraded**. \n- The **arrangement** to display the Summary, Related Terms, Synonyms, and References has been changed. \n- **Reviewers** are shown on the right panel with an option to add or remove existing reviewers.`,
      'Profiler and Data Quality Improvements': `- **Seven** additional data quality tests have been added as follows.\n- **tableColumnCountToBeBetween**: Ensure the number of columns in your table stays within the expected range\n- **tableColumnNameToExist**: Check that a specific column is in your table\n- **tableColumnToMatchSet**: Check that your table has the expected columns. You can enforce a check for column order.\n- **columnValueMaxToBeBetween**: Verify the max value in a column is between expected bounds\n- **columnValueMinToBeBetween**: Verify the min value in a column is between expected bounds\n- **columnValuesToBeInSet**: Check if specific value(s) are in a column\n- **columnValuesSumToBeBetween**: Verify the sum of the values in a column is between expected bounds\n- The Profiler now determines if a **BigQuery** table is partitioned, and filters it accordingly.\n- Now, you can pass a **custom query** to your profiler workflow file.\n- Developed a direct integration between **Great Expectations** and OpenMetadata. Now, you can add custom actions to your Great Expectations checkpoints file that will automatically ingest your data quality tests results into OpenMetadata at the end of your checkpoint file run.`,
      'ML Models': `- **ML Model entities** have been added to the UI.\n- Supports ingestion through the UI from [MLflow](https://mlflow.org/).`,
      Connectors: `- Five new connectors have been added - [Airbyte](https://airbyte.com), [Mode](https://mode.com), [AWS Data Lake](https://aws.amazon.com/big-data/datalakes-and-analytics/what-is-a-data-lake/), [Google Cloud Data Lake](https://cloud.google.com/learn/what-is-a-data-lake#section-6), and [Apache Pinot](https://pinot.apache.org/).\n- **DBT Cloud** support was added and we now extract manifest and catalog files from API.\n- The **ingestion scheduler** now supports a minute level selection.\n- The **Snowflake** metadata extraction has been optimized.\n- The **Looker** connector now fetches the ‘Usage’ and ‘Access’ metadata for Dashboards and Charts.`,
      'UI Improvements': `- The OpenMetadata UI has a **new layout**.\n- In the **Activity Feeds**, the options to reply to a conversation, as well as to delete can now be found on hovering over the conversation.\n- Users can react with **Emojis** on the activity feeds, conversations and replies.\n- Hovering on the links provides a **quick preview** of the entity details.\n- The UI supports adding Tasks. **Pending tasks** will be displayed on the right panel.\n- A tooltip has been added to display the **FQN** on hover in the Activity Feed header.`,
      'Other Changes': `- Admin users define **Roles** and associate these roles to Teams. When a user picks a Team, the Role gets automatically assigned.\n- An option has been added to recreate a fresh index from the data available in **Elasticsearch**.\n- A simple **webhook server** has been added to the metadata command to register and listen to the metadata change events.\n- The ingestion configurations are supported as **YAML**.\n- In the previous release, we added support for **Azure SSO** on Airflow. In the current release, we’ve added support for Azure SSO in Java SDK Client.\n- OpenMetadata now supports **AWS Cognito SSO**.\n- When **deleting** a database service, the number of databases, schemas and tables is displayed in the confirmation dialog.`,
    },
  },
  {
    id: 8,
    version: 'v0.12.0',
    description: 'Released on 7 September 2022.',
    features: [
      {
        title: 'Roles and policies',
        description:
          'We now support a rich team management system with a world class Roles and Policies hierarchy based on fine-grained operations and rich SpEL based conditional rules to organize your metadata and users. We support Attribute and Rule based Policies as well as User and Resource based Policies.',
        isImage: false,
        path: 'https://www.youtube.com/embed/heN9h-XEK6g',
      },
      {
        title: 'Data Quality and Data Profiler',
        description: `The 0.12 release offers an integrated catalog, Profiler and Data Quality solution designed with engineers and business users in mind. We've introduced Test Suites, brand new dashboards for Profiler, Data Quality Tests at the Table & Column levels, Custom Tests & lots more.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/EmopVu6aux4',
      },
      {
        title: 'Webhooks and Slack Improvements',
        description:
          'Slack and Microsoft Teams webhook integrations have been supported to send event notifications in real time. Users can choose to receive notifications for only the required entities by using event filters based on when an entity is created, updated, or deleted.',
        isImage: false,
        path: 'https://www.youtube.com/embed/47hyjnuSY4Q',
      },
      {
        title: 'Announcements',
        description:
          'With Announcements, you can now inform your entire team of all the upcoming events and changes. OpenMetadata supports these announcement banners for Entities or data assets like Tables, Topics, Pipelines, and Dashboards.',
        isImage: false,
        path: 'https://www.youtube.com/embed/xflbzDuEBvU',
      },
      {
        title: 'Activity Feed Notifications',
        description:
          'The Activity Feed Notifications has been improved to allow users to choose the events they want to be notified about. In the 0.12 release, we’ve also streamlined the Notifications menu with two separate tabs for Tasks and Mentions, that’ll display only the recent notifications.',
        isImage: false,
        path: 'https://www.youtube.com/embed/t3r-QIJcNPk',
      },
      {
        title: 'Global Settings',
        description:
          'The OpenMetadata Settings dropdown menu has been transformed into a single, centralized Settings page for added convenience in viewing all the available options. The Global Settings comprises setting options for Team Members, Access based on Roles and Policies, Services, Data Quality, Collaboration, Custom Attributes, and Integrations for webhooks and bots.',
        isImage: false,
        path: 'https://www.youtube.com/embed/OhlFOY48xB0',
      },
      {
        title: 'Custom Properties',
        description:
          'OpenMetadata now supports adding custom properties for all entities, so organizations can tweak the data as per their needs.',
        isImage: false,
        path: 'https://www.youtube.com/embed/49tWRQfR_PA',
      },
      {
        title: 'New Connectors',
        description: `Four new connectors have been introduced: **Redpanda**, **Dagster**, **Fivetran**, and **Apache NiFi**.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/mSdHhXb3MMA',
      },
    ],
    changeLogs: {
      'Roles and Policies': `-   With Teams hierarchy, Admins can create a team structure with multiple layers of sub-teams.

-   Roles are assigned to Users. Roles are a collection of Policies. Each Role must have at least one policy attached to it.

-   A Role supports multiple policies with a one to many relationship.

-   Policies are assigned to Teams. Policy is a collection of Rules, which define access based on certain conditions.

-   Policies can have more than one Rule and these Rules can be added to more than one Policy.

-   Fine grained operations can be used to define the conditional rules for each Policy. All the Operations (Create/Edit/View/Delete) supported by an Entity are published.

-   OpenMetadata supports SpEL (Spring Expression Language) based conditions.

-   Conditions can be based on tags, ownership, teams using "If this, then that" conditions.

-   We support Attribute and Rule based Policies as well as User and Resource based Policies.

-   There can be Organizational as well as Team level roles. Team level roles cannot override the organizational level roles.`,
      'Data Profiler and Data Quality': `-   Added custom SQL data quality tests. Now you can write your data quality test logic using  SQL statements.

-   New Data Profiler dashboard displays the evolution of metrics, metrics of higher dimensions, and also the evolution of the data quality test results.

-   Sample data is captured for metrics.

-   Table and Column levels dashboards for data quality.

-   Moved away from the FQN filter. Now users can just include/exclude filter patterns by name.

-   Profile data available in a timeseries fashion.

-   Profile sample enabled at the Workflow level.

-   Define the percentage of table data to be profiled.

-   Multithreading implemented to compute metrics parallely.

-   Implemented Test Suites, wherein relevant Test Cases that belong to multiple tables can be grouped together and scheduled in a single workflow.

-   UI supports detailed data quality tests.

-   UI support to add tests at the Table and Column levels.

-   Test results are displayed in a time series fashion.

-   Notify users of Test results by sending notifications using Slack or MS Teams webhooks.`,
      'Data Collaboration': `-   Supports webhook integration to Slack, and Microsoft Teams.

-   Supports announcement banners for data assets like Tables, Topics, Pipelines, and Dashboards.

-   Streamlined the Notifications menu with two separate tabs for Tasks and Mentions.

-   Configure Activity Feed notifications for selected events at a system level.

-   Tasks can be created based on requests to create or update tags.`,
      'Pluggable Secrets Store': `-   Introduced a Secrets Manager Interface to communicate with any Key Management Store.

-   All of the services secrets can be stored in a Pluggable Secrets Store

-   Implementation of AWS Secret Store and Systems Store`,
      Connectors: `- [Redpanda](https://docs.open-metadata.org/openmetadata/connectors/messaging/redpanda) as a Messaging service, which allows users to document its topics and schemas.

-   [Dagster](https://docs.open-metadata.org/openmetadata/connectors/pipeline/dagster) as a pipeline service.

-   [Fivetran](https://docs.open-metadata.org/openmetadata/connectors/pipeline/fivetran) as a pipeline service.

-   Apache NiFi as a pipeline service.

-   Users can add multiple database service names to track lineage for dashboard services.

-   Captures Metabase lineage with SQL lineage.

-   ROW type support has been added for Trino.

-   Amazon Web Service access keys are optional for DBT metadata ingestion.

-   A single service now supports multiple Metadata Ingestion workflows`,
      Lineage: `-   Separate workflow for Lineage and Usage.

-   Usage Queries have been optimized.

-   Result Limit has been added to usage queries`,
      'UI UX Improvements': `-   Roles and Policies have been enhanced to use rich SpEL based conditions and fine grained operations to create rules.

-   A single, centralized Settings Page for added convenience

-   Displays all teams when registering for the first time, instead of just 10 teams.

-   UI improvements on the Schema, Service and Database details pages.`,
      'Other Changes': `-   Custom Properties support for all entities.

-   Supports keyboard shortcuts, such as Command + k for 'Search', Escape to 'Cancel', and Enter to 'Save'.

-   Upgraded to the latest Airflow container.

-   Supports space in the Tags category and Primary Tags.

-   The [OpenMetadata documentation](https://docs.open-metadata.org) site has been revamped.`,
    },
  },
  {
    id: 9,
    version: 'v0.12.1',
    description: 'Released on 3 October 2022.',
    features: [],
    changeLogs: {
      'Basic Authentication': `- User/Password signup and login
- Email notifications for forgot password
- Admin can add new users and send an email`,
      'ElasticSearch Full Re-index Through UI': `- Now admins can fully re-index elasticsearch through the UI.`,

      'Versioning Support For Custom Attributes': `- Any changes to entities custom attributes are now versioned.`,
      'DBT Metadata - Tag': `- We support ingesting DBT tags into OpenMetadata.`,
      'Bots Integration': `- Admins can create bots and their security mechanism from UI.`,
      'Bug Fixes': `- Around 136 Features/Bug fixes/improvements/Tests made it into 0.12.1 release.`,
    },
  },
  {
    id: 10,
    version: 'v0.13.0',
    description: 'Released on 22 November 2022.',
    features: [
      {
        title: 'Data Insights and KPIs',
        description:
          'Data Insights has been introduced that transforms the passive approach to data to a collaborative project towards improved data culture. Data Insights aims to provide a single pane view of all the key metrics to best reflect the state of your data. Admins can define the Key Performance Indicators (KPIs) and set goals within OpenMetadata to work towards better documentation, ownership, and tiering.',
        isImage: false,
        path: 'https://www.youtube.com/embed/pCR0y5jyHCA',
      },
      {
        title: 'Lineage Traceability',
        description:
          'The lineage UI has been transformed to enhance user experience. Users can get a holistic view of an entity from the Lineage tab. When an entity is selected, the UI displays end-to-end lineage traceability for the table and column levels. Just search for an entity and expand the graph to unfold lineage. It’ll display the upstream and downstream for each node.',
        isImage: false,
        path: 'https://www.youtube.com/embed/j_elWRYSelU',
      },
      {
        title: 'Advanced Search',
        description:
          'An advanced search feature has been introduced in the 0.13.0 release, which helps users discover assets quickly with a Syntax Editor based on And/Or conditions.',
        isImage: false,
        path: 'https://www.youtube.com/embed/4EYUdBm5-K4',
      },
      {
        title: 'Data Lake Profiler',
        description:
          'With the OpenMetadata UI, users can now create and deploy profiling workflows for the Data Lake connector, which supports AWS S3 and GCS.',
        isImage: false,
        path: 'https://www.youtube.com/embed/KJ0vHGRIcG4',
      },
    ],
    changeLogs: {
      'Data Insights and KPIs': `-   Provides a single pane view of all the key data metrics.
-   Analytics are provided based on the metadata metrics, the entities created, the types of entities, and the data evolution over a period of time.
-   Admins can define the **Key Performance Indicators** (KPIs) and set goals.
-   Goals can be set towards better documentation, ownership, and tiering.
-   Goals are based on entities and driven to achieve targets within a specified time.
-   **Data insights dashboard** provides a quick glance at aspects like data ownership, description coverage, data tiering, and so on.
-   A timeseries report is provided to track progress and monitor the health of your data.
-   Admins can view the **aggregated user activity** and get insights into user engagement and user growth.
-   Admins can check for Daily active users and know how OpenMetadata is being used.
-   The **Data Insights Report** is emailed weekly to assess team performance.`,
      Lineage: `-   The UI displays end-to-end **lineage** **traceability** for the table and column levels.
-   Users can search for an entity and expand the graph to unfold lineage.
-   Displays the upstream and downstream for each node.
-   Lineage Tab UI supports two-finger scrolling to zoom in or zoom out.
`,
      'Data Quality': `-   We support **profiling** for **Data lakes** like Amazon S3.`,
      Security: `-   **LDAP SSO** has been introduced.
-   In the 0.12.1 release, support was added for **basic authentication** to sign up using a Username/Password.
-   Created multiple **bots to serve different scenarios**. For example, Ingestion Bot, Lineage Bot, Data Quality and Profiler Bot.
-   The **policies and access control for bots** has been redefined.
-   Bots can have their own policies. For example, the Ingestion Bot can create and update entities.`,
      'Advanced Search Improvements': `-   Apart from OpenMetadata's advanced search syntax which is syntax-driven, a **Syntax Editor** has been introduced.
-   The Syntax Editor is based on And/Or conditions to discover assets quickly.
`,
      Connectors: `-   [**Domo**](https://docs.open-metadata.org/connectors/dashboard/domo-dashboard) connector has been introduced. It's a cloud-based dashboard service.
-   Ingestion framework has been improved.
-   Adding a [**custom service type**](https://docs.open-metadata.org/connectors/custom-connectors) supported from the 0.12.1 release.`,
      'Messaging Service Schemas': `-   We now parse **Avro** and **Protobuf Schemas** to extract the fields from **Kafka** and **Redpanda** Messaging services. Previously, the schemas were taken as one payload and just published to OpenMetadata.
-   Users can **document** each of these fields within a schema by adding description and tags.
-   Users can **search** based on the fields in the Schema of a Topic.`,
      'Other Changes': `-   **Soft deleted entities** can be restored. Currently, only the ML Models are not supported.
-   **Soft deleted teams** can be restored. When restoring a soft deleted parent team, the child teams will not be restored by default.`,
    },
  },
  {
    id: 11,
    version: 'v0.13.1',
    description: 'Released on 22 December 2022.',
    features: [],
    changeLogs: {
      'Data Quality': `- **Freshness Metric** has been introduced. Data freshness is defined by how often a table is being updated and the number of rows being affected. All this is displayed within the data profiler with filterable graphs. This is currently supported for BigQuery, Snowflake, and Redshift.
- **Data Quality Tests** now support Data Lake services.`,
      'Notification Support': `- **Notification Support** experience has been improved. Users can define **Alerts** based on a **Trigger** (all data assets or a specific entity), **Filters** (events to consider), and **Action** (Slack, MS Teams, Email, Webhook) on where to send the alert.`,
      'dbt Workflow': `- **dbt** has its own workflow. Previously, dbt  was a part of the metadata ingestion process. This allows users to ingest multiple dbt projects into the same database service.`,
      'Topic Schema': `- **Topic Schemas** support field descriptions and tags. Previously, they were read-only. We now support JSON Schema, Avro and Protobuf parsing and field level details for topic schemas.`,
      'Data Insight Report': `- **Data Insight Report** has an improved layout. We now display a line graph instead of a bar graph. The Most Viewed Data Assets are clickable to view the asset details page.`,
      'Advanced Search': `- **Advanced Search** improvements have been made. When a filter is applied, the details of the filter selected are displayed for clarity.`,
      'Explore Page UI': `- **Side Preview** on the **Explore** page UI is now available for all data assets. Previously it was only displayed for tables.`,
      'Airflow Lineage': `- **Airflow Lineage Operator** and the **OpenMetadata Hook** are now part of the ingestion package. Send Airflow metadata from your DAGs and safely store the OpenMetadata server connection directly in Airflow.`,
    },
  },
  {
    id: 12,
    version: 'v0.13.2',
    description: 'Released on 30 January 2023.',
    features: [],
    changeLogs: {
      'Improved SQL Lineage': `- We have collaborated with the [sqllineage](https://github.com/reata/sqllineage) and [sqlfluff](https://www.sqlfluff.com/) communities
    to improve the parsing capabilities of *sqllineage*. We'll continue to collaborate to ship further improvements in new releases.`,
      'New Glossary UI': `- Moved from a tree view in the left panel to an easy to navigate list of the terms sorted alphabetically.
- The term list shows the tags and descriptions in the cards.`,
      'Glossary Import & Export': `- You can now export your Glossary data as a CSV file.
- In the same way, you can now bulk upload terms to a Glossary by adding their details in a CSV file.
- The import utility will validate the file and show you a preview of the elements that are going to be imported to OpenMetadata.`,
      'Unified Tag Category API': `- Renamed Tag Categories to Classification, a more widely used term.
- Updated the API to conform with the rest of the specification. More info [here](https://github.com/open-metadata/OpenMetadata/issues/9259).`,
      'Mutually Exclusive Tags': `- When creating a Classification or a Glossary term, you can now make the tags to be mutually exclusive.
- If tags are set to be mutually exclusive, you won't be able to set multiple tags from the same category in the same asset.`,
      EntityName: `- To better manage and harmonize entityName value and allow users to form better expectations around these values, the team introduced enforcement of the entityName format using a regex pattern. You can find more information about this in the [docs](https://docs.open-metadata.org/deployment/upgrade).`,
      'Ingestion Framework': `- Performance Improvements: We are now getting descriptions in batch, making connectors such as Redshift or Snowflake way faster!
- The Oracle connector now ships with the Thick mode enabled.
- AWS QuickSight fixes
- DB2 constraints and profiler improvements
- Added support for Postgres Foreign Tables
- Added support for Datalake profiler row-based sampling

`,
    },
  },
];
