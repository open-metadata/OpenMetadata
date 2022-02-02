/*
 *  Copyright 2021 Collate
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

export const LATEST_VERSION_ID = 4;

export const COOKIE_VERSION = 'VERSION_0_8_0'; // To be changed with each release.

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
];
