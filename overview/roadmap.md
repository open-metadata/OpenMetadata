# Roadmap

Here is the OpenMetadata Roadmap for the next 3 releases.

We are doing a monthly release and we are going to evolve fast and adapt to community needs. Below roadmap is subject to change based on community needs and feedback. our roadmap yet, please file an Issue [Github](https://github.com/open-metadata/OpenMetadata/issues) or ping us on [Slack](https://slack.open-metadata.org)

If you would like to prioritize any feature or would like to add a new feature that is not in our roadmap yet, please file an Issue on [Github](https://github.com/open-metadata/OpenMetadata/issues) or ping us on [Slack](https://slack.open-metadata.org).

Please check our [Releases page](releases.md) to see all the features we shipped so far.

## Roadmap



## 0.11.1 Release - July 21st, 2022

### Access Control and Policies [#4199](https://github.com/open-metadata/OpenMetadata/issues/4199)

* Overhaul of Access Control and Polciies to provide fine grained access control
* Improved organization of Teams and hierarchical Teams
* Define policies and create roles with multiple policies
* UI improvements to add ACLs and control user access based on the roles

### Collaboration

* Request for tags and turn them into tasks
* Glossary term approval workflow as a task
* Improved notifications and integration into webbrowser notifications
* Announcements. Send annoucements to your team or org level
* Table Deprecation announcement.

### Data Quality [#4652](https://github.com/open-metadata/OpenMetadata/issues/4652)

* Updated APIs to register to test cases from different platforms such as GE, Deequ etc..
* Time-Series storage of profiler details and test case results

### Security

* Support for SAML based authentication for AWS SSO and Google. [#3376](https://github.com/open-metadata/OpenMetadata/issues/3376)
* Support for pluggable secure stores to store any secrets for OpenMetadata such as service connections. More details [#5803](https://github.com/open-metadata/OpenMetadata/issues/5803)

### ML Features

* support ML feature UI
* Sagemake connector

## Latest Release - 0.11.0 Release - Jun 30th, 2022

#### Data Collaboration - Tasks and Emojis

Data Collaboration has been the prime focus of the 0.11 Release, the groundwork for which has been laid in the past several releases. In the 0.9 release, we introduced Activity Feeds, Conversation Threads, and the ability to request descriptions. In this release, we’ve added Tasks, as an extension to the ability to create conversations and post replies.\
We are particularly excited about the ability to suggest tasks. This brings the collaboration to the next level where an organization can crowdsource the knowledge and continuously improve descriptions.

#### Column Level Lineage

[#2931](https://github.com/open-metadata/OpenMetadata/issues/2931)\
In OpenMetadata, we primarily compute column-level lineage through SQL query analysis. Lineage information is consolidated from various sources, such as ETL pipelines, DBT, query analysis, and so on. In the backend, we’ve added column-level lineage API support. The UI now supports exploring this rich column-level lineage for understanding the relationship between tables and performing impact analysis. While exploring the lineage, users can manually edit both the table and column level lineage to capture any information that is not automatically surfaced.

#### Custom Properties

The key goal of the OpenMetadata project is to define Open Metadata Standards to make metadata centralized, easily shareable, and make tool interoperability easier. We take a schema-first approach for strongly typed metadata types and entities modeled using JSON schema as follows:

OpenMetadata now supports adding new types and extending entities when organizations need to capture custom metadata. New types and custom fields can be added to entities either using API or in OpenMetadata UI. This extensibility is based on JSON schema and hence has all the benefits of strong typing, rich constraints, documentation, and automatic validation similar to the core OpenMetadata schemas.

#### Advanced Search

Users can search by multiple parameters to narrow down the search results. Separate advanced search options are available for Tables, Topics, Dashboards, Pipelines, and ML Models. All these entities are searchable by common search options such as Owner, Tag, and Service.

#### Glossary UI Updates

The Glossary UI has been upgraded. However, the existing glossary functionality remains the same, with the ability to add Glossary, Terms, Tags, Descriptions, Reviewers etc... On the UI, the arrangement displaying the Summary, Related Terms, Synonyms, and References has been changed. The Reviewers are shown on the right panel with an option to add or remove existing reviewers.

#### Profiler and Data Quality Improvements

Profiling data and communicating quality across the organization is core to OpenMetadata. While numerous tools exist, they are often isolated and require users to navigate multiple interfaces. In OpenMetadata, these tests and data profiles are displayed alongside your assets (tables, views) and allow you to get a 360-degree view of your data.

#### Great Expectations Integration

While OpenMetadata allows you to set up and run data quality tests directly from the UI, we understand certain organizations already have their own data quality tool. That’s why we have developed a direct integration between Great Expectations and OpenMetadata. Using our `openmetadata-ingestion[great-expectations]` python submodule, you can now add custom actions to your Great Expectations checkpoints file that will automatically ingest your data quality test results into OpenMetadata at the end of your checkpoint file run.

#### ML Models

In this release, we are happy to share the addition of ML Model Entities to the UI. This will allow users to describe, and share models and their features as any other data asset. The UI support also includes the ingestion through the UI from [MLflow](https://mlflow.org/). In future releases, we will add connectors to other popular ML platforms.\
This is just the beginning. We want to learn about the use cases from the community and connect with people that want to help us shape the vision and roadmap. Do not hesitate to reach out!

#### Connectors

In every release, OpenMetadata has maintained its focus on adding new connectors. In the 0.11 release, five new connectors have been added - [Airbyte](https://airbyte.com/), [Mode](https://mode.com/), [AWS Data Lake](https://aws.amazon.com/big-data/datalakes-and-analytics/what-is-a-data-lake/), [Google Cloud Data Lake](https://cloud.google.com/learn/what-is-a-data-lake#section-6), and [Apache Pinot](https://pinot.apache.org/).

##
