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

import entitySpclCharImg from '../../../assets/img/EntitySplChar.png';
import sqlLineageImg from '../../../assets/img/ImprovedSQLLineage.png';
import ingestionFramework from '../../../assets/img/IngestionFramework.png';
import tagCategoryImg from '../../../assets/img/TagCategory.png';
import collateIcon from '../../../assets/svg/ic-collate.svg';

export const LATEST_VERSION_ID = 23;

export const COOKIE_VERSION = 'VERSION_1_3_1'; // To be changed with each release.

// for youtube video make isImage = false and path = {video embed id}
// embed:- youtube video => share => click on embed and take {url with id} from it

const CollateIconWithLinkMD = `[![Collate](${collateIcon})](https://www.getcollate.io/)`;

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
        '- Shipped a Python package to simplify OpenMetadata docker installation.\n<code class="bg-grey-muted-lite text-grey-body font-medium">pip install openmetadata-ingestion[docker]\n\nmetadata docker --run</code>',
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
    shortSummary:
      'Checkout Glossary Import & Export with new UI and many more!', // max words limit 15
    features: [
      {
        title: 'Glossary Import & Export',
        description:
          'You can now export your Glossary data as a CSV file. you can now bulk upload terms to a Glossary by adding their details in a CSV file.',
        isImage: false,
        path: 'https://www.youtube.com/embed/LSJBJCaj01g',
      },
      {
        title: 'New Glossary UI',
        description:
          'Moved from a tree view in the left panel to an easy to navigate list of the terms sorted alphabetically. The term list shows the tags and descriptions in the cards.',
        isImage: false,
        path: 'https://www.youtube.com/embed/Y0MLZgG-Ibs',
      },
      {
        title: 'Improved SQL Lineage',
        description:
          'We’ve collaborated with the [sqllineage](https://github.com/reata/sqllineage) and [sqlfluff](https://www.sqlfluff.com/) communities to improve the parsing capabilities of `sqllineage`.',
        isImage: true,
        path: sqlLineageImg,
      },
      {
        title: 'Unified Tag Category API',
        description:
          'Renamed Tag Categories to Classification, a more widely used term. Updated the API to conform with the rest of the specification. More info [here](https://github.com/open-metadata/OpenMetadata/issues/9259).',
        isImage: true,
        path: tagCategoryImg,
      },
      {
        title: 'Ingestion Framework improvements',
        description: `Performance Improvements: We are now getting descriptions in batch, making connectors such as Redshift or Snowflake way faster!
          - The Oracle connector now ships with the Thick mode enabled.
          - AWS QuickSight fixes
          - DB2 constraints and profiler improvements
          - Added support for Postgres Foreign Tables
          - Added support for Datalake profiler row-based sampling
          `,
        isImage: true,
        path: ingestionFramework,
      },
      {
        title: 'Entity Name',
        description: `To better manage and harmonize \`entityName\` value and allow users to form better expectations around these values the team introduced an enforcement of the \`entityName\` format using regex pattern. You can find more information about this in the [docs](https://docs.open-metadata.org/deployment/upgrade).`,
        isImage: true,
        path: entitySpclCharImg,
      },
      {
        title: 'Chrome Extension',
        description: `Announcing the beta version of OpenMetadata Chrome extension.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/5kfWbbfVEzU',
      },
      {
        title: 'Mutually Exclusive Tags',
        description: `When creating a Classification or a Glossary term, you can now make the tags to be mutually exclusive. If tags are set to be mutually exclusive, you won't be able to set multiple tags from the same category in the same asset.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/_AsfZctGYJU',
      },
    ],
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
  {
    id: 13,
    version: 'v1.0.0',
    description: 'Released on 25th April 2023.',
    features: [
      {
        title: 'Dashboard Data Models',
        description:
          'Dashboard Services now support the concept of Data Models: data that can be directly defined and managed in the Dashboard tooling itself, e.g., LookML models in Looker. Data Models will help us close the gap between Engineering and Business by providing all the necessary metadata from sources typically used and managed by analysts or business users. The first implementation of dashboard data models has been done in OpenMetadata for Tableau and Looker.',
        isImage: false,
        path: 'https://www.youtube.com/embed/ous8gOfiAHE',
      },
      {
        title: 'Ingestion UI',
        description:
          'Connecting to your data sources has never been easier. With OpenMetadata 1.0, find all the necessary permissions and connection details directly in the UI.',
        isImage: false,
        path: 'https://www.youtube.com/embed/xN2DtI7517M',
      },
      {
        title: 'Localization',
        description:
          'With more and more users from across the globe using OpenMetadata, we’ve added Localization Support in the UI. Now you can use OpenMetadata in English (US), French, Chinese, Japanese, Portuguese, and Spanish.',
        isImage: false,
        path: 'https://www.youtube.com/embed/V9EaXEJ_Dxk',
      },
      {
        title: 'Query as an Entity',
        description:
          'The queries were already being ingested in the Usage Workflows in OpenMetadata.Now their presentation and overall user interaction has been improved. In the 1.0 release, users can manually enter the queries that they would like to share with the rest of their peers. They can also discuss and react to the other queries in each table.',
        isImage: false,
        path: 'https://www.youtube.com/embed/tb5hEmzL1rY',
      },
      {
        title: 'Storage Services',
        description:
          'Previously, the Data Lake connector ingested one table per file, which covered only some of the use cases in a Data Platform. With the new Storage Services, you now have complete control over how you want to present your data lakes in OpenMetadata. The first implementation has been done on Amazon S3, wherein you can specify your tables and partitions and see them reflected with the rest of your metadata.',
        isImage: false,
        path: 'https://www.youtube.com/embed/DDjbUCjm00c',
      },
      {
        title: 'Global Search',
        description:
          'Global search has been enabled for Glossary terms and Tags, making it easier to discover data.',
        isImage: false,
        path: 'https://www.youtube.com/embed/mykm49U-QBk',
      },
      {
        title: 'Glossary',
        description:
          'OpenMetadata, glossary, glossary UI, open source, glossary term, tags, classification, team hierarchy, metadata management.',
        isImage: false,
        path: 'https://www.youtube.com/embed/yeX3YY8IvLU',
      },
    ],
    changeLogs: {
      'APIs & Schema': `- Stabilized and improved the Schemas and APIs.
- The APIs are backward compatible.`,
      Ingestion: `- Connecting to your data sources has never been easier. Find all the necessary permissions and connection details directly in the UI.
- When testing the connection, we now have a comprehensive list of validations to let you know which pieces of metadata can be extracted with the provided configuration.
- Performance improvements when extracting metadata from sources such as Snowflake, Redshift, Postgres, and dbt.
- New Apache Impala connector.`,
      'Storage Services': `- Based on your [feedback](https://github.com/open-metadata/OpenMetadata/discussions/8124), we created a new service to extract metadata from your cloud storage.
- The Data Lake connector ingested one table per file, which covered only some of the use cases in a Data Platform. With Storage Services, you can now present accurate metadata from your tables, even when partitioned.
- The first implementation has been done on S3, and we will keep adding support for other sources in the upcoming releases.`,
      'Dashboard Data Models': `- Dashboard Services now support the concept of Data Models: data that can be directly defined and managed in the Dashboard tooling itself, e.g., LookML models in Looker.
- Data Models will help us close the gap between engineering and business by providing all the necessary metadata from sources typically used and managed by analysts or business users.
- The first implementation has been done for Tableau and Looker.`,
      Queries: `- Improved UI for SQL Queries, with faster loading times and allowing users to vote for popular queries!
- Users can now create and share a Query directly from the UI, linking it to multiple tables if needed.`,
      Localization: `- In 1.0, we have added Localization support for OpenMetadata.
- Now you can use OpenMetadata  in English, French, Chinese, Japanese, Portuguese,  and Spanish.`,
      Glossary: `- New and Improved Glossary UI
- Easily search for Glossaries and any Glossary Term directly in the global search.
- Instead of searching and tagging their assets individually, users can add Glossary Terms to multiple assets from the Glossary UI.
`,
      'Auto PII Classification': `- Implemented an automated way to tag PII data.
- The auto-classification is an optional step of the Profiler workflow. We will analyze the column names, and if sample data is being ingested, we will run NLP models on top of it.`,
      Search: `- Improved Relevancy, with added support for partial matches.
- Improved Ranking, with most used or higher Tier assets at the top of the search.
- Support for Classifications and Glossaries in the global search.`,
      Security: `- SAML support has been added.
- Deprecation Notice: SSO Service accounts for Bots will be deprecated. JWT authentication will be the preferred method for creating Bots.`,
      Lineage: `- Enhanced Lineage UI to display a large number of nodes (1000+).
- Improved UI for better navigation.
- Improved SQL parser to extract lineage in the Lineage Workflows.`,
      'Chrome Browser Extension': `- All the metadata is at your fingertips while browsing Looker, Superset, etc., with the OpenMetadata Chrome Browser Extension.
- Chrome extension supports Google SSO, Azure SSO, Okta, and AWS Cognito authentication.
- You can Install the Chrome extension from Chrome Web Store.`,
      'Other Changes': `- The Explore page cards will now display a maximum of ten tags.
- Entity names support apostrophes.
- The Summary panel has been improved to be consistent across the UI.`,
    },
  },
  {
    id: 14,
    version: 'v1.0.1',
    description: 'Released on 10th May 2023.',
    features: [],
    changeLogs: {
      'UI Improvements': `- Improved search experience while editing manual lineage.
- Improved security with masked API token for Looker connection.
- The tier component has been revamped.
- Added Pagination support on the Data Model page.
- Added startDate to create ingestion flow.
- Search improvements have been made on the Explore page.
- Multiple UI tweaks have been made for better user experience, such as image placeholder improvements, text alignment and custom connectors icons.`,
      Notifications: `- Alert notifications have been added for Data Insights Report.`,
      Glossary: `- Earlier, we only supported changing or updating the Glossary Owner. Now, we even support the removal of Owner from Glossary as well as Glossary Terms.`,
      Ingestion: `- Fixed CVE vulnerability for ingestion docker image.
- Now, we fetch views and view definitions from Hive and Impala.
- Added a test connection step for verifying the Owner details in Tableau.
- Profiler logs have been improved.
- Fixed the issues reported around ingestion`,
    },
  },
  {
    id: 15,
    version: 'v1.0.2',
    description: 'Released on 24th May 2023.',
    features: [],
    changeLogs: {
      'UI Improvements': `- Supports a separate column for Classification and Glossary in the following entities: Topic, Dashboard, Pipeline, ML Model, Container, and Data Model.
- Improved Sample Data tab UX for Tables.
- **Email** is now displayed on the Teams page. Users can edit their Email.
- The **custom logo** can be configured from the UI. The logo will be displayed on the Login page and app bar.
- UI supports updating the displayName for service, database, schema, and all other assets.
`,
      Ingestion: `- Supports custom database name for Glue.
- Fixed Postgres lineage ingestion for version 11.6.
- Added **api_version** and **domain** fields to Salesforce connector.
- Kerberos libraries have been added to ingestion image.
- PII flags have been further restricted for column names.
- Fixed GitHub reader for LookML.
- Restructured the Tableau data models ingestion.
- Fixed the basic auth for Kafka.
      `,
      Backend: `- Fixed vulnerabilities for dependencies.
- Supports custom logo from backend.
- Fixed a bug related to random password.
- By default, service connection details will be masked for users, and unmasked for bots. Users will be able to view based on their view permissions.
- Fixed Elasticsearch indexing issues for a large number of objects.

      `,
    },
  },
  {
    id: 16,
    version: 'v1.1.0',
    description: 'Released on 29th Jun 2023.',
    features: [
      {
        title: 'OpenMetadata UI Makeover',
        description:
          'Experience the revamped OpenMetadata UI, designed to enhance user experience with  a simplified Landing Page to make the adoption easier for new users. The simplified Explore view has an improved asset details section. The filtering left panel is now part of the filtering selection at the top. The Lineage View now supports column pagination and filtering',
        isImage: false,
        path: 'https://www.youtube.com/embed/fMSRi6Azj5I',
      },
      {
        title: 'Data Quality Redesigned',
        description:
          'OpenMetadata has redesigned Data Quality Tests to improve the end-user experience and prevent unnecessary duplication of tests. Data Quality Tests now have a Resolution Field. Users can acknowledge any errors, and once failures are resolved, they can document the resolution directly in the OpenMetadata UI.',
        isImage: false,
        path: 'https://www.youtube.com/embed/J-v2ySfOgEI',
      },
      {
        title: 'PII Masking',
        description:
          'PII Masking capabilities have been introduced in OpenMetadata in the 1.1 Release. Admins and Asset Owners can view PII data, but other users cannot. PII sensitive sample data for Tables, Topics, Profiler Metrics, Test Cases, and Queries will be masked. This feature goes perfectly with the Auto-Tagging capability in OpenMetadata.',
        isImage: false,
        path: 'https://www.youtube.com/embed/Lomg5G_-JQE',
      },
    ],
    changeLogs: {
      'UI Improvements': `- Simplified Landing Page to make the adoption easier for new users. We'll keep iterating on improving the UX for first-time users.
- Simplified Explore view with improved asset details section. The filtering left panel is now part of the filtering selection at the top.
- Lineage View now supports column pagination and filtering.
- Views show their DDL on the Table details page.
`,
      'Data Quality': `- Redesigned [Data Quality Tests](https://github.com/open-metadata/OpenMetadata/issues/11592) to improve the end-user experience and prevent unnecessary duplication of tests.
- Data Quality Tests now have a Resolution Field. Users can acknowledge any errors, and once failures are resolved, they can document the resolution directly in the OpenMetadata UI.
- Fixed a large number of connections being opened by the profiler workflow.
- Improved Customer SQL test to allow users to set a threshold for the expected number of rows to be returned.
- Added multi-project support for the BigQuery Profiler.
- Fetch table metrics from system tables when information is available.
- Improved Snowflake Profiling performance of System Metrics.`,
      Ingestion: `- Improved [SQL Lineage Parsing](https://github.com/open-metadata/OpenMetadata/issues/7427). We continue to share the OSS love by contributing to [sqllineage](https://github.com/reata/sqllineage) and [sqlfluff](https://sqlfluff.com/), the base libraries for our lineage features.
- Improved LookML metadata ingestion, with added support for projects based on Bitbucket.
- dbt bug fixes, added support for database, schema and table filtering and lineage management for ephemeral models.
- PowerBI metadata ingestion now supports Reports and Dataset lineage from multiple workspaces.
- Improved Tableau Data Models ingestion now ingests Data Sources.
- AWS Glue support for Partition Column Details.
- New Oracle lineage and usage workflows based on the query history.
- IAM role-based authentication for MySQL and Postgres RDS databases.
- Fixed dashboard description wrongly reported description as completed in the Data Insight.
      `,
      Connectors: `- New [Spline](https://absaoss.github.io/spline/) Connector to extract metadata and lineage from Spark jobs. Regardless of where the Spark execution happens, if you have configured the Spline Agent, we can send Spark metadata to OpenMetadata.
- New [SAP Hana](https://www.sap.com/products/technology-platform/hana/what-is-sap-hana.html) Connector, our first integration to the SAP ecosystem.
- New [MongoDB](https://www.mongodb.com/) Connector, extracting Collections as Tables.
- Added support for [Databricks Unity Catalog](https://www.databricks.com/product/unity-catalog) for metadata and lineage extraction. If your Databricks instance supports the Unity Catalog, you can enable it in the Connection Details section to use this metadata extraction method instead of getting metadata out of the metastore and history APIs.`,
      Backend: `- PII masking of Sample data for Tables and Topics, Profiler Metrics, Test Cases, and Queries for users that are not admins or owners of the assets. In 1.2, we'll iterate on this logic to add Roles & Policies support for masking PII data.
- Name and FQN hashing of data in the database. This reduces the length of the data being stored and indexed, allowing us for longer FQNs in the Metadata Standard.
- Improved monitoring of the Pipeline Service Client health. Any status errors between the OpenMetadata server and the Pipeline Service Client are now surfaced in a Prometheus metric *pipelineServiceClientStatus_counter_total*
- Added AWS OpenSearch client-specific support. This allows us to update the Elasticsearch version support up to 7.16.
      `,
    },
  },
  {
    id: 17,
    version: 'v1.1.1',
    description: 'Released on 4th Aug 2023.',
    features: [],
    changeLogs: {
      'UI Improvements': `- User profile page UI / UX improvements
- Superset Connection fixes for Basic and IAM auth type
- Fix task flow bugs
- UI / UX improvements for Service, Database, and Schema pages
- Support custom cron for schedule ingestion
`,
      'Data Quality': `- Fix BigQuery, MSSQL, and Clickhouse profiling errors`,
      Ingestion: `- Fixed Airflow lineage extraction
- Added support for Databricks complex columns comments
- Fixed Athena lineage and usage parameter validation
- Airflow Managed APIs now support Airflow 2.6`,
      Connectors: `- New Qliksense Connector
- Hive supports extracting metadata directly from the metastore to speed up the execution. Users whose metastore is not exposed can still run the extraction pointing to Hive
- Added Usage & Lineage connector for Trino
- Impala scheme has been deprecated from Hive connector. Users can use the Impala connector instead
- Snowflake can now ingest TRANSIENT tables
- Added support for JSON fields in SingleStore`,
      Backend: `- Bumped table and column names length
- Aggregation Improvements for Search
- Test Suite Improvements
      `,
    },
  },
  {
    id: 18,
    version: 'v1.1.2',
    description: 'Released on 22nd Aug 2023.',
    features: [],
    changeLogs: {
      'UI Improvements': `- Added Russian language support.
- Supports Delete functionality for sample data.
- Improved Schema page UX.
- Table mentions now show Service, Schema and Database information.
- Fixed the version history list.
`,
      'Data Quality': `- Added support for Postgres version 11.19.
- Fixed MariaDB time column issues.`,
      Ingestion: `- Improved performance when ingesting table constraints.`,
      Connectors: `- Added JWT authentication support for Trino
- Fixed Snowflake connection test.
- Fixed SageMaker ingestion.
- Added external table support for BigQuery.`,
      Backend: `- Improved Glossary import validations.
- Fixed Test Suite migrations and naming.
- Fixed Classification migration.
- Deprecated Flyway and using native migrations.
- Improved Test Suite UI performance.
      `,
    },
  },
  {
    id: 19,
    version: 'v1.2.0',
    description: 'Released on 26th Oct 2023.',
    features: [
      {
        title: 'Domain',
        description:
          'OpenMetadata 1.2.0 release now supports the creation of Domains. Assets can be added to a Domain, and users can scope their discovery experience to one Domain. Assets can also be added as Data Products in a Domain.',
        isImage: false,
        path: 'https://www.youtube.com/embed/t-9G3vaSdjI',
      },
      {
        title: 'Data Products',
        description:
          'OpenMetadata 1.2.0 release now supports data products. Assets can be added as Data Products in a Domain.',
        isImage: false,
        path: 'https://www.youtube.com/embed/6NgI_G38D0A',
      },
      {
        title: 'Metadata Applications',
        description:
          'In the OpenMetadata 1.2.0 release, we support Search Index, Data Insights, and the Data Insights Report as applications. Each App represents an automation or a feature that acts on the metadata and can drive automation. Admins can install and setup the applications.',
        isImage: false,
        path: 'https://www.youtube.com/embed/pUS9-RevqsU',
      },
      {
        title: 'Customizable Landing Page',
        description:
          'OpenMetadata 1.2.0 release now supports the creation of Personas. Also, landing pages can be customized with widgets for various Personas. That way, you can ensure that the OpenMetadata landing page displays what is most important for a particular data team.',
        isImage: false,
        path: 'https://www.youtube.com/embed/Y-5cPQgzNdo',
      },
      {
        title: 'Knowledge Center (Exclusively for Collate)',
        description:
          'Knowledge Center, where organizations can create and share Knowledge Articles with their Data Team. Custom build your knowledge articles to be specific for a Domain, Team, or Data Asset.',
        isImage: false,
        path: 'https://www.youtube.com/embed/DfOgeZ9f7no',
      },
      {
        title: 'Cost Analysis Report (Exclusively for Collate)',
        description:
          'Cost Analysis Charts that captures metrics on the Last access time, Last accessed by, and so on. This helps organizations to analyze the cost based on data asset usage. This report is visible as part of the Data Insights Report.',
        isImage: false,
        path: 'https://www.youtube.com/embed/KI58oBHxTOU',
      },
    ],
    changeLogs: {
      'Domains and Data Products': `- Added support for Domains and Data Products.
- Assets can be added to a Domain, and users can scope their discovery experience to one Domain.
- Assets can also be added as Data Products in a Domain.`,
      'Search Index': `- Elasticsearch or Open Search connectors can now bring in the search index metadata into OpenMetadata.
- The connector will populate the index's mapping, settings, and sample data.`,
      'Stored Procedures': `- Added support for Stored Procedures.
- Snowflake, Redshift, and BigQuery connectors are updated to bring stored procedure metadata into OpenMetadata.
- The metadata workflow will bring the Stored Procedures and parse their executions to extract lineage information.`,
      'Glossary Approval Workflow & Glossary Styling': `- Introduced a glossary approval workflow. An approval workflow is created if Reviewers are added to a glossary.
- A task is added for reviewers to approve or reject the glossary term. The terms will show up in Draft status.
- Only the reviewers can approve or reject the term.
- Conversations are supported to discuss further about the terms.
- If no reviewer is added, then the glossary terms are approved by default.
- Introduced styling for glossary terms. Now you can add icons and color code the glossary terms for easy identification.
- Color coding helps to visually differentiate and identify the data assets, when glossary terms are added to them.`,
      'OpenMetadata Browser Extension': `- Updated the Chrome browser extension for OpenMetadata with the new UI.
- Added support for Databases, Database Schemas, Tables, Dashboards, Charts, Pipelines, and Topics.`,
      'Build Automation Applications': `- Added Applications into OpenMetadata, giving users a unique view of processes that can be scheduled and run in the platform.
- Search Indexing and Data Insights Report have been converted into Applications.
- UI displays all the available applications, which Admins can add or schedule.
- We will continue to add new Applications in upcoming releases.`,
      Lineage: `- Performance improvements made for lineage based on the new release of SQLfluff.
- Added support for **UPDATE ... FROM** Snowflake queries
- Added column-level lineage support for **SELECT * queries**`,
      Connectors: `- Greenplum connector is now supported.
- Couchbase connector is now supported.
- Azure Data Lake Storage connector is supported ${CollateIconWithLinkMD}`,
      'Customizable Landing Page': `- Admins can create Personas to group individuals in their company, such as Data Engineers, Data Stewards, or Data Scientists.
- Admins can customize the landing page for each Persona with a set of supported widgets: Activity Feed, Announcements, Knowledge Center, etc.
- We will add support for more widgets in upcoming releases.`,
      [`Knowledge Center ${CollateIconWithLinkMD}`]: `- Backend APIs support creating, editing, and listing knowledge articles (with external links).
- Knowledge articles and links can be associated with a Domain, Team, or an Entity.
- UI support to build a Knowledge Center and expand the documentation of your company.`,
      [`Cost Analysis Report ${CollateIconWithLinkMD}`]: `- The Usage Workflow will now also track how tables are Accessed and Updated.
- This information will be used in the Data Insights workflow to show the evolution of your used and unused assets and compare them by size.
- Support has been added for Snowflake, and we will continue to add more sources in upcoming releases.`,
    },
  },
  {
    id: 20,
    version: 'v1.2.3',
    description: 'Released on 7th Dec 2023.',
    features: [],
    changeLogs: {
      Glossary: `- Improvements have been made to add assets in bulk to a glossary term
- An Assets filter has been introduced to quickly find and add assets to a glossary term.
- Improvements have been made with the glossary term deletion.
`,
      'Other Changes': `- RTL support for description and feed editor.

- Display name is now supported in the Description title.

- The property tagType added and can be used when suggesting tags.

- Initial options updated for Tag suggestions.

- The ingestion framework now supports the deletion of data models and stored procedures.

- Assets can be added in bulk to Domains, Data Products, and to Teams.

- OpenMetadata base server has been upgraded to Alpine 3.18.5.

- The ingestion dependencies for database connections have been updated.

- Improvements have been made to the data insights ingestion.

- Fixed the issue with Tag version page.

- Fixed the issue with task filter pipeline, which created duplicate columns.

- Fixed issue with the creation of glossary terms.

- Issue resolved with custom properties on glossary terms.

- Fixed the missing tags issue on editing a glossary term.

- Fixed the pipeline task filtering for failed status.

- Fixed the issue with scroll bar in the Explore page.

- UI issues with data quality test cases fixed.

- Fixed the issue with ingestion bot deleting the assets assigned to data products.
      `,
    },
  },
  {
    id: 21,
    version: 'v1.2.4',
    description: 'Released on 5th Jan 2024.',
    features: [],
    changeLogs: {
      Changes: `- To ensure a reliable Glossary Term Approval process, the Owner/Creator of the glossary term cannot be a Reviewer of that term.
- Long glossary term names are truncated.
        `,
      Improvements: `- Fixed a redirecting issue with the Glossary page.
- Fixed an issue with Tasks for the Dashboard charts.
- Fixed an issue with Profiler ingestion.
- Fixed an issue with the Version page.
- Fixed an issue with Connection details.
- Fixed an issue with loading the Custom Property page.
- Fixed an issue with Search Indexing.
- Security fixes have been made.
        `,
    },
  },
  {
    id: 22,
    version: 'v1.3.0',
    description: 'Released on 5th Feb 2024.',
    features: [
      {
        title: 'Settings UI',
        description:
          'OpenMetadata Settings page UI has been revamped to provide an intuitive and user-friendly interface.',
        isImage: false,
        path: 'https://www.youtube.com/embed/qE07HNFXyu8',
      },
      {
        title: 'RTL Support',
        description:
          'OpenMetadata now boasts support for ten languages, having expanded beyond English, French, Chinese, German, Japanese, Portuguese, Russian, and Spanish to include Hebrew and Dutch. To accommodate the Hebrew language, we have implemented substantial UI changes to ensure seamless RTL (right-to-left) support.',
        isImage: false,
        path: 'https://www.youtube.com/embed/MCjK6fZg3pw',
      },
      {
        title: 'Intuitive Lineage UI',
        description:
          'The lineage UI has been revamped to provide an intuitive and comprehensive view of data lineage to facilitate a deeper understanding of the flow and transformations within your data assets.',
        isImage: false,
        path: 'https://www.youtube.com/embed/grwhvTWylbw',
      },
      {
        title: 'Custom Metrics for Profiler',
        description:
          'OpenMetadata has enhanced profiling capabilities, so you can generate your own metrics using custom SQL. You can create custom metrics for the profiler at the Table and Column levels.',
        isImage: false,
        path: 'https://www.youtube.com/embed/1sx5aQKMSBI',
      },
      {
        title: 'Incidents Manager',
        description:
          'The Incidents Manager serves as a centralized hub, streamlining the resolution process and reinforcing the integrity of your data. It provides a comprehensive summary of unresolved failed test cases, offering details on failure severity and the resolution flow.',
        isImage: false,
        path: 'https://www.youtube.com/embed/wz5vc1Al-b8',
      },
      {
        title: 'Data Observability',
        description:
          'In the 1.3 release, data observability alerts have been distinguished from the other general-purpose notifications, making it easy to get to the crucial alerts quickly.',
        isImage: false,
        path: 'https://www.youtube.com/embed/qc-3sZ_eU5Y',
      },
      {
        title: 'Knowledge Center (Exclusively for Collate)',
        description:
          'In the 1.3 release, OpenMetadata supports hierarchical pages to structure the articles for a cohesive view and access. Now, it is easier to associate the knowledge articles with data assets with just a few clicks.',
        isImage: false,
        path: 'https://www.youtube.com/embed/atwTGm1hixg',
      },
    ],
    changeLogs: {
      Lineage: ` - Revamped the lineage UI for an intuitive and comprehensive view of data flow and transformations.
- Organized nodes for better visibility with pagination support.
- Improved the display of circular dependencies.
- Nodes display the service icons, highlight dbt models, and show Data Quality results.
- Lineage can be filtered to search by Ownership, Domain, Service, Service Type, Tier, and Classification Tags.
- Supports search by Column and traces lineage even when the columns are renamed.
- Enhanced user control with collapsible sub-graphs.
- Supports editing the SQL queries for lineage edges from the UI.
- Performance improvements for faster load of large graphs.`,
      'Data Observability Alerts': `- Data observability alerts have been distinguished from other general-purpose notifications, making it easy to get to the crucial alerts quickly.
- Sends alerts for schema changes and test case failures for the data assets that you follow.
- The overall flow has been simplified to let you easily create alerts for schema changes in your data.
- You can now get Data Quality alerts for specific Test Suites.
- Users will be alerted for all the changes to the data assets that they own.`,
      'Incident Manager': `- Introduced Incidents Manager to improve the data quality resolution flow.
- Incidents Manager summarizes all the test case results with information about the failure severity and resolution flow.
- Supports assigning a resolution task to the users in OpenMetadata.
- Tasks are created when a data quality test has been assigned to an Assignee or a Reviewer.
- Resolved test failure also displays the comments posted on the resolution.
- The Resolved Tab displays information on the Test case name, Execution date, Reason, Comments, and information on who Resolved the issue.`,
      [`Knowledge Center ${CollateIconWithLinkMD}`]: `- Supports hierarchical pages to structure the articles.
- You can easily associate knowledge articles with data assets.
- The data assets page displays the related articles.
- The block editor supports callouts to add notes, warnings, tables, and task lists.
- Quicklinks are no longer separate pages; they redirect to external links.
- Data assets can be associated with Quicklinks.
- Added Search support for Knowledge articles to filter by Owner or Tags.
- Supports preview for articles and Quicklinks.`,
      'Custom Metrics for Profiler': `- Supports custom metrics for the data profiler with custom SQL to keep track of your business metrics.
- Custom metrics can be created at Table and Column levels.`,
      'Profiler and Data Quality': `- The Profiler has been improved to support sample data ingestion without computing other metrics.
- Admins can configure the profiler to fetch up to 10,000 rows of sample data.
- Sample data can be stored in S3 buckets.
- Refined the default time range on the test case results page, adjusting it from the Last 3 days to the Last 30 days for a more encompassing view.`,
      Connectors: `- New Google Cloud Storage for storage services. ${CollateIconWithLinkMD}
- New Alation connector to migrate metadata into Collate. ${CollateIconWithLinkMD}
- New Iceberg, SAS Viya, and Doris connectors.
- Introduced the Spark Lineage Agent to extract metadata and end-to-end lineage from Spark jobs.
- MSSQL and Oracle now support Stored Procedures.
- We now exclude system indices from the Elasticsearch connector by default.
- Added support for DB2 IBM I Series.
- Pipeline services now get owner information.
- Performance improvements for the Tableau Connector.
- We now support metadata tag extraction from Databricks.
- Supports the attribute Table Owner for metadata ingestion from Postgres.
- We now extract table descriptions when ingesting metadata from Salesforce.`,
      Glossary: `- Supports soft delete for the default glossaries in OpenMetadata.
- Supports the creation of tasks to request tags or a description.
- Only the Owner can edit the Glossary term.
- Version history displays the Username instead of the User ID.`,
      Localization: `- Now supports RTL UI for the Hebrew language.
- New Dutch language translation.`,
      'Settings UI': `- The Settings page UI has been revamped.`,
      'Data Insights': `- Cost Analysis expanded to support BigQuery & Redshift. ${CollateIconWithLinkMD}
- Improved the Data Insights Report sent via email.`,
      'Other Changes': `- Announcements can be notified over email, Slack, or Teams.
- Alerts are sent to a user when they are mentioned in a task or activity feed.
- We have improved the display of search results for column matches. When searching for columns, the matched results will be displayed and highlighted in the Preview pane.
- Table Type filter has been added in the Advanced Search, so that users can exclude the temporary or staging tables from search.
- Now it is easy to filter the Data assets without a Owner.
- Database and Schema were added to the Explore menu to enhance data discovery.
- Custom properties are displayed on the right of the data asset details page.
- We now display the Domain on the Users page.
- Supports the sorting of data assets by popularity based on the number of followers and thumbs up as signals.
- OpenMetadata can now handle metric history for ML models.
- When configuring the Email settings, the Username and Password fields can be left blank.
- We now support a test email button on the Email SMTP page.`,
    },
  },
  {
    id: 23,
    version: 'v1.3.1',
    description: 'Released on 29th Feb 2024.',
    features: [],
    changeLogs: {
      [`Knowledge Center ${CollateIconWithLinkMD}`]: `- Supports drag and drop for the hierarchy of knowledge articles.
- Enhanced the layout and loading experience of the knowledge page.
        `,
      Lineage: `- When adding a new node in Lineage, the Display Name is supported in search.
- Fixed the issues with displaying lineage from Metabase.
        `,
      Glossary: `- Improved the automation of performance tests for Glossary.
- Performance improvements to display a large Glossary.`,
      'Data Insights': `- Data Insights report has been improved.
- The cost Analysis report has been optimized.`,
      Notifications: `- The format for Slack notifications has been improved.`,
      'Custom Properties': `- Added enum type support for custom properties.`,
      Connectors: `- Now BigQuery connector supports Primary, Foreign, and Unique Constraints. It fetches the column description for views.
- Captures the SQL query that powers a Tableau DataModel.
- Azure Key Vault is supported as a Secrets Manager.
- Fixed an issue with ingestion from Sagemaker, Oracle, LDAP, DB2, dbt, Kafka, Metabase, and Databricks.
- Fixed Looker projects and optional project filter patterns.
- Fixed issues with ingestion pipelines.
- Fixed an issue with the service display name after ingestion.`,
      'Other Changes': `- The functionality for mutually exclusive tags has been disabled.
- PodGC set up for Argo workflows to delete the pods from the Kubernetes environment on a successful run of the pods.
- Fixed the issue with the display of the personal access token.
- Fixed the mentions in comments for Announcements.
- Fixed the issue with setting a Group as a Domain Owner.
- Fixed the issue with the tooltip in the data quality graph.
- Fixed an issue about notifying the Reviewer of a Glossary Term.
- Fixed the issues with testing the email settings.
- Fixed an issue with adding tags.`,
    },
  },
];
