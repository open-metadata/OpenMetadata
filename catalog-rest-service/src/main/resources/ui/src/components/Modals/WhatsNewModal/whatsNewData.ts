/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

/* eslint-disable max-len */

export const LATEST_VERSION_ID = 1;

export const COOKIE_VERSION = 'VERSION_0_5_0'; // To be changed with each release.

export const dummyImg = 'https://via.placeholder.com/725x278';

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
];
