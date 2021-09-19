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

export const LATEST_VERSION_ID = 0;

export const COOKIE_VERSION = 'VERSION_0_4_0';

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
        path: 'https://www.youtube.com/embed/SQbRjwZeqLg',
      },
      {
        title: 'Messaging service',
        description:
          'Users can also integrate with messaging services, such as Apache Kafka (and Apache Pulsar in progress) to discover Topics. Our Message Queue connectors extractTopic configurations, cluster information, and schemas from Apache Kafka and Confluent’s Schema Registry to provide all important information at your fingertips. Users can provide rich descriptions, tiering, ownership, and tags to the topics through the UI or APIs.',
        isImage: false,
        path: 'https://www.youtube.com/embed/KOjpWRK5wsY',
      },
      {
        title: 'Data Profiler & Sample Data',
        description:
          'The Data Profiler is a new feature that generates a data profile for a table during the ingestion process. The data profile will include information that will help understand data quality, such as data uniqueness, null counts, max and min, etc. The Data Sampler will collect sample data from an ingested table so that it can be subsequently used to get a sense of the data',
        isImage: false,
        path: 'https://www.youtube.com/embed/klOiCtYprIg',
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
];
