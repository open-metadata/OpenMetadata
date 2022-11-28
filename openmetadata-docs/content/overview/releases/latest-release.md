---
title: Latest Release
slug: /overview/latest-release
---


# 0.13.0 Release - Nov 23rd 2022 🎉
This is our stable release and we recommend community to upgrade to the 0.12.1 release

## Data Insights

Data insights aims to provide a single pane view of all the key metrics to best reflect the state of your data. Admins can define the Key Performance Indicators(KPIs) and set goals within OpenMetadata to work towards better documentation, owernship, tiering


## Lienage Traceability

Lineage UI has been transformed to enhance user experience. Users can get a holistic view of an entity from the Lineage tab. When a entity is selected, the UI displays end-to-end lineage traceability for the table and column levels, Just search for an entity and expand the graph to unfold lineage. It'll display the upstream/downstream of nodes

## Search Relevancy and Advanced Search

- Default operator for search queries is chaned to "OR"
- We are ranking search results based on weekly usage metric. In searches similarly ranked tables with higher weekly usage will be shown first in the results
- An advanced search feature has been introduced in the 0.13.0 release, which helps users discover assets quickly with a syntax editor on AND/OR conditions

## Data Lake Profiler

- Users can now create and deploy profiling workflows for Data Lake connector which supports AWS S3 and GCS

## Security
- LDAP login is now supported
- Bot accounts now have policies

## Connectors
New connectors are an essential part of every release in OpenMetadata. We are introducing four new connectors in this release:

- Domo is a cloud-based dashboard service. The Domo Business Cloud is a low-code data app platform that takes the power of BI to the next level by combining all your data and putting it to work across any business process or workflow. OpenMetadata supports Domo as a Database, Dashboard, as well as a Pipeline service.
- AWS SageMaker is a fully managed machine learning service, where data scientists and developers can quickly and easily build and train machine learning models, and then directly deploy them into a production-ready hosted environment.
- AWS Kinesis is a cloud-based messaging service that allows real-time processing of streaming large amounts of data per second.
- AWS QuickSight is a cloud-scale business intelligence (BI) service that allows everyone in the organization to understand the data by asking questions in natural language, exploring through interactive dashboards, or automatically looking for patterns and outliers powered by machine learning.



# 0.12.1 Release - Oct 3rd 2022 🎉
This is our stable release and we recommend community to upgrade to the 0.12.1 release

## Basic Authentication

- User/Password signup and login
- Email notifications for forgotten password and new user signed up
- Admin can add new users and send an email 

## ElasticSearch full re-index through UI

- Now admins can full re-index elasticsearch through the UI itself

## Versioning Support for Custom Attributes

- Any changes to entity custom attributes are now versioned

## DBT Metadata - Tags

- We support ingesting DBT tags into OpenMetadata

## Bots Integration 

- Admins can create bots and their security mechanism from UI itself

## Bug Fixes

- Around 136 Features/Improvements/Tests made it into 0.12.1 release 

# 0.12.0 Release - Sept 7th 2022 🎉

