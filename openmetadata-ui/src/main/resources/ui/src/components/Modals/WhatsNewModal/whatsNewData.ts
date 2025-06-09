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

import incidentManagerSampleData from '../../../assets/img/incidentManagerSampleData.png';
import profilerConfigPage from '../../../assets/img/profilerConfigPage.png';
import collateIcon from '../../../assets/svg/ic-collate.svg';

export const COOKIE_VERSION = 'VERSION_1_7_1'; // To be changed with each release.

// for youtube video make isImage = false and path = {video embed id}
// embed:- youtube video => share => click on embed and take {url with id} from it

const CollateIconWithLinkMD = `[![Collate](${collateIcon})](https://www.getcollate.io/)`;

export const WHATS_NEW = [
  {
    id: 25,
    version: 'v1.4.0',
    description: 'Released on 21st May 2024.',
    features: [
      {
        title: 'Automations',
        description:
          'We have introduced Automations to easily maintain high-quality metadata at scale. The Automations streamline governance processes from ownership assignments to tagging, ensuring compliance and consistency. We have added support for the following actions: adding and removing owner, tier, domain, tags, glossary terms and descriptions, ML PII tagging, and propagation of tags and glossary terms through lineage.',
        isImage: false,
        path: 'https://www.youtube.com/embed/zdh4yzHw4w0',
      },
      {
        title: 'Bulk Upload Data Assets',
        description:
          'We have added support for bulk uploading data assets. Users can bulk upload database, schema, and table entities from a CSV file for quick edition or creation. The inline editor helps to validate and update the data assets before importing. Save time by bulk uploading data assets.',
        isImage: false,
        path: 'https://www.youtube.com/embed/CXxDdS6AifY',
      },
      {
        title: 'Data Quality Widget',
        description:
          'A new Data Quality Widget has been added. It lists the summary of data quality tests belonging to a user or their team. Customize your Collate landing page to suit your requirements.',
        isImage: false,
        path: 'https://www.youtube.com/embed/Kakfa-lYGOU',
      },
      {
        title: 'Lineage Layers',
        description:
          'The lineage view in OpenMetadata has been improved. All the nodes are expanded by default. A new ‘Layers’ button has been introduced. Users can choose to view the column level lineage. In the Data Observability View, the data quality results are displayed, such as Success, Aborted, or Failed. The pipeline status displays the last execution run.',
        isImage: false,
        path: 'https://www.youtube.com/embed/wtBMeLvA6Sw',
      },
      {
        title: 'Column Lineage Search',
        description:
          'You can search lineage by column names. You can accurately trace the upstream and downstream nodes by column. OpenMetadata helps you to easily trace and visualize how data is transformed and where it is used in your organization.',
        isImage: false,
        path: 'https://www.youtube.com/embed/KZdVb8DiHJs',
      },
      {
        title: 'Custom Properties',
        description:
          'OpenMetadata has been empowering users to enrich the data assets by extending their attributes with custom properties. Custom Properties now allow linking other assets in the platform, such as Tables, Dashboards, etc. To enable this, create a Custom Property as an Entity Reference or Entity Reference List.',
        isImage: false,
        path: 'https://www.youtube.com/embed/lZoSeKkErBk',
      },
      {
        title: 'Custom Theme',
        description:
          "OpenMetadata previously supported uploading your company logo, monogram, and favicon to customize the platform's appearance according to your brand identity. Now, you can take it a step further by customizing the theme with colors that perfectly align with your company's branding.",
        isImage: false,
        path: 'https://www.youtube.com/embed/-NiU1flBHs0',
      },
      {
        title: 'Data Quality Filters',
        description:
          'We have improved the filters for data quality. Now you have additional filtering options for test suites and test cases.',
        isImage: false,
        path: 'https://www.youtube.com/embed/UNOHvBMVcYM',
      },
      {
        title: 'Data Profiler',
        description:
          'A global profiler configuration page has been implemented for the data profiler. This allows Admins to exclude certain metric computations for specific data types. Navigate to Settings > Preferences > Profiler Configuration to define the metrics to compute based on column data types.',
        isImage: true,
        path: profilerConfigPage,
      },
      {
        title: 'Incident Manager',
        description:
          'Based on the latest failed test cases, a sample of failed rows will be displayed in the Incident Manager. Users can quickly verify the cause of failure based on this sample data. The failed sample data will be deleted once the issue is resolved. This is a Collate only feature.',
        isImage: true,
        path: incidentManagerSampleData,
      },
    ],
    changeLogs: {
      ['Backward Incompatible Changes']: `
Tooling:
-   Metadata Backup/Recovery is deprecated. No further support will be provided.
-   Users are advised to use database native tools to backup and store it in their object store for recovery.
-   bootstrap/bootstrap_storage.sh has been deprecated in favor of bootstrap/openmetadata-ops.sh

UI:
-   Activity has been improved. New update specific cards display critical information such as data quality test case updates, description, tag update or removal.
-   For Lineage, the Expand All button has been removed. A new Layers button is introduced at the bottom left corner. With the Layers button, you can add Column Level Lineage or Data Observability details to your Lineage view.
-   View Definition is now renamed as Schema Definition.
-   Adding Glossary Term view is improved. Now we show glossary terms hierarchically enabling a better understanding of how the terms are setup while adding it to a table or dashboard.
-  For Classification, users can set classification to be mutually exclusive only **at the time of creation**. Once created, you cannot change it back to mutually non-exclusive or vice-versa. This is to prevent conflicts of adding multiple tags that belong to same classification and later turning the mutually exclusive flag back to true.

API:
-   Table Schema's ViewDefinition is now renamed to SchemaDefinition to capture Tables' Create Schema.
-   Bulk Import API now creates entities if they are not present during the import.
-   Table's TestSuite is migrated to EntityReference. Previously it used to store entire payload of TestSuite.
`,
      [`Automations ${CollateIconWithLinkMD}`]: `-  Easily maintain high-quality metadata at scale with automations. The Automations streamline governance processes from ownership assignments to tagging, ensuring compliance and consistency.
-   You can update the properties of your assets by filtering by service, owner, domain, or any other supported property from the advanced search.
-   Easily see which assets have been selected by jumping to the Explore page in one click.
-   For tables, data models, topics, and search indexes, you can apply the action to their columns or fields.
-   We added support for the following actions: adding and removing owner, tier, domain, tags, glossary terms and descriptions, ML PII tagging, and propagation of tags and glossary terms through lineage.`,

      [`Bulk Upload Data Assets  ${CollateIconWithLinkMD}`]: `-   Bulk upload/download database, schema, and table entities from/into a CSV file for quick edition or creation.
-   Supports an inline editor to validate/update assets before performing the upload.`,

      'Data Quality Improvements': `-   The Table schema page now shows the Data Quality tests for each column.
-   Improved filtering options for test suite and test cases.
-   We have improved how the UI fetches the Data Quality details for improved performance.
-   We now compute Unique and Count in the same query to avoid inconsistency due to the high frequency of data insertion.
-   Fixed the issue with removing the test case description upon the test case display name change.
-   Support has been added for an empty string as a missing count.`,

      'Data Profiler': `-   Implemented a global profiler configuration page, allowing admin to exclude certain metric computations for specific data types.
-   Added profiler support for Redshift complex types and DynamoDB.
-   Fixed an issue with performing sum operations for large values in profiler ingestion.
-   Fixed the histogram unit's issues with scientific notation.`,

      'Incident Manager': `-   We now display a sample of failed rows for the latest failed test cases. Once the issue is resolved, the failed sample will be deleted. ${CollateIconWithLinkMD}
-   Fixed the Date time filter for the Incident Manager.
-   Notifications are sent for the tasks created by the Incident Manager.`,

      'Lineage Improvements': `-   OpenMetadata already supports Column-level lineage, and now we have introduced Task-level lineage for Pipelines, Chart-level lineage for Dashboards, Feature-level lineage for ML Models, Field-level lineage for Topics, and columns for dashboard Data Models.
-   Automated column-level lineage is now supported for Tableau, Superset, QlikCloud, and QlikSense between Data Models and Tables.
-   The child nodes in a lineage graph are sorted in alphabetical order.
-   Improved the log of failed-to-parse queries.
-   Fixed an issue with automated column-level lineage overwriting the pipeline lineage and manual column lineage.
-   Snowflake & Databricks now supports automated lineage between external tables and their origin storage container.
-   Lineage can be exported as a CSV file.
-   OpenMetadata spark agent now supports automated lineage between tables and their origin storage container.
-   Fixed an issue with parsing lineage queries for Redshift.
-   Now, we support pipeline as an edge between any two entity types.
-   We now parse PowerBi DAX files for lineage.
-   Support has been added for dynamic tables.`,

      'Data Insights': `- Previously, the data insights reports displayed only the percentage coverage of ownership and description. Now, users can drill down to view the data assets with no owner or description.
-   Improved the UX for data insight filters.`,

      [`Cost Analysis ${CollateIconWithLinkMD}`]: `-   Lifecycle data for Cost Analysis has been implemented for BigQuery, Snowflake, and Redshift.`,

      'Custom Theme': `-   Previously supported adding logo, monogram, and favicon to your OpenMetadata instance.
-   Now, it supports customizing the theme with colors to suit your company branding.`,

      [`Landing Page Widgets ${CollateIconWithLinkMD}`]: `-  Added a Data Quality Widget to list the summary of data quality tests belonging to a user or their team.`,

      'Ingestion Performance Improvements': `-   Bigquery, Redshift, and Snowflake now support incremental metadata ingestions by scanning DML operations on the query history.
-   Database Services now support parallelizing the metadata ingestion at each schema.`,

      Connectors: `-   Now supports a new connector for [QlikCloud](https://www.qlik.com/us/products/qlik-cloud).
-   New Kafka Connect connector
-   We now parse complex protobuf schemas for Kafka
-   Improved model storage ingestion for Sagemaker and Mlflow.
-   Added an option to include or exclude drafts from dashboards.
-   Added an option to include or exclude paused pipelines in Airflow.
-   Revamped SSL support to allow users to upload the required certificates directly in the UI.
-   The character support has been enhanced for tag ingestion to include /.
-   In the Oracle connector, we rolled back to use all_ tables instead of dba_.
-   Added support for Azure auth in Trino.
-   For QlikSense, we have added an option to disable SSL validation.`,

      'Custom Properties': `-   Custom Properties now allow linking other assets in the platform, such as Tables, Dashboards, etc. To enable this, create a Custom Property as an Entity Reference or Entity Reference List.`,

      'Health Check': `-   Introduced the OpenMetadata Status page to do a Health Check on the setup information.

-   Helps identify missing or outdated credential information for ingestion pipeline, SSO, migration, and related issues.

-   Validates JWT authentication tokens for ingestion bots.`,

      Glossary: `-   The glossary term parent can now be changed from the Details page.
-   On the data assets page, glossary terms are displayed by hierarchy.`,

      'Alerts & Notification Improvements': `-   The Activity Feed provides more contextual information, removing the need to move to entity pages.
-   Alerts give more accurate information about the entity, as well as conversations and tasks.`,

      Localization: `-   Fixed localization issues in the confirmation logic for the delete function.
-   Fixed the search index language configuration.`,

      Roles: `
-   Now, roles can be inherited from the user configuration in SSO.`,

      Search: `-   You can now filter by assets without a description or an owner.
-   Improved the match results for search results.`,

      Others: `-   The description is auto-expanded when the data asset has no data and has the space to accommodate a lengthy description.
-   User email IDs have been masked and are only visible to Admins.
-   Users can filter Queries by owner, tag, and creation date in the UI.
-   Added a button in the Query Editor to copy the Query.
-   Improved Elasticsearch re-indexing.
-   Improved the charts based on custom metrics.
-   Improved the usage of the refresh token.
-   Redundant scroll bars have been removed from the UI.
-   Improved the bot role binding to provide more control over which roles are passed to the system bots.`,
    },
  },
  {
    id: 26,
    version: 'v1.4.1',
    description: `Released on 27th May 2024.`,
    note: "In 1.4.1, we provide migration fixes on top of the 1.4.0 release. Don't miss out the release highlights!",
    features: [
      {
        title: 'Automations',
        description:
          'We have introduced Automations to easily maintain high-quality metadata at scale. The Automations streamline governance processes from ownership assignments to tagging, ensuring compliance and consistency. We have added support for the following actions: adding and removing owner, tier, domain, tags, glossary terms and descriptions, ML PII tagging, and propagation of tags and glossary terms through lineage.',
        isImage: false,
        path: 'https://www.youtube.com/embed/zdh4yzHw4w0',
      },
      {
        title: 'Bulk Upload Data Assets',
        description:
          'We have added support for bulk uploading data assets. Users can bulk upload database, schema, and table entities from a CSV file for quick edition or creation. The inline editor helps to validate and update the data assets before importing. Save time by bulk uploading data assets.',
        isImage: false,
        path: 'https://www.youtube.com/embed/CXxDdS6AifY',
      },
      {
        title: 'Data Quality Widget',
        description:
          'A new Data Quality Widget has been added. It lists the summary of data quality tests belonging to a user or their team. Customize your Collate landing page to suit your requirements.',
        isImage: false,
        path: 'https://www.youtube.com/embed/Kakfa-lYGOU',
      },
      {
        title: 'Lineage Layers',
        description:
          'The lineage view in OpenMetadata has been improved. All the nodes are expanded by default. A new ‘Layers’ button has been introduced. Users can choose to view the column level lineage. In the Data Observability View, the data quality results are displayed, such as Success, Aborted, or Failed. The pipeline status displays the last execution run.',
        isImage: false,
        path: 'https://www.youtube.com/embed/wtBMeLvA6Sw',
      },
      {
        title: 'Column Lineage Search',
        description:
          'You can search lineage by column names. You can accurately trace the upstream and downstream nodes by column. OpenMetadata helps you to easily trace and visualize how data is transformed and where it is used in your organization.',
        isImage: false,
        path: 'https://www.youtube.com/embed/KZdVb8DiHJs',
      },
      {
        title: 'Custom Properties',
        description:
          'OpenMetadata has been empowering users to enrich the data assets by extending their attributes with custom properties. Custom Properties now allow linking other assets in the platform, such as Tables, Dashboards, etc. To enable this, create a Custom Property as an Entity Reference or Entity Reference List.',
        isImage: false,
        path: 'https://www.youtube.com/embed/lZoSeKkErBk',
      },
      {
        title: 'Custom Theme',
        description:
          "OpenMetadata previously supported uploading your company logo, monogram, and favicon to customize the platform's appearance according to your brand identity. Now, you can take it a step further by customizing the theme with colors that perfectly align with your company's branding.",
        isImage: false,
        path: 'https://www.youtube.com/embed/-NiU1flBHs0',
      },
      {
        title: 'Data Quality Filters',
        description:
          'We have improved the filters for data quality. Now you have additional filtering options for test suites and test cases.',
        isImage: false,
        path: 'https://www.youtube.com/embed/UNOHvBMVcYM',
      },
      {
        title: 'Data Profiler',
        description:
          'A global profiler configuration page has been implemented for the data profiler. This allows Admins to exclude certain metric computations for specific data types. Navigate to Settings > Preferences > Profiler Configuration to define the metrics to compute based on column data types.',
        isImage: true,
        path: profilerConfigPage,
      },
      {
        title: 'Incident Manager',
        description:
          'Based on the latest failed test cases, a sample of failed rows will be displayed in the Incident Manager. Users can quickly verify the cause of failure based on this sample data. The failed sample data will be deleted once the issue is resolved. This is a Collate only feature.',
        isImage: true,
        path: incidentManagerSampleData,
      },
    ],
    changeLogs: {
      ['Backward Incompatible Changes']: `
Tooling:
-   Metadata Backup/Recovery is deprecated. No further support will be provided.
-   Users are advised to use database native tools to backup and store it in their object store for recovery.
-   bootstrap/bootstrap_storage.sh has been deprecated in favor of bootstrap/openmetadata-ops.sh

UI:
-   Activity has been improved. New update specific cards display critical information such as data quality test case updates, description, tag update or removal.
-   For Lineage, the Expand All button has been removed. A new Layers button is introduced at the bottom left corner. With the Layers button, you can add Column Level Lineage or Data Observability details to your Lineage view.
-   View Definition is now renamed as Schema Definition.
-   Adding Glossary Term view is improved. Now we show glossary terms hierarchically enabling a better understanding of how the terms are setup while adding it to a table or dashboard.
-  For Classification, users can set classification to be mutually exclusive only **at the time of creation**. Once created, you cannot change it back to mutually non-exclusive or vice-versa. This is to prevent conflicts of adding multiple tags that belong to same classification and later turning the mutually exclusive flag back to true.

API:
-   Table Schema's ViewDefinition is now renamed to SchemaDefinition to capture Tables' Create Schema.
-   Bulk Import API now creates entities if they are not present during the import.
-   Table's TestSuite is migrated to EntityReference. Previously it used to store entire payload of TestSuite.
`,
      [`Automations ${CollateIconWithLinkMD}`]: `-  Easily maintain high-quality metadata at scale with automations. The Automations streamline governance processes from ownership assignments to tagging, ensuring compliance and consistency.
-   You can update the properties of your assets by filtering by service, owner, domain, or any other supported property from the advanced search.
-   Easily see which assets have been selected by jumping to the Explore page in one click.
-   For tables, data models, topics, and search indexes, you can apply the action to their columns or fields.
-   We added support for the following actions: adding and removing owner, tier, domain, tags, glossary terms and descriptions, ML PII tagging, and propagation of tags and glossary terms through lineage.`,

      [`Bulk Upload Data Assets  ${CollateIconWithLinkMD}`]: `-   Bulk upload/download database, schema, and table entities from/into a CSV file for quick edition or creation.
-   Supports an inline editor to validate/update assets before performing the upload.`,

      'Data Quality Improvements': `-   The Table schema page now shows the Data Quality tests for each column.
-   Improved filtering options for test suite and test cases.
-   We have improved how the UI fetches the Data Quality details for improved performance.
-   We now compute Unique and Count in the same query to avoid inconsistency due to the high frequency of data insertion.
-   Fixed the issue with removing the test case description upon the test case display name change.
-   Support has been added for an empty string as a missing count.`,

      'Data Profiler': `-   Implemented a global profiler configuration page, allowing admin to exclude certain metric computations for specific data types.
-   Added profiler support for Redshift complex types and DynamoDB.
-   Fixed an issue with performing sum operations for large values in profiler ingestion.
-   Fixed the histogram unit's issues with scientific notation.`,

      'Incident Manager': `-   We now display a sample of failed rows for the latest failed test cases. Once the issue is resolved, the failed sample will be deleted. ${CollateIconWithLinkMD}
-   Fixed the Date time filter for the Incident Manager.
-   Notifications are sent for the tasks created by the Incident Manager.`,

      'Lineage Improvements': `-   OpenMetadata already supports Column-level lineage, and now we have introduced Task-level lineage for Pipelines, Chart-level lineage for Dashboards, Feature-level lineage for ML Models, Field-level lineage for Topics, and columns for dashboard Data Models.
-   Automated column-level lineage is now supported for Tableau, Superset, QlikCloud, and QlikSense between Data Models and Tables.
-   The child nodes in a lineage graph are sorted in alphabetical order.
-   Improved the log of failed-to-parse queries.
-   Fixed an issue with automated column-level lineage overwriting the pipeline lineage and manual column lineage.
-   Snowflake & Databricks now supports automated lineage between external tables and their origin storage container.
-   Lineage can be exported as a CSV file.
-   OpenMetadata spark agent now supports automated lineage between tables and their origin storage container.
-   Fixed an issue with parsing lineage queries for Redshift.
-   Now, we support pipeline as an edge between any two entity types.
-   We now parse PowerBi DAX files for lineage.
-   Support has been added for dynamic tables.`,

      'Data Insights': `- Previously, the data insights reports displayed only the percentage coverage of ownership and description. Now, users can drill down to view the data assets with no owner or description.
-   Improved the UX for data insight filters.`,

      [`Cost Analysis ${CollateIconWithLinkMD}`]: `-   Lifecycle data for Cost Analysis has been implemented for BigQuery, Snowflake, and Redshift.`,

      'Custom Theme': `-   Previously supported adding logo, monogram, and favicon to your OpenMetadata instance.
-   Now, it supports customizing the theme with colors to suit your company branding.`,

      [`Landing Page Widgets ${CollateIconWithLinkMD}`]: `-  Added a Data Quality Widget to list the summary of data quality tests belonging to a user or their team.`,

      'Ingestion Performance Improvements': `-   Bigquery, Redshift, and Snowflake now support incremental metadata ingestions by scanning DML operations on the query history.
-   Database Services now support parallelizing the metadata ingestion at each schema.`,

      Connectors: `-   Now supports a new connector for [QlikCloud](https://www.qlik.com/us/products/qlik-cloud).
-   New Kafka Connect connector
-   We now parse complex protobuf schemas for Kafka
-   Improved model storage ingestion for Sagemaker and Mlflow.
-   Added an option to include or exclude drafts from dashboards.
-   Added an option to include or exclude paused pipelines in Airflow.
-   Revamped SSL support to allow users to upload the required certificates directly in the UI.
-   The character support has been enhanced for tag ingestion to include /.
-   In the Oracle connector, we rolled back to use all_ tables instead of dba_.
-   Added support for Azure auth in Trino.
-   For QlikSense, we have added an option to disable SSL validation.`,

      'Custom Properties': `-   Custom Properties now allow linking other assets in the platform, such as Tables, Dashboards, etc. To enable this, create a Custom Property as an Entity Reference or Entity Reference List.`,

      'Health Check': `-   Introduced the OpenMetadata Status page to do a Health Check on the setup information.

-   Helps identify missing or outdated credential information for ingestion pipeline, SSO, migration, and related issues.

-   Validates JWT authentication tokens for ingestion bots.`,

      Glossary: `-   The glossary term parent can now be changed from the Details page.
-   On the data assets page, glossary terms are displayed by hierarchy.`,

      'Alerts & Notification Improvements': `-   The Activity Feed provides more contextual information, removing the need to move to entity pages.
-   Alerts give more accurate information about the entity, as well as conversations and tasks.`,

      Localization: `-   Fixed localization issues in the confirmation logic for the delete function.
-   Fixed the search index language configuration.`,

      Roles: `
-   Now, roles can be inherited from the user configuration in SSO.`,

      Search: `-   You can now filter by assets without a description or an owner.
-   Improved the match results for search results.`,

      Others: `-   The description is auto-expanded when the data asset has no data and has the space to accommodate a lengthy description.
-   User email IDs have been masked and are only visible to Admins.
-   Users can filter Queries by owner, tag, and creation date in the UI.
-   Added a button in the Query Editor to copy the Query.
-   Improved Elasticsearch re-indexing.
-   Improved the charts based on custom metrics.
-   Improved the usage of the refresh token.
-   Redundant scroll bars have been removed from the UI.
-   Improved the bot role binding to provide more control over which roles are passed to the system bots.
-   Implemented a fix for SSL migration.`,
    },
  },
  {
    id: 27,
    version: 'v1.4.2',
    description: `Released on 10th June 2024.`,
    features: [],
    changeLogs: {
      Enhancements: `-  In OpenMetadata, we support connecting the data assets to the knowledge articles. The knowledge articles that are pulled from the Alation connector have image URLs. We have enhanced the Alation connector to download and display the images in the Knowledge Articles.
-   Test cases can now be filtered by Service, Tag, and Tier.`,
      Changes: `-   One team or multiple users can be selected as reviewers for a Glossary term.,
-   Updated the openmetadata.yaml to remove WebAnalyticsHandler.,
-   Add appType as part of the schema in the ingestion pipeline.,
-   We now sanitize the Activity Feed editor content.`,
      Improvements: `-   Fixed the lineage view for tables with many columns.
-   Fixed an issue with updating the lineage edge descriptions.
-   Fixed an issue with Null Schema Field.
-   Fixed the glossary term review process issues.
-   Fixed the Kafka SSL connection arguments.
-   Fixed an issue with dbt ingestion pipeline that was occurring due to non enum values.
-   Fixed an issue with Announcements.
-   Fixed redirection issues for Tags and Glossary Terms.
-   Fixed a minor issue with filtering the Profiler.
-   Fixed the registration Issue with Event Handlers.
-   Fixed the sign-in issues with SAML.
-   Fixed issues with partition migration with Redshift services.
-   Fixed an issue with the Quicksight connector.
-   Fixed some minor issues with the user Profile page.
-   Fixed some issues with the Teams page.`,
    },
  },
  {
    id: 28,
    version: 'v1.4.3',
    description: `Released on 15th June 2024.`,
    features: [],
    changeLogs: {
      Improvements: `- Fixed User Signup Flow Issue missing authorize.
-   Fixed vulnerabilities for azure-identity and msal4j.`,
    },
  },
  {
    id: 29,
    version: 'v1.4.4',
    description: `Released on 3rd July 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   Introduced SSL for Salesforce.
-   Fixed the claim mappings and usernames.
-   Fixed issues in Salesforce connector.
-   FIxed issues in Alation connector.
-   Verified for changes in new env for claim mapping.`,
    },
  },
  {
    id: 30,
    version: 'v1.4.5',
    description: `Released on 9th July 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   Improve query filtering with prepared statements.
-   Big fix in regex to match test case when using sampled data.
-   Bug fix in global profiler config for Snowflake, Redshift, and BigQuery.
-   Bug fix for Arg mismatch for DataModels in QlikSense.`,
    },
  },
  {
    id: 31,
    version: 'v1.4.6',
    description: `Released on 29th July 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   Fixed test case summary updates
-   Fixed Test Suite indexing
-   Fix repeated alerts being sent after no changes in the Entity
-   Fixed table import
-   Fixed an issue handling users with capital letters
-   Centralize OIDC flow handling
-   Fixed Ingestion Pipeline alert URL`,
    },
  },
  {
    id: 32,
    version: 'v1.4.7',
    description: `Released on 7th August 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   Resolved issue with Azure login related to email principal claims.`,
    },
  },
  {
    id: 33,
    version: 'v1.4.8',
    description: `Released on 21st August 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   Fix Entity listing API.
-   Fix user profile task listing.
-   Fix import/export UI flow ${CollateIconWithLinkMD}.
-   Improve SAML logging backend.
-   Add Unity Catalog Lineage Dialect.
-   Clean idle connections during ingestion.
-   Fix Databricks Describe Table during metadata ingestion.
-   Glossary Upload now shows permissions errors for non-owners.
-   Fix task not showing in the right panel after clicking, in the Activity Feed.
-   Support multiple dbt run_results.json for a single manifest for improved performance.`,
    },
  },
  {
    id: 43,
    version: 'v1.5.0',
    description: `Released on 26th August 2024.`,
    features: [
      {
        title: `Data Observability with Anomaly Detection (Collate)`,
        description: `OpenMetadata has been driving innovation in Data Quality in Open Source. Many organizations are taking advantage of the following Data Quality features to achieve better-quality data

1.  A Native Profiler to understand the shape of the data, freshness, completeness, volume, and ability to add your own metrics, including column level profiler over time-series and dashboards

2.  No-code data quality tests, deploy, collect results back to see it in a dashboard all within OpenMetadata

3.  Create alerts and get notified of Test results through email, Slack, NSteams, GChat, and Webhook

4.  Incident Manager to collaborate around test failures and visibility to downstream consumers of failures from upstream

In 1.5.0, we are bringing in Anomaly Detection based on AI to predict when an anomaly happens based on our learning historical data and automatically sending notifications to the owners of the table to warn them of the impending incidents.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/BPuNC8vPcsw',
      },
      {
        title: 'Enhanced Data Quality Dashboard (Collate)',
        description: `We also have improved the Table Data quality dashboard to showcase the tests categorized and make it easy for everyone to consume. When there are issues, the new dashboard makes it easier to understand the Data Quality coverage of your tables and the possible impact each test failure has by organizing tests into different groups.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/bXcQBtZuyoU',
      },
      {
        title: 'Freshness Data Quality Tests (Collate)',
        description: `Working with old data can lead to making wrong decisions. With the new Freshness test, you can validate that your data arrives at the right time. Freshness tests are a critical part of any data team's toolset. Bringing these tests together with lineage information and the Incident Manager, your team will be able to quickly detect issues related to missing data or stuck pipelines.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/QRcR3m9cCGo',
      },
      {
        title: 'Data Diff Data Quality Tests',
        description: `Data quality checks are important not only within a single table but also between different tables. These data diff checks can ensure key data remains unchanged after transformation, or conversely, ensure that the transformations were actually performed.

We are introducing the table difference data quality test to validate that multiple appearances of the same information remain consistent. Note that the test allows you to specify which column to use as a key and which columns you want to compare, and even add filters in the data to give you more control over multiple use cases.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/oxZVS_UGrE4',
      },
      {
        title: 'Domains RBAC & Subdomains',
        description: `OpenMetadata introduced Domains & Data Products in 1.3.0. Since then, many large organizations have started using Domains & Data Products to achieve better ownership and collaboration around domains that can span multiple teams.

In the 1.5.0 release, we added support for subdomains. This will help teams to organize into multiple subdomains within each domain.

**RBAC for Domains:**

With the 1.5.0 release, we are adding more stricter controls around Domain. Now teams/data assets/glossaries and classification can have domain concepts and can get a policy such that only users within a domain can access the data within a domain. Domain owners can use data products as a way to publish data products and showcase publicly available data assets from a specific domain.

This will help large companies to use a single OpenMetadata platform to unify all of their data and teams but also provide more stringent controls to segment the data between domains.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/r-_HaewjgTQ',
      },
      {
        title: 'Improved Explore Page & Data Asset Widget',
        description: `OpenMetadata, with its simple UI/UX and data collaboration features, is becoming more attractive to non-technical users as well. Data Governance teams are using OpenMetadata to add glossary terms and policies around metadata. Teams using Collate SaaS product are taking advantage of our Automations feature to gain productivity in their governance tasks.

Our new improved navigation on the Explore page will help users navigate hierarchically and find the data they are looking for. Users will see the data assets now grouped by service name -> database -> schema -> tables/stored procedures.

We are also making the discovery of data more accessible for users introducing a data asset widget, which will group the assets by platform type. This will help users find their data if they are working on a specific platform such as Looker or Snowflake they can easily click on that icon and get to the data.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/45ekUIRO1Ec',
      },
      {
        title: 'API as Data Asset',
        description: `The Internet runs using APIs, both producing and consuming data. Organizations today run many microservices and REST APIs to capture data from their users and update a transaction database in the backend.

On top of the many supported connectors across Databases, Dashboards, ML Models, etc. We believe that providing support for API Services as data assets will help to get the full picture of how the data is coming through from various services and landing into databases, going to warehouses and BI tools.

In 1.5.0 we are introducing APIs as another first-class entity. Teams can now capture API requests and responses payloads and use our column level lineage to capture the relation between APIs and any other asset in the platform.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/b9wrVnM3u80',
      },
    ],
    changeLogs: {
      ['Backward Incompatible Changes']: `**Multi Owners:**

- OpenMetadata allows a single user or a team to be tagged as owners for any data assets. In Release 1.5.0, we allow users to tag multiple individual owners or a single team. This will allow organizations to add ownership to multiple individuals without necessarily needing to create a team around them like previously.
- This is a backward incompatible change, if you are using APIs, please make sure the owner field is now changed to "owners"

**Import/Export Format:**

- To support the multi-owner format, we have now changed how we export and import the CSV file in glossary, services, database, schema, table, etc. The new format will be

    user:userName;team:TeamName

    **If you are importing an older file, please make sure to make this change.**

**Pydantic V2:**

- The core of OpenMetadata are the JSON Schemas that define the metadata standard. These schemas are automatically translated into Java, Typescript, and Python code with Pydantic classes.
- In this release, we have [migrated](https://docs.pydantic.dev/latest/migration/) the codebase from Pydantic V1 to Pydantic V2.

**Deployment Related Changes (OSS only):**

- **\`./bootstrap/bootstrap_storage.sh\` removed**
- OpenMetadata community has built rolling upgrades to database schema and the data to make upgrades easier. This tool is now called as \`./bootstrap/openmetadata-ops.sh\` and has been part of our releases since 1.3. The bootstrap_storage.sh doesn't support new native schemas in OpenMetadata. Hence, we have deleted this tool from this release.
- While upgrading, please refer to our Upgrade Notes in the documentation. Always follow the best practices provided there.

**Database Connection Pooling:**

- OpenMetadata uses Jdbi to handle database-related operations such as read/write/delete. In this release, we introduced additional configs to help with connection pooling, allowing the efficient use of a database with low resources.

- Please update the defaults if your cluster is running at a large scale to scale up the connections efficiently.

- For the new configuration, please refer to the [doc](https://docs.open-metadata.org/latest/deployment/database-connection-pooling) here

**Data Insights:**

- The Data Insights application is meant to give you a quick glance at your data's state and allow you to take action based on the information you receive. To continue pursuing this objective, the application was completely refactored to allow customizability.
- Part of this refactor was making Data Insights an internal application, no longer relying on an external pipeline. This means triggering Data Insights from the Python SDK will no longer be possible.
- With this change you will need to **run a backfill on the Data Insights** for the last couple of days since the Data Assets data changed.

**New Explore Page:**

- Explore page displays hierarchically organized data assets by grouping them into services > database > schema > tables/stored procedures. This helps users organically find the data asset they are looking for based on a known database or schema they were using. This is a new feature and changes the way the Explore page was built in previous releases.

**Connector Schema Changes:**

In the latest release, several updates and enhancements have been made to the JSON schema across various connectors. These changes aim to improve security, configurability, and expand integration capabilities. Here's a detailed breakdown of the updates.

-   **KafkaConnect:** Added \`schemaRegistryTopicSuffixName\` to enhance topic configuration flexibility for schema registries.
-   **GCS Datalake:** Introduced \`bucketNames\` field, allowing users to specify targeted storage buckets within the Google Cloud Storage environment.
-   **OpenLineage:** Added \`saslConfig\` to enhance security by enabling SASL (Simple Authentication and Security Layer) configuration.
-   **Salesforce:** Added \`sslConfig\` to strengthen the security layer for Salesforce connections by supporting SSL.
-   **DeltaLake:** Updated schema by moving \`metastoreConnection\` to a newly created \`metastoreConfig.json\` file. Additionally, introduced \`configSource\` to better define source configurations, with new support for \`metastoreConfig.json\` and \`storageConfig.json\`.
-   **Iceberg:** RestCatalog: Removed \`clientId\` and \`clientSecret\` as mandatory fields, making the schema more flexible for different authentication methods.
-   **DBT:** Cloud Pipelines: Added as a new connector to support cloud-native data transformation workflows using DBT.
-   **Looker:** Expanded support to include connections using GitLab integration, offering more flexible and secure version control.
-   **Tableau:** Enhanced support by adding capabilities for connecting with \`TableauPublishedDatasource\` and \`TableauEmbeddedDatasource\`, providing more granular control over data visualization and reporting.

**Include DDL:**

- During the Database Metadata ingestion, we can optionally pick up the DDL for both tables and views. During the metadata ingestion, we use the view DDLs to generate the View Lineage.
- To reduce the processing time for out-of-the-box workflows, we are disabling the include DDL by default, whereas before, it was enabled, which potentially led to long-running workflows.

**Secrets Manager**
Starting with the release 1.5.0, the JWT Token for the bots will be sent to the Secrets Manager if you configured one. It won't appear anymore in your dag_generated_configs in Airflow.

**Python SDK**
The \`metadata insight\` command has been removed. Since Data Insights application was moved to be an internal system application instead of relying on external pipelines the SDK command to run the pipeline was removed.`,
      [`Data Observability with Anomaly Detection ${CollateIconWithLinkMD}`]: `OpenMetadata has been driving innovation in Data Quality in Open Source. Many organizations are taking advantage of the following Data Quality features to achieve better-quality data

1.  A Native Profiler to understand the shape of the data, freshness, completeness, volume, and ability to add your own metrics, including column level profiler over time-series and dashboards

2.  No-code data quality tests, deploy, collect results back to see it in a dashboard all within OpenMetadata

3.  Create alerts and get notified of Test results through email, Slack, NSteams, GChat, and Webhook

4.  Incident Manager to collaborate around test failures and visibility to downstream consumers of failures from upstream\
In 1.5.0, we are bringing in Anomaly Detection based on AI to predict when an anomaly happens based on our learning historical data and automatically sending notifications to the owners of the table to warn them of the impending incidents.`,
      [`Enhanced Data Quality Dashboard ${CollateIconWithLinkMD}`]: `We also have improved the Table Data quality dashboard to showcase the tests categorized and make it easy for everyone to consume. When there are issues, the new dashboard makes it easier to understand the Data Quality coverage of your tables and the possible impact each test failure has by organizing tests into different groups.`,
      [`Freshness Data Quality Tests ${CollateIconWithLinkMD}`]: `Working with old data can lead to making wrong decisions. With the new Freshness test, you can validate that your data arrives at the right time. Freshness tests are a critical part of any data team's toolset. Bringing these tests together with lineage information and the Incident Manager, your team will be able to quickly detect issues related to missing data or stuck pipelines.`,
      ['Data Diff Data Quality Tests']: `Data quality checks are important not only within a single table but also between different tables. These data diff checks can ensure key data remains unchanged after transformation, or conversely, ensure that the transformations were actually performed.

We are introducing the **table difference** data quality test to validate that multiple appearances of the same information remain **consistent**. Note that the test allows you to specify which column to use as a key and which columns you want to compare, and even add filters in the data to give you more control over multiple use cases.`,
      ['Domains RBAC & Subdomains']: `OpenMetadata introduced Domains & Data Products in 1.3.0. Since then, many large organizations have started using Domains & Data Products to achieve better ownership and collaboration around domains that can span multiple teams.

In the 1.5.0 release, we added support for subdomains. This will help teams to organize into multiple subdomains within each domain.

**RBAC for Domains:**

With the 1.5.0 release, we are adding more stricter controls around Domain. Now teams/data assets/glossaries and classification can have domain concepts and can get a policy such that only users within a domain can access the data within a domain. Domain owners can use data products as a way to publish data products and showcase publicly available data assets from a specific domain.

This will help large companies to use a single OpenMetadata platform to unify all of their data and teams but also provide more stringent controls to segment the data between domains.`,
      ['Improved Explore Page & Data Asset Widget']: `OpenMetadata, with its simple UI/UX and data collaboration features, is becoming more attractive to non-technical users as well. Data Governance teams are using OpenMetadata to add glossary terms and policies around metadata. Teams using Collate SaaS product are taking advantage of our Automations feature to gain productivity in their governance tasks.

Our new improved navigation on the Explore page will help users navigate hierarchically and find the data they are looking for. Users will see the data assets now grouped by service name -> database -> schema -> tables/stored procedures.

We are also making the discovery of data more accessible for users introducing a data asset widget, which will group the assets by platform type. This will help users find their data if they are working on a specific platform such as Looker or Snowflake they can easily click on that icon and get to the data.`,
      [`Pipeline Status Widget ${CollateIconWithLinkMD}`]: `We are also adding another widget you can use to customize the Landing Page of the User Personas in your organization.

With the Pipeline Status widget, Data Engineers can easily track the pipelines that are not behaving as expected. This widget, together with the obervability alerts that are already in place, will help your teams jump even faster to solving any issues in the platform.`,
      ['API as Data Asset']: `The Internet runs using APIs, both producing and consuming data. Organizations today run many microservices and REST APIs to capture data from their users and update a transaction database in the backend.

On top of the many supported connectors across Databases, Dashboards, ML Models, etc. We believe that providing support for API Services as data assets will help to get the full picture of how the data is coming through from various services and landing into databases, going to warehouses and BI tools.

In 1.5.0 we are introducing APIs as another first-class entity. Teams can now capture API requests and responses payloads and use our column level lineage to capture the relation between APIs and any other asset in the platform.`,
      ['Glossary Improvements']: `OpenMetadata supports multiple glossaries, an import/export and review process, and bulk asset tagging with glossary terms. Many teams are taking advantage of these features, and with an amazing open-source community, we are receiving great feedback on improving glossary functionality.

Here are some of the improvements coming in 1.5.0

1.  Glossary Reviewers can be teams

2.  Updating a glossary will enforce a re-review

3.  Renaming the Glossary Term while it's under review will keep the task associated with it open.`,
      [`Data Insights ${CollateIconWithLinkMD}`]: `The Data Insights application is meant to give you a quick glance of your data's state and allow you to take action based on the information you receive.

To continue pursuing this objective, the application was completely refactored to allow customizability. This is achieved by the possibility of now creating custom dashboards. On this release you can create charts based on your data assets metadata based on your needs.`,
      ['Ingestion Connectors']: `1.  **Apache Flink** as a Pipeline Connector

2.  **SAP ERP**, after a long and successful collaboration with our community and SAP experts

3.  **Teradata** as a community contribution from [gbpy](https://github.com/gpby) to broaden the integration capabilities for enterprise-scale analytics and data management.

4.  **GCS Storage Connector** as a community contribution from [Matt Chamberlin](https://github.com/MChamberlin)
5.  **Synapse Connector** ${CollateIconWithLinkMD}`,
    },
  },
  {
    id: 44,
    version: 'v1.5.2',
    description: `Released on 2nd September 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   [Fix]: Resolved issue with lineage lookup for long Fully Qualified Names (FQNs), ensuring accurate lineage tracking and display.
-   [Improve]: Fixed the 'Edit Reviewers' permission issue, allowing correct permission management for editing reviewers.
-   [Improve]: Addressed email update issues to ensure that email addresses are properly updated throughout the system.
-   [Improve]: Fixed the delete lineage functionality to handle cases where override lineage is enabled, preventing errors and ensuring consistency.
-   [Improve]: Added support for the 'Edit Assign' button in the Incident Manager, allowing for easier assignment changes.
-   [Improve]: Introduced a resizable layout for the glossary page, improving usability and adaptability to different screen sizes.
-   [Improve]: Enhanced the display of tier tags with improved styling for better visibility and distinction.
-   [Improve]: Pick email and name based on claim values at login. This update ensures that user details are automatically populated during the login process, streamlining user experience.
-   [Improve]: Added custom properties support in Data Product`,
    },
  },
  {
    id: 45,
    version: 'v1.5.3',
    description: `Released on 10th September 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   Added resizable columns for custom properties
-   Added support for automated ingestion of Tableau data source tags and description
-   Improved "follow data" landing page module performance
-   Improved search result suggestion by showing display name instead of FQN
-   Fixed Cost Analysis issue when service has no connection
-   Improved PII classification for JSON data types
-   Fixed issue with expand all operation on terms page
-   Fixed feed freezing when large images are part of the feed results
-   Fixed dbt run_results file name with dbt cloud connection
-   Cleaned Argo logs artifacts ${CollateIconWithLinkMD}
-   Shipped VertexAI Connector ${CollateIconWithLinkMD}
-   Fixed automator lineage propagation issues with possible None entities ${CollateIconWithLinkMD}`,
    },
  },
  {
    id: 46,
    version: 'v1.5.4',
    description: `Released on 12th September 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   Hotfix to the Term Aggregation size on Data Insights
-   ES pagination with error handling
-   Updated Domain in Docker Compose & Docs
-   Fix Classification API returns Table class for restore
-   Fix Redshift View Def regex_replace Error
-   Make ingestion pipeline APIs public
-   Fix token limitations using config ${CollateIconWithLinkMD}
-   Updating the domain PRINCIPAL DOMAIN
-   Fix Automator pagination ${CollateIconWithLinkMD}
-   Fix MetaPilot push for no constraint ${CollateIconWithLinkMD}
-   Glossary list selector for bulk import
-   Unable to access import glossary page`,
    },
  },
  {
    id: 47,
    version: 'v1.5.5',
    description: `Released on 23rd September 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   **Minor**: Made the type optional in ES Response.
-   **Feature**: Added support for refresh tokens with multiple tabs open.
-   **Fix**: Resolved issue of overriding user info after login.
-   **Minor**: Updated the custom property entities data model, along with the data product and database schema icons.
-   **Fix**: Ensured Teams and Owner fields are correctly passed in the policy API call.
-   **Improvement**: Enhanced PII logging information.
-   **Fix**: Addressed the paginate_es issue in OpenSearch.
-   **Feature**: Decrypted JWT internally for system health checks.
-   **Minor**: Implemented multithreading in View Lineage Processing.
-   **Improvement**: Improved search relevancy.
-   **Fix**: Resolved issue with owners patch.
-   **Fix (Data Quality)**: Fixed Snowflake data diff issue.
-   **Minor**: Updated Presidio Analyzer version and validated support for legal entities.
-   **Feature**: Added validations for Salesforce connection.
-   **Feature**: Allowed PII Processor to operate without storing sample data.
-   **Minor**: Added seconds to the human-readable format scale for test case graphs.
-   **Fix**: Added missing field in glossary term.
-   **Fix**: Excluded defaultPersona if not present in personas.
-   **Fix**: Resolved team export issue.
-   **Fix**: Updated Python lineage SDK to work with UUID and FQN models.
-   **Fix**: Fixed LDAP login issue.
-   **Fix**: Column sizing of data quality and pipeline widget ${CollateIconWithLinkMD}
-   **Fix**: Export with new line in description ${CollateIconWithLinkMD}
-   **Minor**: Fix Page entity publicationDate datatype ${CollateIconWithLinkMD}
`,
    },
  },
  {
    id: 48,
    version: 'v1.5.6',
    description: 'Released on 3rd October 2024.',
    features: [],
    changeLogs: {
      Improvements: `-   **Minor**: MSTR connector import fix.
-   **Minor**: Show displayName for database and databaseSchema in explore tree.
-   **Minor**: Allow PowerBI datamodel children in col.lineage.
-   **Fix**: Manifest is not parsed correctly on dbt versionless.
-   **Minor**: Fixed lineage & queries in dbt.
-   **Improvement**: Added DBT tests with versionless and fixed v7 parsing.
-   **Minor**: Reset displayName to avoid being persisted.
-   **Fix**: Fixed incorrect @Schema implementations in Swagger annotations.
-   **Fix**: Resolved type null exception on user feed.
-   **Fix**: Addressed missing cast to str.
-   **Minor**: DI Missing Dashboard Description Status.
-   **Fix**: SAML redirect leads to 404 page on UI.
-   **Minor**: Fixed General Profiler Bugs.
-   **Improvement**: Change time format for the created_at of the DBT cloud pipeline status.
-   **Minor**: Fixed role page size from 10 to 50.
-   **Fix**: Search Indexing Fixes.
-   **Improvement**: Collate API with Knowledge Center routes ${CollateIconWithLinkMD}.`,
    },
  },
  {
    id: 49,
    version: 'v1.5.7',
    description: 'Released on 17th October 2024.',
    features: [],
    changeLogs: {
      Improvements: `-   **Feature**: Add table-type custom property.
-   **Feature**: support Persian language option
-   **Feature**: Postgres stored procedures support.
-   **Feature**: Allow Custom Property Update in Glossary Bulk Import/export.
-   **Improvement**: Remove table details from table level Import/Export, allowing updates only for column details.
-   **MINOR**: looker exclude version.
-   **MINOR**: Add deleteEntityByFQNPrefix.
-   **MINOR**: Reduce lineage response size.
-   **MINOR**: Updated pyiceberg version to 0.5.1
-   **MINOR**: Fix dark border shown in navbar on UI.
-   **MINOR**: Add column case sensitivity parameter.
-   **MINOR**: Pagination with search on service page.
-   **MINOR**: Added loader in activity feed open and closed count.
-   **MINOR**: Superset get primitive datatype in case of array, struct.
-   **MINOR**: fix term references validation msg on glossary import.
-   **MINOR**: supported search filter and only all show in case of all node value selected.
-   **Fix**: Fix PinotDB Ingestion.
-   **Fix**: MSAL popup auth issue.
-   **Fix**: Fix Alerts for Test Suites.
-   **Fix**: Added Glue Pipeline Lineage.
-   **Fix**: ClassGraph performance issue.
-   **Fix**: Superset query for mysql con.
-   **Fix**: Empty Connection Overwrite Logic.
-   **Fix**: Couchbase columns not fetched fix.
-   **Fix**: Quicksight Ingestion Error handled.
-   **Fix**: DBT Manifest and Run results parsing.
-   **Fix**: Increase MAX_AGGREGATE_SIZE in search.
-   **Fix**: Add display name field in the advanced search filter.
-   **Fix**: On dashboard soft delete, chart should not be visible.
-   **Fix**: Fix the automator page breaking when no source is selected.
-   **Fix**: Salesforce table description from label if not through query.
-   **Fix**: Add Import/export support for table type custom property in glossary.
-   **Fix**: Fix exception in search due to exception in database.displayName and databaseSchema.aggregation.
-   **MINOR**: Knowledge Center publicationDate mismatch error ${CollateIconWithLinkMD}
-   **MINOR**: Add owner label for knowledge center right panel ${CollateIconWithLinkMD}
-   **Fix**: Automator pagination & improvments ${CollateIconWithLinkMD}
-   **Fix**: ArchiveLog to FALSE for test connection ${CollateIconWithLinkMD}
-   **Fix**: Knowledge Page deletion is not deleting from the search index ${CollateIconWithLinkMD}`,
    },
  },
  {
    id: 50,
    version: 'v1.5.8',
    description: 'Released on 24th October 2024.',
    features: [],
    changeLogs: {
      Improvements: `- **Fix**: Hive Meta store connection issue.
- **Fix**: Live index is on test suite creation.
- **Minor**: Supported total unique user count on the Team page.
- **Fix**: Issues in zh language search index mapping.
- **Minor**: Add location path to a table entity.
- **Fix**: LocationPath Index.
- **Fix**: Mode dashboard ingestion API call.
- **Fix**: Task deserialization in Airflow metadata ingestion.
- **Fix**: Mode test connection returns data in dict instead of JSON.
- **Minor**: Do not include soft deleted assets in the Data Insight.
- **Fix**: Web analytic activity being reset.
- **Fix**: Quicksight lineage source.
- **Fix**: Add Azure Token Base Authentication
`,
    },
  },
  {
    id: 51,
    version: 'v1.5.9',
    description: 'Released on 29th October 2024.',
    features: [],
    changeLogs: {
      Improvements: `- **Minor**: Prepare App Framework to handle application limits.
- **Minor**: Add Query Builder widget.
- **Fix**: Revamp MetaPilot as Collate AI and add limits ${CollateIconWithLinkMD}
- **Fix**: Implemented a fix on EntityLink for names with brackets.
`,
    },
  },
  {
    id: 52,
    version: 'v1.5.10',
    description: 'Released on 31st October 2024.',
    features: [],
    changeLogs: {
      Improvements: `- **Fix**: Encoding issue for teams search query.
- **Fix**: Disable empty rule for query builder widget.
- **Fix**: Unable to add more enum values for enum cp.
- **Fix**: Navigate to listing for deleting a service.
`,
    },
  },
  {
    id: 53,
    version: 'v1.5.11',
    description: 'Released on 15th November 2024.',
    features: [],
    changeLogs: {
      Improvements: `- **Improvement**: Parallelize the search indexing process.
- **Fix**: Return s3 endpoint as str() instead of Url.
- **Improvement**: Databricks query run optimisation.
- **Fix**: Make Export CSV Async API, websocket to push data back.
- **Improvement**: Add Column Value to be At Expected Location Test.
- **Fix**: User count doesn't update on adding to the team while using search.
- **Improvement**: Added support for lineage default depth settings.
- **Fix**: Materialised View Lineage.
- **Improvement**: Add PowerBI Report Server Connector ${CollateIconWithLinkMD}
- **Improvement**: Mask SQL Queries in Usage & Lineage Workflow.
- **Fix**: Sample data overlapping issue.
- **Fix**: Checkmark saves wrong custom property field
`,
    },
  },
  {
    id: 54,
    version: 'v1.5.12',
    description: 'Released on 25th November 2024.',
    features: [],
    changeLogs: {
      Improvements: `- **Improvement**: Added async apis for csv import.
- **Improvement**: Skip domain check for bots and admin
- **Improvement**: MYSQL lineage and usage.
- **Minor**: Added Lineage Field back to SearchLineage.
- **Fix**: Database is missing from the search dropdown
- **Fix**: Bad Representation of owners.
- **Fix**: The Daily Active Users Summary Card in Data Insights.
- **Fix**: The processing of URL Encoded Assets in Data Insights.
- **Fix**: Column Level Lineage export.
- **Fix**: Store procedure yielding by adding Try/Except.
- **Fix**: Lineage export when there is no column / pipeline edge.
`,
    },
  },
  {
    id: 55,
    version: 'v1.5.15',
    description: 'Released on 16th December 2024.',
    features: [],
    changeLogs: {
      Improvements: `
- **Minor**: Domain Policy Update to be non-system.
- **Fix**: Query builder state issue.
- **Fix**: Downloading of application logs.
- **Minor**: DBT v12 Model Changes.`,
    },
  },
  {
    id: 56,
    version: 'v1.6.0',
    description: 'Released on 10th December 2024.',
    features: [
      {
        title: `Visualizing Your Data Landscape with Entity Relationship (ER) Diagrams (Collate)`,
        description: `Understanding complex database schemas can be challenging without clear visualization. While OpenMetadata's best-in-class Lineage UI helps track data flow, there are better options for viewing structural relationships between tables. Collate 1.6 introduces ER diagrams as a new feature to let you:

1.  Visualize table connections through primary and foreign key constraints

2.  Navigate between data assets to discover relationships

3.  Modify connections using the built-in UI editor

ER diagrams help you better understand and manage your data architecture by showing how your database tables relate to each other.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/3m2xHpIsYuM',
      },
      {
        title:
          'Establishing Smooth Data Governance with Automated Glossary Approval Workflows (Collate)',
        description: `Organizations often struggle with data governance due to rigid, pre-defined manual workflows. OpenMetadata 1.6 introduces a new, automated data governance framework designed to be customized to each organization's needs.

In Collate 1.6, the Glossary Approval Workflow has been migrated to this new framework. Now, you can create custom approval processes with specific conditions and rules and easily visualize them through intuitive workflow diagrams. You can also create smart approval processes for glossary terms with real-time state changes and task creation to save time and streamline work. `,
        isImage: false,
        path: 'https://www.youtube.com/embed/yKJNWUb_ucA',
      },
      {
        title:
          'Data Certification Workflows for Automated Bronze, Silver, & Gold Data Standardization (Collate)',
        description: `Collate 1.6 also leverages the new data governance framework for a new Data Certification Workflow, allowing you to define your organization's rules to certify your data as Bronze, Silver, or Gold. Certified assets are a great way to help users discover the right data and inform them which data has been properly curated.

Our vision is to expand our governance framework to allow our users to create their own Custom Governance workflows. We want to enable data teams to implement and automate data governance processes that perfectly fit your organization, promoting data quality and compliance.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/hqxtn6uAvt4',
      },
      {
        title:
          'Maintaining a Healthy Data Platform with Observability Dashboards (Collate)',
        description: `Monitoring data quality and incident management across platforms can be challenging. OpenMetadata has been a pillar for data quality implementations, with its ability to create tests from the UI, native observability alerts, and Incident Manager. It offers data quality insights on a per-table level. .

In Collate 1.6, we’re introducing platform-wide observability dashboards that allow you to track overall data quality coverage trends and analyze incident response performance across your entire data estate. Quickly identify root causes through enhanced asset and lineage views and enable proactive data quality management across your entire data ecosystem.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/DQ-abGXOsHE',
      },
      {
        title: 'Elevating Metric Management with Dedicated Metric Entities',
        description: `Metrics are essential for data-driven organizations, but OpenMetadata previously lacked dedicated metric management, forcing users to use glossary terms as a workaround. The new "Metric" entity in OpenMetadata 1.6 provides a purpose-built solution to:.

1. Document detailed metric calculations and descriptions

2. Record calculation formulas and implementation code (Python, Java, SQL, LaTeX)

3. Visualize metric lineage from source data to insights

This new addition helps teams better manage, understand, and calculate their business KPIs, for improved data literacy and consistency across data teams. `,
        isImage: false,
        path: 'https://www.youtube.com/embed/Nf97_oWNAmM',
      },
      {
        title: 'Reinforcing Data Security with Search RBAC',
        description: `OpenMetadata's Roles and Policies enable granular permission control, ensuring appropriate access to metadata across different domains and teams. Some data teams may wish to enable data discovery to search for other tables while still enforcing controls with access requests. Other data teams in more restrictive environments may also wish to control the search experience.

OpenMetadata 1.6 extends Role-Based Access Control (RBAC) to search functionality, allowing administrators to tailor user search experience. This provides personalized search results, with users only seeing assets they have permission to access, as well as stronger data governance by ensuring users only interact with data within their defined roles and responsibilities.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/03ke9uv0PG0',
      },
      {
        title: 'Streamlining Data Management with Additional Enhancements',
        description: `Release 1.6 comes with several other notable improvements:

- **Asynchronous Export APIs** : Enjoy increased efficiency when exporting and importing large datasets with new asynchronous APIs.

- **Faster Search Re-indexing**:  Experience significantly improved performance in search re-indexing, making data discovery even smoother.

- **Improved Data Insights Custom Dashboards UI (Collate)**: To make it even easier to write your own insights dashboards in Collate.

- **Slack Integration (Collate)**: Collate is releasing a new Application that lets your users find and share assets directly within your Slack workspace!

- **Alert Debuggability**: Allowing users to test the destinations and see whenever the alert was triggered.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/7pUF9ZK2iK4',
      },
      {
        title: 'Expanded Connector Ecosystem and Diversity',
        description: `OpenMetadata’s ingestion framework contains 80+ native connectors. These connectors are the foundation of the platform and bring in all the metadata your team needs: technical metadata, lineage, usage, profiling, etc.

We bring new connectors in each release, continuously expanding our coverage. This time, release 1.6 comes with seven new connectors:

1. **OpenAPI**: Extract rich metadata from OpenAPI specifications, including endpoints and schemas.

2. **Sigma**: Bringing in your BI dashboard information.

3. **Exasol**: Gain insights into your Exasol database, now supported thanks to Nicola Coretti’s OSS contribution!

And in Collate, we are bringing four ETL, dashboarding and ML tools: **Matillion, Azure Data Factory, Stitch, PowerBI Server** and **Vertex AI!**`,
        isImage: false,
        path: '',
      },
    ],
    changeLogs: {
      ['Backward Incompatible Changes']: `

**Ingestion Workflow Status:**

We are updating how we compute the success percentage. Previously, we took into account for partial success the results of the Source (e.g., the tables we were able to properly retrieve from Snowflake, Redshift, etc.). This means that we had an error threshold in there were if up to 90% of the tables were successfully ingested, we would still consider the workflow as successful. However, any errors when sending the information to OpenMetadata would be considered as a failure.
Now, we're changing this behavior to consider the success rate of all the steps involved in the workflow. The UI will then show more Partial Success statuses rather than Failed, properly reflecting the real state of the workflow.

**Profiler & Auto Classification Workflow:**

We are creating a new Auto Classification workflow that will take care of managing the sample data and PII classification, which was previously done by the Profiler workflow. This change will allow us to have a more modular and scalable system.
The Profiler workflow will now only focus on the profiling part of the data, while the Auto Classification will take care of the rest.

This means that we are removing these properties from the DatabaseServiceProfilerPipeline schema:

-   generateSampleData
-   processPiiSensitive
-   confidence which will be moved to the new
-   Adding Glossary Term view is improved. Now we show glossary terms hierarchically enabling a better understanding of how the terms are setup while adding it to a table or dashboard.
-   DatabaseServiceAutoClassificationPipeline schema.

What you will need to do:

-   If you are using the EXTERNAL ingestion for the profiler (YAML configuration), you will need to update your configuration, removing these properties as well.
-   If you still want to use the Auto PII Classification and sampling features, you can create the new workflow from the UI.
`,

      ['RBAC Policy Updates for EditTags']: `We have given more granularity to the EditTags policy. Previously, it was a single policy that allowed the user to manage any kind of tagging to the assets, including adding tags, glossary terms, and Tiers.

Now, we have split this policy to give further control on which kind of tagging the user can manage. The EditTags policy has been
split into:

-   **EditTags**: to add tags.
-   **EditGlossaryTerms**: to add Glossary Terms.
-   **EditTier**: to add Tier tags.`,

      [`Metadata Actions for ML Tagging - Deprecation Notice ${CollateIconWithLinkMD}`]: `
Since we are introducing the Auto Classification workflow, we are going to remove in 1.7 the ML Tagging action from the Metadata Actions. That feature will be covered already by the Auto Classification workflow, which even brings more flexibility allow the on-the-fly usage of the sample data for classification purposes without having to store it in the database.`,

      [`Service Spec for the Ingestion Framework`]: `This impacts users who maintain their own connectors for the ingestion framework that are NOT part of the OpenMetadata python library (openmetadata-ingestion). Introducing the "connector specifcication class (ServiceSpec)". The ServiceSpec class serves as the entrypoint for the connector and holds the references for the classes that will be used to ingest and process the metadata from the source. You can see postgres for an implementation example.`,
    },
  },
  {
    id: 57,
    version: 'v1.6.1',
    description: 'Released on 10th December 2024.',
    note: "In 1.6.1, Fixes tags listing for explore page on top of 1.6.0 release. Don't miss out the release highlights!",
    features: [
      {
        title: `Visualizing Your Data Landscape with Entity Relationship (ER) Diagrams (Collate)`,
        description: `Understanding complex database schemas can be challenging without clear visualization. While OpenMetadata's best-in-class Lineage UI helps track data flow, there are better options for viewing structural relationships between tables. Collate 1.6 introduces ER diagrams as a new feature to let you:

1.  Visualize table connections through primary and foreign key constraints

2.  Navigate between data assets to discover relationships

3.  Modify connections using the built-in UI editor

ER diagrams help you better understand and manage your data architecture by showing how your database tables relate to each other.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/3m2xHpIsYuM',
      },
      {
        title:
          'Establishing Smooth Data Governance with Automated Glossary Approval Workflows (Collate)',
        description: `Organizations often struggle with data governance due to rigid, pre-defined manual workflows. OpenMetadata 1.6 introduces a new, automated data governance framework designed to be customized to each organization's needs.

In Collate 1.6, the Glossary Approval Workflow has been migrated to this new framework. Now, you can create custom approval processes with specific conditions and rules and easily visualize them through intuitive workflow diagrams. You can also create smart approval processes for glossary terms with real-time state changes and task creation to save time and streamline work. `,
        isImage: false,
        path: 'https://www.youtube.com/embed/yKJNWUb_ucA',
      },
      {
        title:
          'Data Certification Workflows for Automated Bronze, Silver, & Gold Data Standardization (Collate)',
        description: `Collate 1.6 also leverages the new data governance framework for a new Data Certification Workflow, allowing you to define your organization's rules to certify your data as Bronze, Silver, or Gold. Certified assets are a great way to help users discover the right data and inform them which data has been properly curated.

Our vision is to expand our governance framework to allow our users to create their own Custom Governance workflows. We want to enable data teams to implement and automate data governance processes that perfectly fit your organization, promoting data quality and compliance.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/hqxtn6uAvt4',
      },
      {
        title:
          'Maintaining a Healthy Data Platform with Observability Dashboards (Collate)',
        description: `Monitoring data quality and incident management across platforms can be challenging. OpenMetadata has been a pillar for data quality implementations, with its ability to create tests from the UI, native observability alerts, and Incident Manager. It offers data quality insights on a per-table level. .

In Collate 1.6, we’re introducing platform-wide observability dashboards that allow you to track overall data quality coverage trends and analyze incident response performance across your entire data estate. Quickly identify root causes through enhanced asset and lineage views and enable proactive data quality management across your entire data ecosystem.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/DQ-abGXOsHE',
      },
      {
        title: 'Elevating Metric Management with Dedicated Metric Entities',
        description: `Metrics are essential for data-driven organizations, but OpenMetadata previously lacked dedicated metric management, forcing users to use glossary terms as a workaround. The new "Metric" entity in OpenMetadata 1.6 provides a purpose-built solution to:.

1. Document detailed metric calculations and descriptions

2. Record calculation formulas and implementation code (Python, Java, SQL, LaTeX)

3. Visualize metric lineage from source data to insights

This new addition helps teams better manage, understand, and calculate their business KPIs, for improved data literacy and consistency across data teams. `,
        isImage: false,
        path: 'https://www.youtube.com/embed/Nf97_oWNAmM',
      },
      {
        title: 'Reinforcing Data Security with Search RBAC',
        description: `OpenMetadata's Roles and Policies enable granular permission control, ensuring appropriate access to metadata across different domains and teams. Some data teams may wish to enable data discovery to search for other tables while still enforcing controls with access requests. Other data teams in more restrictive environments may also wish to control the search experience.

OpenMetadata 1.6 extends Role-Based Access Control (RBAC) to search functionality, allowing administrators to tailor user search experience. This provides personalized search results, with users only seeing assets they have permission to access, as well as stronger data governance by ensuring users only interact with data within their defined roles and responsibilities.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/03ke9uv0PG0',
      },
      {
        title: 'Streamlining Data Management with Additional Enhancements',
        description: `Release 1.6 comes with several other notable improvements:

- **Asynchronous Export APIs** : Enjoy increased efficiency when exporting and importing large datasets with new asynchronous APIs.

- **Faster Search Re-indexing**:  Experience significantly improved performance in search re-indexing, making data discovery even smoother.

- **Improved Data Insights Custom Dashboards UI (Collate)**: To make it even easier to write your own insights dashboards in Collate.

- **Slack Integration (Collate)**: Collate is releasing a new Application that lets your users find and share assets directly within your Slack workspace!

- **Alert Debuggability**: Allowing users to test the destinations and see whenever the alert was triggered.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/7pUF9ZK2iK4',
      },
      {
        title: 'Expanded Connector Ecosystem and Diversity',
        description: `OpenMetadata’s ingestion framework contains 80+ native connectors. These connectors are the foundation of the platform and bring in all the metadata your team needs: technical metadata, lineage, usage, profiling, etc.

We bring new connectors in each release, continuously expanding our coverage. This time, release 1.6 comes with seven new connectors:

1. **OpenAPI**: Extract rich metadata from OpenAPI specifications, including endpoints and schemas.

2. **Sigma**: Bringing in your BI dashboard information.

3. **Exasol**: Gain insights into your Exasol database, now supported thanks to Nicola Coretti’s OSS contribution!

And in Collate, we are bringing four ETL, dashboarding and ML tools: **Matillion, Azure Data Factory, Stitch, PowerBI Server** and **Vertex AI!**`,
        isImage: false,
        path: '',
      },
    ],
    changeLogs: {
      ['Backward Incompatible Changes']: `

**Ingestion Workflow Status:**

We are updating how we compute the success percentage. Previously, we took into account for partial success the results of the Source (e.g., the tables we were able to properly retrieve from Snowflake, Redshift, etc.). This means that we had an error threshold in there were if up to 90% of the tables were successfully ingested, we would still consider the workflow as successful. However, any errors when sending the information to OpenMetadata would be considered as a failure.
Now, we're changing this behavior to consider the success rate of all the steps involved in the workflow. The UI will then show more Partial Success statuses rather than Failed, properly reflecting the real state of the workflow.

**Profiler & Auto Classification Workflow:**

We are creating a new Auto Classification workflow that will take care of managing the sample data and PII classification, which was previously done by the Profiler workflow. This change will allow us to have a more modular and scalable system.
The Profiler workflow will now only focus on the profiling part of the data, while the Auto Classification will take care of the rest.

This means that we are removing these properties from the DatabaseServiceProfilerPipeline schema:

-   generateSampleData
-   processPiiSensitive
-   confidence which will be moved to the new
-   Adding Glossary Term view is improved. Now we show glossary terms hierarchically enabling a better understanding of how the terms are setup while adding it to a table or dashboard.
-   DatabaseServiceAutoClassificationPipeline schema.

What you will need to do:

-   If you are using the EXTERNAL ingestion for the profiler (YAML configuration), you will need to update your configuration, removing these properties as well.
-   If you still want to use the Auto PII Classification and sampling features, you can create the new workflow from the UI.
`,

      ['RBAC Policy Updates for EditTags']: `We have given more granularity to the EditTags policy. Previously, it was a single policy that allowed the user to manage any kind of tagging to the assets, including adding tags, glossary terms, and Tiers.

Now, we have split this policy to give further control on which kind of tagging the user can manage. The EditTags policy has been
split into:

-   **EditTags**: to add tags.
-   **EditGlossaryTerms**: to add Glossary Terms.
-   **EditTier**: to add Tier tags.`,

      [`Metadata Actions for ML Tagging - Deprecation Notice ${CollateIconWithLinkMD}`]: `
Since we are introducing the Auto Classification workflow, we are going to remove in 1.7 the ML Tagging action from the Metadata Actions. That feature will be covered already by the Auto Classification workflow, which even brings more flexibility allow the on-the-fly usage of the sample data for classification purposes without having to store it in the database.`,

      [`Service Spec for the Ingestion Framework`]: `This impacts users who maintain their own connectors for the ingestion framework that are NOT part of the OpenMetadata python library (openmetadata-ingestion). Introducing the "connector specifcication class (ServiceSpec)". The ServiceSpec class serves as the entrypoint for the connector and holds the references for the classes that will be used to ingest and process the metadata from the source. You can see postgres for an implementation example.`,
    },
  },
  {
    id: 58,
    version: 'v1.6.2',
    description: 'Released on 10th January 2025.',
    features: [],
    changeLogs: {
      Improvements: `- **Fix**: Test case getting removed from logical test suite after editing the test case.
- **Fix**: Edit Lineage Operation not working with isOwner() condition
- **Fix**: EditLineage permission not allowing users to edit the lineage.
- **Fix**: ViewAll permission not working with matchAnyTag() and isOwner() conditions
- **Fix**: Vulnerability security on 1.5.6 version package com.google.protobuf_protobuf-java.
- **Fix**: DBT Data ingestion not working.
- **Fix**: Table owners not shown properly after a dbt ingestion and re-indexing.
- **Fix**: Glossary Listing Limits to 50 without scrolling to next page.
- **Fix**: Mask encrypted password for email.
- **Fix**: Profiler failing on ingesting data type for postgres.
- **Fix**: Column lineage ingestion failed to parse column due to subquery raw_name AttributeError.
- **Fix**: Data Insight Tier Filter does not work.
- **Fix**: Add depth support for storage connector.
- **Fix**: Replace the description editor with a new block editor.
- **Fix**: Redshift Metadata ingestion failing for Stored Procedure.
- **Fix**: Lineage view not showing all the nodes in case of circular lineage.
- **Fix**: Deleting Data Product should delete the data asset relationships.
- **Fix**: styling (color, icon) is lost if a glossaryTerm is updated via the bulk upload.
- **Fix**: Unable to see complete column type info for long column type.
- **Fix**: ApiEndpoint reindexing failure.
- **Fix**: Auto Classification Ingestion - AttributeError: 'DataType' object has no attribute 'dialect_impl'.
- **Fix**: Adding the profiler for doris failing to execute.
- **Fix**: Unable to remove existing values from custom property (enum data type).
- **Improvement**: Ability to sort the DI charts based on date or term.
- **Improvement**: Support test connection api cancellation on click of cancel.
- **Improvement**: Highlight the search term for schema table on table details page.
- **Improvement**: Add Algorithm option for authentication token validation in yaml.
- **Improvement**: Make all Test Suites executable.
- **Improvement**: Activity feed pagination.
- **Fix**: Custom DI description getting added with HTML p tag. ${CollateIconWithLinkMD}
- **Fix**: Knowledge Page hierarchy state doesn't persist on refresh. ${CollateIconWithLinkMD}
- **Fix**: Reindex Page Entitiy is Missing on Collate. ${CollateIconWithLinkMD}
- **Fix**: Avoid pluralizing for custom charts. ${CollateIconWithLinkMD}
- **Improvement**: Add the missing filters for different assets in the Automator(Ex. Database filter for Database Schema asset). ${CollateIconWithLinkMD}
- **Improvement**: Add Glossary Term and Metric as assets for Automation. ${CollateIconWithLinkMD}
`,
    },
  },
  {
    id: 59,
    version: 'v1.6.3',
    description: 'Released on 29th January 2025.',
    features: [],
    changeLogs: {
      Improvements: `- **Fix**: Adds percona server for postgresql support.
- **Fix**: Inherited Ownership for Data Products.
- **Fix**: Favicon not being updated in the browser tab.
- **Fix**: Fix Search Index for ER Model.
- **Fix**: dbt ingestion picks up wrong service to patch metadata.
- **Fix**: Wrong team count displayed on team tab.
- **Fix**: Tracing highlighter in lineage after edge clicked.
- **Fix**: Api should not called after time out in Test connection.
- **Fix**: Get only non-deleted entities in export.
- **Fix**: The permissions call made for search service.
- **Fix**: Kafkaconnect validation errors.
- **Fix**: DI Filter not getting applied.
- **Fix**: Redash Get Dashboards flow.
- **Fix**: Description not rendered in Glossary Modal while edit.
- **Fix**: The persona JSON schema is named Team.
- **Fix**: Redirection issue on IDP initiated calls.
- **Fix**: Async export csv not happening in lineage.
- **Fix**: Description renderer having tags in glossary,team and user import.
- **Fix**: RichTextEditor output in case on no data save.
- **Fix**: s3 storage parquet structureFormat ingestion.
- **Fix**: Data Insights index mapping.
- **Fix**: Edit description permission for domain owner.
- **Fix**: Model dump dict key names.
- **Fix**: Broken looker lineage.
- **Fix**: Refresh call concurrency for multiple browser tabs.
- **Fix**: Infinite loading for refresh attempted on app visit.
- **Fix**: Duplicate table constraints.
- **Fix**: Updated MSSQL queries causing arithmetic overflow error.
- **Fix**: PowerBI tables, datamodel metadata missing.
- **Fix**: Wrong dataset and project id in filter of system metric query.
- **Fix**: Data Insight fix custom property filter.
- **Fix**: Entity Hierarchy Schema.
- **Fix**: Salesforce column description with toggle api.
- **Fix**: Update glossary term table upon new term added.
- **Fix**: Remove unwanted spacing around the list in block editor.
- **Fix**: Postgres parse json schema.
- **Fix**: Optimize multithreading for lineage.
- **Fix**: Fetch Stored Procedures from account usage .
- **Fix**: Add MaterializedView & DynamicTable for lineage computation.
- **Fix**: MariaDB Lineage Dialect Issue.
- **Fix**: DQ Dashboard: update order of the pie chart. ${CollateIconWithLinkMD}
- **Fix**: Lineage Propagation when Entity doesn't have a given field. ${CollateIconWithLinkMD}
- **Minor**: Optimize Snowflake SP Query.
- **Minor**: Hide description tooltip for tag edit mode.
- **Minor**: BigQuery Improvement, Hive Partitioned Tables, Nonetype issue resolved
- **Minor**: Typo for datetime attribute.
- **Minor**: Get missing dataProducts and pipeline properties in /customProperties api.
- **Minor**: Improve cron expression validations.
- **Minor**: Change log localization improvement.
- **Minor**: Async test case result deletion.
- **Minor**: Retention period 'Cancel' international display issue.
- **Minor**: Added limits configuration in telemetry payload. ${CollateIconWithLinkMD}
- **Improvement**: Logout user on unsuccessful refresh attempt.
- **Improvement**: Support for Domain hierarchy listing.
- **Improvement**: Avoid usage of CONCAT in WHERE clause.
- **Improvement**: Glossary column width sizes for the resizable columns.
- **Improvement**: Move Recreate Out of executors.
- **Improvement**: Supported the task filter on landing page feed widget.
- **Improvement**: Implement Data Quality Dashboards (Incident Manager + Data Quality).
- **Improvement**: Added loading state, and manage error notification in TestSuite.
- **Improvement**: Enhance Kafka SSL configuration support with consumerConfigSSL.
- **Improvement**: Add prometheus counter for search and database.
- **Improvement**: Retention Application : Delete change_events, activity threads, versions based on admin retention policies.
- **Improvement**: Show displayName for custom dashboards. ${CollateIconWithLinkMD}
- **Improvement**: Support rename for custom dashboard and charts. ${CollateIconWithLinkMD}
- **Improvement**: Improve Onboarding Application. ${CollateIconWithLinkMD}
`,
    },
  },
  {
    id: 60,
    version: 'v1.6.4',
    description: 'Released on 19th February 2025.',
    features: [],
    changeLogs: {
      Improvements: `-   **Improvement**: Trino Add missing import.
-   **Improvement**: Optimise Pipeline Lineage Extraction.
-   **Improvement**: Powerbi fetch workspaces failure handle.
-   **Fix**: Powerbi test connection sucess with bad credentials.
-   **Fix**: Remove description check for columnDescriptionStatus.
-   **Fix**: Markdown editor fix.
-   **Fix**: Postgres usage not terminating with bad connection.
-   **Fix**: Fix followers for Data Insights index.
-   **Fix**: Add support for temp table lineage.
-   **Fix**: Exclude deleted Stored Procedure Snowflake.
-   **Fix**: Fix databricks schema not found.
-   **Fix**: API service schema fields of object type not listed.
-   **Fix**: Multiple Tier selection not resulting correct DQ dashboard view.
-   **Fix**: Not able to edit sql query from test case details page.
-   **Fix**: Implement the right SQA Sampler for UnityCatalog.
-   **Fix**: Fix dbt Test case Timestamp issue.
-   **Fix**: Delete pipelines from logical suites at deletion.
-   **Fix**: Table Update Sys Metric shows wrong value.
-   **Fix**: Fix unity catalog lineage - handle errors.
-   **Improvement**: Validate basic suites do have basicEntityRef.
-   **Improvement**: Add support for cluster key information - bigquery.
-   **Improvement**: Automator - Remove tags by label type.
-   **Improvement**: Show sub domain assets to top level.
-   **Improvement**: Sort Enum type Custom Property Values.
-   **Improvement**: Modify the appeariance of self connecting edge lineage.
-   **Improvement**: Global search should persist quick filter in explore.
-   **Improvement**: Show sourceUrl if present.
-   **Improvement**: Modify the lineage alignment algorithm to tree view.


`,
    },
  },
  {
    id: 61,
    version: 'v1.6.5',
    description: 'Released on 27th February 2025.',
    features: [],
    changeLogs: {
      Improvements: `-   Fix hyperlink encoding for alerts and notifications
-   Fix failed tests sample data exception management
-   Fix MySQL and MariaDB window function computation when no database is added in the connection
-   Add support for tags and glossary terms in Domains and Data Products
-   Fix consolidation issues on incremental changes
-   Fix snowflake lineage Key Error
-   Fix iframe SSO setup
-   Support pagination for container children`,
    },
  },
  {
    id: 62,
    version: 'v1.6.6',
    description: 'Released on 14th March 2025.',
    features: [],
    changeLogs: {
      Improvements: `-   Added loggedInAPI to show more specific error messages instead of generic ones
-   Added support for \`/logout\` path to perform logout from API redirect
-   Added displayName field in the \`createCustomProperty\` schema
-   Improved search relevancy for plural/singular words and partial matches
-   Introduced "clear sample" option in entity config to support explicit null
-   Made domain a required field for Data Product creation
-   Enabled showdown rendering options`,

      Fixes: `-   Fixed Snowflake ARRAY column ingestion issues
-   Fixed Sigma workbook ingestion
-   Fixed tomcat-jdbc dependency
-   Fixed schema URL construction
-   Fixed Redshift view logging for no schema binding
-   Fixed OpenMetadata Operations
-   Added support for datatype=array without type consistency
-   Added result_maker check for query share URL in Looker
-   Supported request schema field for OpenAPI lineage when response field is absent
-   Fixed tour page clicking issues
-   Fixed duplicate activity feed providers
-   Fixed search query for non-admin pages
-   Fixed other columns visibility when testSuite name is large
-   Fixed task description viewer for diff creation
-   Fixed inherited owner not updating in Data Product list
-   Fixed user update roles
-   Fixed table constraint error
-   Fixed manual constraints deletion
-   Fixed deletion of entities
-   Fixed entity relation live indexing
-   Fixed service creation error display
-   Improved memory handling in temp table lineage
-   Enhanced Column Name Scanner
-   Improved pipeline service client exception handling
-   Updated Tableau documentation in Connectors
-   Optimized pipeline service client initialization
-   Implemented Incremental Lineage Processing
-   Don't overwrite query to execute
-   Fixed external app logs
-   Fixed incremental lineage processing when processedLineage is null`,
    },
  },
  {
    id: 63,
    version: 'v1.6.7',
    description: 'Released on 28th March 2025.',
    features: [],
    changeLogs: {
      Improvements: `-   Lineage Improvements
-   Added Tableau Custom SQL lineage support
-   Added column count validation when creating table-type custom property
-   Transformed Reserved keywords like quotes to OM compatible
-   Added missing timestamp indexes for time series tables
-   Enhancing FQN Handling: Support for Quoted Identifiers`,

      Fixes: `-   Fixed potential Okta login issues by clearing state to avoid login errors
-   Fixed MariaDB profiling with Time datatype
-   Fixed handling of Sample Data with non-utf8 characters
-   Fixed test connection showing timeout after successful connection
-   Fixed DBT logs and improved error handling
-   Fixed Test Suite 'NoneType' object has no attribute 'id' handling
-   Fixed delete entity relation live indexing
-   Fixed Data Insights Data Stream deletion on OpenSearch
-   Fixed soft delete and restore functionality
-   Corrected childrenCount for Organizations in Teams
-   Fixed custom dashboard issue with term type of data
-   Lower training window for Collate Anomaly detection model ${CollateIconWithLinkMD}`,
    },
  },
  {
    id: 64,
    version: 'v1.6.8',
    description: 'Released on 8th April 2025.',
    features: [],
    changeLogs: {
      Improvements: `-  Added support for Wherescape connector.${CollateIconWithLinkMD}
      -  PowerBI owners ingestion for assets, improved filter query performance.
      -  REST connector enhancements.
      -  Implement column validation in lineage patch api.
      `,
      Fixes: `-  Fixed tableau ingestion for null upstream table queries.
      -  Fixed public schema lieage for postgres.
      -  Fixed PowerBI filter query.
      -  Fixed IncidentManager date filtering and update table column title.
      -  Fixed dbt cloud latest run execution.
      -  Fixed Unpinned google-cloud-secret-manager version in ingestion dependencies.
      -  Fixed update query to fix domain asset update.
      -  Fixed DQ for local webserver.${CollateIconWithLinkMD}
      -  Fixed placeholder issue for empty metrics.${CollateIconWithLinkMD}
      `,
    },
  },
  {
    id: 65,
    version: 'v1.6.9',
    description: 'Released on 17th April 2025.',
    features: [],
    changeLogs: {
      Fixes: `-  Made Fields immutable for Applications.
      `,
    },
  },
  {
    id: 66,
    version: 'v1.6.10',
    description: 'Released on 23rd April 2025.',
    features: [],
    changeLogs: {
      Fixes: `-  Use Subset of Permissions for add delete Users in teams.
      `,
    },
  },
  {
    id: 67,
    version: 'v1.6.11',
    description: 'Released on 28th April 2025.',
    features: [],
    changeLogs: {
      Fixes: `-  Fixed isOwner permission issue for domains and dataProducts.
      `,
    },
  },
  {
    id: 68,
    version: 'v1.7.0',
    description: 'Released on 15th April 2025.',
    features: [
      {
        title: `Automate Metadata Onboarding Instantly with OpenMetadata AutoPilot`,
        description: `Data teams often face manual, repetitive tasks onboarding new services—configuring workflows individually for schemas, lineage, usage, and profiling. This slows down onboarding and can cause inconsistent metadata coverage.

OpenMetadata’s AutoPilot makes onboarding effortless:

•	**Automated Workflows:** Automatically triggers metadata extraction for schemas, lineage, usage, and profiling whenever a new service is added. No manual setup required.
•	**Optimized Filtering:** Includes default filters for relevant metadata, with the flexibility to add custom filters, ensuring consistency and efficiency.
•	**Immediate Insights:** Provides real-time KPIs on asset distribution, metadata coverage (descriptions, ownership), tiering, and PII tagging to proactively improve data governance.
	`,
        isImage: false,
        path: 'https://www.youtube.com/embed/lo4SrBAmTZM',
      },
      {
        title: `Automate Documentation, Classification, and Data Quality with Collate AI Agents`,
        isCollate: true,
        description: `Collate is enhancing AutoPilot by integrating powerful AI Agents that automate critical metadata tasks—saving your team time and increasing metadata coverage instantly.

• Automated Tiering: The Tier Agent analyzes usage patterns and lineage to automatically identify the business-critical data assets within your organization.
• Intelligent Documentation: The Documentation Agent automatically generates accurate descriptions of your data assets and powers a seamless Text2SQL chat experience.
• Data Quality Automation: The Data Quality Agent intelligently creates Data Quality tests based on data constraints and learns from existing tests across similar datasets.

With Collate AI Agents in AutoPilot, it’s like adding expert team members who streamline metadata management—accelerating onboarding, improving governance, and freeing your team to focus on higher-value tasks.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/mn4edHpHZWo',
      },
      {
        title:
          'Customize Your Data Discovery with Enhanced Search Relevancy Settings',
        description: `As your data platform expands, quickly finding the most relevant data assets becomes essential. OpenMetadata already boosts search results based on business-criticality (Tiers) and usage patterns—but your organization’s preferences might vary.

With the new Search Relevancy Settings, OpenMetadata gives you complete control to tailor your discovery experience by:
• Fine-tuning searchable fields such as asset names, descriptions, or column details.
• Adjusting result boosting based on default properties like Tiers and usage, or adding custom tags to further enhance relevancy.
• Applying customized ranking across all data assets or specific asset types like Tables, Dashboards, or Topics.

Ensure users always discover the right data, quickly and intuitively, by customizing your search experience with OpenMetadata’s enhanced relevancy settings.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/9Uy95t11hs0',
      },
      {
        title: `Navigate Your Data Ecosystem with Hierarchical Lineage`,
        description: `OpenMetadata’s enhanced Lineage UI in Release 1.7 introduces Hierarchical Lineage Layers,

enabling teams to intuitively explore data lineage from a high-level overview down to granular details:
•	Service Layer provides visibility into data flows between different platforms or services.
•	Domain Layer clearly illustrates how data traverses across Data Mesh domains.
•	Data Product Layer shows lineage across specific data products, aligning closely with business definitions.

Alongside these layers, column-level lineage remains easily accessible, helping teams precisely understand data transformations and impacts, simplifying root-cause analysis and governance decisions.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/5iiN2gtJzwo',
      },
      {
        title: 'Simplify the User Experience with Persona-Based Customizations',
        description: `OpenMetadata provides detailed information on your data assets—covering schema, lineage, data quality, and observability. But different user personas have different needs and workflows, and one size doesn’t fit all.

With Release 1.7, you can now fully personalize OpenMetadata’s user experience based on defined User Personas, making the platform simpler and more intuitive:
•	Navigation Panel Customization: Tailor the navigation panel by adding, removing, or sorting elements to match the workflow of each persona.
•	Data Assets & Governance Entities: Reorganize, add, or remove tabs and customize widget layouts—highlighting relevant custom properties, descriptions, or key insights specific to each persona.

Persona-based customization ensures each user sees only what’s relevant and important to their role, streamlining workflows, improving usability, and enhancing adoption across your organization.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/Cf-dSJLRQcc',
      },
      {
        title: 'Discover the Right Data Even Faster with an Enhanced UX',
        description: `OpenMetadata is already known for its intuitive UI and simplified user experience. In Release 1.7, we’ve elevated the UX further, making it even easier for diverse user personas to quickly find and act on the data they need.

Key UX improvements include:
•	Streamlined Navigation: Simplified navigation panels to quickly guide users through key actions.
•	Clearer Asset Information: Improved placement and labeling of critical information on data asset pages, ensuring immediate understanding.
•	Enhanced User Profiles: Restructured user pages for better visibility into profile details and more intuitive management of open tasks.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/r5CMDA4Fcsw',
      },
      {
        title:
          'Automatically Propagate Collate Metadata into Your Data Platforms',
        isCollate: true,
        description: `Collate already simplifies capturing and managing metadata—tags, descriptions, and ownership—across your entire data ecosystem. But making sure this enriched metadata reaches back into your source systems is equally crucial.

With the new Reverse Metadata feature, you can automatically push centralized metadata from Collate directly back into your databases (MySQL, Postgres), warehouses (Snowflake, BigQuery), and dashboards (e.g., Power BI). Simply select which assets should synchronize, and your source systems will instantly receive metadata updates in real time.

This seamless, two-way metadata synchronization enables powerful governance use-cases—such as automating data masking policies in Snowflake based on centrally managed tags—and turns Collate into a single source of truth at the heart of your end-to-end automated governance strategy.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/3RVTwfbgvLQ',
      },
    ],
    changeLogs: {
      ['Breaking changes']: `### Removing Support for Python 3.8

Python 3.8 was [officially EOL on 2024-10-07](https://devguide.python.org/versions/). Some of our dependencies have already started removing support for higher versions, and we are following suit to ensure we are using the latest and most stable versions of our dependencies.

This means that for Release 1.7, the supported Python versions for the Ingestion Framework are 3.9, 3.10, and 3.11.\
We were already shipping our Docker images with Python 3.10, so this change should not affect you if you are using our Docker images. However, if you installed the openmetadata-ingestion package directly, please make sure to update your Python version to 3.9 or higher.`,
      ['Expanded Connector Ecosystem and Diversity']: `OpenMetadata's ingestion framework contains 90+ native connectors. These connectors are the foundation of the platform and bring in all the metadata your team needs: technical metadata, lineage, usage, profiling, etc.

We bring new connectors in each release, continuously expanding our coverage. This time, Release 1.7 comes with four new connectors:
• **Opensearch**: Bringing your index metadata into OpenMetadata.
• **Cassandra**: Ingesting from the NoSQL Distributed Database.
• **Cockroach DB**: The cloud native distributed SQL Database.

And in Collate, we are bringing a new Pipeline connector: **Wherescape**.`,
    },
  },
  {
    id: 69,
    version: 'v1.7.1',
    description: 'Released on 22nd May 2025.',
    features: [],
    changeLogs: {
      Improvements: `- Login page UI.
- DQ failure lineage tracing.
- Add Domain selection while creating tags.
- Add support for Korean language.
- Support edit display name for dashboard Data model.
- Configurable account usage for incremental metadata extraction.
- Add athena schema comment support.
- Support dynamic height for detail page widgets.
- Add support for following databases, schemas and services.
- Allow editing of sql function in column level lineage.
- Support chart export in cost analysis.
- Add domain-level permissions while creating/updating dataProduct.
- Add support to add and edit Data Product from entity page.
- Add bulk edit action for glossary listing page.
- PDF export quality.${CollateIconWithLinkMD}
- Support un-nesting to parent level knowledge article.${CollateIconWithLinkMD}
- Support brush for zoom support within charts.${CollateIconWithLinkMD}
      `,
      Fixes: `- Severity on incident POST creation.
- Service insights PDF export.
- Can't run table diffs on snowflake when using private key authentication.
- Self signup login error not showing.
- Service connection config not getting updated with multiple project ids after ingestion .
- Data assets order in explore left panel.
- Added display name and description in Testcase Alert emails.
- PostgreSQL schemas getting filtered out.
- Make prompt=login as optional.
- Apps allowing submission of negative numbers for some config fields.
- Error Connecting S3 container to pipeline or tables in lineage edit mode.
- Mentions on task should trigger @mention alert.
- Postgres Duplicate table constraint error when re-ingesting.
- Unsupported Pipeline entity for lineage error.
- Issue with refresh for loggedInUser return 401.
- Render settings menu based on permissions.
- Data products not visible when redirecting from assets listing to entity page.
- Make certification always visible.
- Dots are misaligned / unclear in multi-metric view of Test Case Metrics.
- Snowflake Tags Not Reattached or Re-ingested After Initial Ingestion.
- Remove data products associated with the old domain when an entity's domain is updated.
- Multiple image insertion issue and ensure proper inline error messaging for Rich Text Editor.
- Handle udf definition fetch exceptions.
- parquet endpoint null case error.
- Deleted user page shows a spinner instead of "User not found".
- Enum cleanup not triggering when all enum keys are removed in custom property.
- Inconsistent behavior when reassigning asset to a different domain via bulkAsset API.
- Airbyte pipeline lineage extraction.
- Add include field for list incident API.
- Metadata ingestion errors from Azure Data Lake.
- Support Ingesting Multiple Owners for dbt Models from manifest.json.
- Error ingesting using Datalake adls connector.
- PostgreSQL Sample Data Err- FATAL: too many connections for role "role_name".
- Testcase "Column values to be uniqu- oracledb error (ORA-00937).
- Alert Triggering on Both Failure and Success of the Test Case even if configured for failure only.
- PBI lineage when source parameters are used and lineage needs to be created from source expression.
- Comments not reflecting after ingestion for DB columns in Vertica.
- Custom theme styling issues.
- Entity right panel collapsing issue.
- Feeds count not showing up in PipelineDetails page.
- Reverse metadata workflow exits with 1 when test connection fails.${CollateIconWithLinkMD}
- Knowledge center card in entity page not containing data.${CollateIconWithLinkMD}
- Implement Collate AI Documentation Agent Service Filter.
- 
`,
    },
  },
  {
    id: 70,
    version: 'v1.7.2',
    description: 'Released on 10th June 2025.',
    features: [],
    changeLogs: {
      Improvements: `-  Add Databricks Sampler, Refactor Unity Catalog Sampler.
-  Looker explore to view Column Lineage.
-  Looker column level lineage.
-  Add  dbt tags Filter.
-  Add a tool to openmetadata-ops.sh to delete orphaned relations.
-  Add lineage dialect for Exasol, Trino and Vertica.
-  Upgrade google-cloud-secret-manager python requirement version.
-  Add data insights migrations to remove stale objects.
-  Add Turkish language.
-  Add method to filter ingestion pipeline based on metadata
-  Improve renderning time for profiler chart for large amount of data.
-  Add logic to handle WorkflowContext on Ingestion.
-  Pendo Integration key in api response.
-  SSIS Connector.
-  Improve pdf export image file and supported dynamic spacing.`,
      Fixes: `
- Update the file upload option input for service config.      
- Remove the type not wanted in pdfLayout config.
- Profile config plus icon misaligned.
- Lineage upstream having additional nodes.
- Tableau Improvements.
- Tableau Validation Errors.
- Looker cll parsing issue. 
- Looker CLL errors.
- Domain truncate issue || consistent Domain UX.
- Issue related to SQL query viewer.
- Profile redirection issue for displayname.
- Entity header truncate issue.
- Select popup sticky for scrollable container.
- Overflow for frequently joined table widget.
- Persona switching not updating if customization not present.
- Schema / tags/ api collection switch does not update content in UI.
- Copy-Paste from Excel triggers file upload instead of pasting content.
- Add data insights migrations to remove stale objects.
- Added displayName to add Asset Selection Model.
- Background color for text highlight in tables of explore cards.
- Glossary permission error.
- Fix missing pydantic_fields exceptions.
- Flickering and tooltip issue in lineage node columns.
- Row sampling error.
- Tier tag not updating in search filters.
- Add support for multiple owners for dbt models.
- Remove unused import of getBasePath from RouterUtils.ts.
- Tags dropdown overlapping if multiple open at a time.
- Filter Ingestion Pipelines by provider.
- Automation Workflows should not be updated by the SM & cleanup migration.
- Fix bot being used in pipelines and workflows.
- Remove Tier filters from AI agents in AutoPilot.
- Lineage child node column name not taking remaining space in card and showMoreButton.
- Handle logout gracefully.
- Databricks Schema Description.
- Dashboard data model name column should not be link.
- Pagination limit for dashboards.
- Add agents dropdown not showing auto-classification agent option.
- Filter announcment widget from customisation.
- Updated snowflake test based on new configs.
- PII DateTime False Positives.
- Profile Picture display issues.
- Persona customization widgets style issues.
- Update Lightdash connector.
- Doris ingestion failed.
- Query builder widget any and not operations.
- Revert search order and minor styles changes.
- Bump indices.query.bool.max_clause_count=4096.
- Make presidio_analyzer a lazy import in the PII processor.
- PBI dataset expressions empty value fix.
- Fix limits & logging.
- Import failing on database service due to double encoding.
- Auto Tier w/ followers serialization. 
- Clean description from WAII.
- Review activity handling.
- Fix setIdleTimeout with lower jetty version.
- Fixed the new tags component not showing in the automator form. 
`,
    },
  },
];
