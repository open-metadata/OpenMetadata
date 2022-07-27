---
title: Roadmap
slug: /overview/roadmap
---

# Roadmap

Here is the OpenMetadata Roadmap for the next 3 releases. We are doing a monthly release, and we are going to evolve fast
and adapt to the community needs.

The below roadmap is subject to change based on community needs and feedback. Please file an Issue on [GitHub](https://github.com/open-metadata/OpenMetadata/issues) 
or ping us on [Slack](https://slack.open-metadata.org/) If you would like to prioritize any feature or would like to add a new feature.

## 0.12.0 Release - Aug 17th, 2022

### Access Control and Policies #4199
 - Overhaul of Access Control and Polciies to provide fine grained access control
 - Improved organization of Teams and hierarchical Teams
 - Define policies and create roles with multiple policies
 - UI improvements to add ACLs and control user access based on the roles
### Collaboration
 - Request for tags and turn them into tasks
 - Glossary term approval workflow as a task
 - Improved notifications and integration into webbrowser notifications
 - Announcements. Send annoucements to your team or org level 
 - Table Deprecation announcement.
### Data Quality #4652
- Updated APIs to register to test cases from different platforms such as GE, Deequ etc..
- Time-Series storage of profiler details and test case results
- Improved UI to visualize the Data Profiler data 
- Improved UI to add and visualize the data quality tests
- Test Notifications
### Security
- Support for SAML based authentication for AWS SSO and Google. #3376
- Support for pluggable secure stores to store any secrets for OpenMetadata such as service connections. More details #5803
### ML Features
- Sagemake connector
### Site-Wide Settings
- Single, Centralized settings Page
- Add Slack integrations via Settings page similar to Webhooks
- Custom Attribute support for all entities
### Connectors
- Fivetran
- Sagemaker
- Mode
- Redpanda
- Prefect


## 0.13.0 Release - Sept 28th, 2022

### Data Intelligence
- Reports/Dashboards on how to your data is doing
- Data Ownership/Description coverage
- Weekly Notifications through Email to have better coverage

### Collaboration
- Badges for Users to recognize their contributions to improve Data
- Teams Integration
- Email notifications
- Improvements Tasks & Activity Threads
- Capture popularity based on thumbs up/thumbs down and number of followers

### Reverse Metadata
- Support for propagating OpenMetadata description/tags to data sources such as snowflake, BigQuery, Redshift etc..

### Lineage
- Support Spark Lineage

### Entities 
- Add support json based documents
- Support for ElasticSearch, MongoDB etc..
- Parse and Expand Arrays of Structs
- Report Entity 
- Notebooks as an Entity

### Security
- Domain based restriction and domain only view
- Policy improvements based on community feedback

### Data Quality 
- Custom SQL improvements, Allow users to validate the sql and run
- Improvements to data profiler metrics
- Performance improvements to data quality

### Connectors
- Qwik
- DataStudio
- Trino Usage
- LookML
- Dagster
- One click migration from Amundsen and Atlas.


## 0.14.0 Release - Nov 9th, 2022

### Automation
- Automation framework to listen change events to run automated workflows
- Auto classifier automation
-
### Data Intelligence
- Tiering Report
- Cost Analysis
- Data Lake Improvements
- Add all metadata into OpenMetadata
-
### Data Observability 
- Add support for Data Observability with Freshness metric
- ML Support to understand the behavior of datasets and add metrics
- Data SLAs

### Entities
- Add external API endpoints

### Connectors
- AWS kinesis
- Kafka Connect
- Microstrategy
- Custom service integration - Users can integrate with their own service type


## 1.0 Release - Dec 15th, 2022

### Announcing 1.0 Release
- OpenMetadata Graduating 1.0 Release with many of our foundational features shipped

### Data Intelligence
- Data Deletion Report

### Data Observability - Incident Management
- Identify the failure of pipelines
- Idenity the dataset is failing through lineage
- Trigger hard/soft alerts based on the ienage and impact.

### Data Observability 
- Add support for Data Observability with Freshness metric
- ML Support to understand the behavior of datasets and add metrics

You can check the latest release [here](/overview/releases).