You can read the Release Blog [here](https://blog.open-metadata.org/openmetadata-0-12-0-release-1ac059700de4)
or watch an awesome video showing the new features!

<YouTube videoId="tv3pyCLcJfQ" start="0:00" end="17:04"/>

<br></br>
<br></br>

## Team Hierarchy
Prior releases supported a flat hierarchy of just Teams and Users. In 0.12, support has been added for the entire organizational hierarchy with Business Unit, Division, Department, and Groups. An organization from small to very large can now be modeled in OpenMetadata with this feature.

## Roles and Policies

Access Control functionality has been revamped to support many use cases that were not possible before. Previously, a Role contained a single Policy, which consisted of simple Rules to Allow/Not Allow. The advanced rule configuration in the 0.12 release allows users to build more expressive rules using conditions.

- A Role is a collection of Policies. Roles can be assigned to users or teams where all the users in the team inherit the team roles.
- A Policy is a collection of Rules. A Policy can be reused as it can be part of a Role or can be directly assigned to Teams.
- A Rule is defined by a set of Resources, a set of Operations, an Effect to either Deny or Allow the operation, and a condition written as SpEL expression to add additional conditions based on metadata attributes. Examples of conditions — isOwner(), noOwner() && !matchTags('PII').

## Data Quality and Data Profiler

OpenMetadata began support for Data Quality in the 0.10 release, and support was added for publishing Great Expectations results in the 0.11 release. Our goal with OpenMetadata is to define metadata standards for all things data and in this release, we are standardizing Tests and Data Quality metadata. Data Quality Tests can be expressed in JSON schema and now these tests can be added dynamically using the Test Definitions API. We have also added a custom SQL data quality test that allows you to write your data quality tests using SQL statements.

An interactive dashboard helps to visualize and explore the data from the Data Profiler. You can explore how your data is changing over time, and identify data drifts using this dashboard. You can also see how data quality is changing by looking at how tests are doing over time. What is even better is, that you can explore this at both the table level or drill down to each column level going back up to 60 days.

The UI supports the detailed exploration of data quality tests, and users can drill down for the details of the test results present in a time series fashion. Tests can be added easily from the Profiler tab in the UI, both at the Table and Column levels. The UI provides a one-glance update on the metrics with a summary of data quality at the Table and Column levels.

## Announcements

Informing users about upcoming changes to the data is a big challenge. In most organizations, a team sends an email well in advance about the change. But no one reads/tracks them and finally, when the change is done, many users are unprepared to handle it.

With Announcements, you can now inform your entire team of all the upcoming events and changes, such as deprecation, deletion, or schema changes. These announcements can be scheduled with a start date and an end date. All the users following your data are not only notified in Activity Feeds but a banner is also shown on the data asset details page for users to discover (or be reminded of) the announcement.

## Activity Feed Notifications

In 0.12, we’ve also streamlined the Notifications menu with two separate tabs for Tasks and Mentions, that’ll display only the recent notifications. You can always navigate to your User Profile page to view more activities.

## Slack & Microsoft Teams integration

Users can get timely updates about the metadata change events for all entities through APIs using webhooks. The webhook integration with Slack has been further improved in this release.

OpenMetadata also supports webhook integration to Microsoft Teams, just as it supports Slack. Users can choose to receive notifications for only the required entities by using event filters based on when an entity is created, updated, or deleted. 

## Tasks

In the 0.11 release, a request to add or update descriptions for data assets could be converted to a Task. In the 0.12 release, Tasks can be created based on requests to create or update tags. Also, a glossary term approval workflow can be converted to a Task.


## Secret Management Store Interface

In 0.12, we have completely revamped how that secret is stored, accessed, and by whom; by introducing a Secrets Manager Interface to communicate with any Key Management Store. The KMS will mediate between any OpenMetadata internal requirement and sensitive information. That way, users can choose to use the underlying database as KMS, or any external system. The OpenMetadata community has already added support for AWS Key Management Service and AWS SSM.

## Connectors
New connectors are an essential part of every release in OpenMetadata. We are introducing four new connectors in this release:

- Redpanda is a Kafka API-compatible streaming data platform for developers that unifies historical and real-time data. OpenMetadata now supports Redpanda as a Messaging service, which allows users to document its topics and schemas. Refer to the Redpanda documentation for more info.
- Dagster is a new-generation Python-based orchestrator that’s designed for developing and maintaining data assets, such as tables, data sets, machine learning models, and reports. It has been added as part of OpenMetadata’s pipeline connectors. Read more from the Dagster documentation.
- Fivetran delivers ready-to-use connectors that automatically adapt as schemas and APIs change, ensuring consistent, reliable access to data. It has been added as a pipeline service. For more information, refer to the Fivetran documentation.
- Apache NiFi automates the flow of data between systems. OpenMetadata now supports a NiFi connector as the third new pipeline service on this release.

## Lineage
We’ve enhanced the performance of workflows by having a separate workflow for Lineage and Usage. By using two workflows for computing specific pieces of information, we can effectively filter down the queries to extract lineage.

During table usage ingestion, the tables retrieved successfully will be cached, so that there is no need to repeat the same calls multiple times as many queries would be referencing the same tables.
Usage queries have been optimized.
A result limit has been added to Usage queries.

## Global Settings
The OpenMetadata Settings dropdown menu has been transformed into a single, centralized Settings page for added convenience in viewing all the available options. The Global Settings comprises setting options for Team Members, Access based on Roles and Policies, Services, Data Quality, Collaboration, Custom Attributes, and Integrations for webhooks and bots. Admins can view or update settings for various services like Slack, MS Teams, Webhooks, etc from the Global Settings page.


## UI/UX Improvements
The major UI UX improvements have been done around Roles and Policies and a Global Settings page. Quite a lot of tweaks have been made to the UI to improve the UX.

When creating a new user or when a user is registering for the first time, the dropdown menu for Teams now displays an option to ‘Show All’ teams. Previously, we supported the display of only the first 10 teams. An option has also been provided to search and filter.
UI improvements have been made on the Schema, Service, and Database details pages.
Manage Tab has been replaced with the manage button on the UI.


## Thanks to our Contributors
We are thankful for the overwhelming feedback and support we received from our community. We are grateful to the following community members for their code contributions:

- Pedro Sereno for capturing Metabase lineage with SQL lineage.
- Francisco J. Jurado Moreno — for working on caching tables when ingesting database usage; optimizing Redshift usage query; Datalake connector performance; non-scheduled workflows; and to add a comment to tag all OpenMetadata-related queries.
- Nihar Doshi — for helping with cleaning Atlas, Amundsen, and metadata_rest; and checking MSSQL with windows authentication.

Thanks to Abcabhishek, Bleachzk, Bryson Edwards, Daniel, Fikrifikar, geoHeil, Laila Patel, Nicolas Parot Alvarez, Nilesh Khatri, Pauline Tolstova, Pedro Sereno, Preeti Jain, Sam Firke, Samuel Stuetz, Sidharth Reddy Pallerla, Taurus-Le, TheFu527, Tomislav Sabados, Trillhaa, Upen Bendre for creating issues in GitHub. Thanks to Sergey Stepanov, Zlgonzalez for your feedback and suggestions.
