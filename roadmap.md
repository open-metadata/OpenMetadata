# OpenMetadata Roadmap

Here is the OpenMetadata Roadmap for the next 3 releases.  

We are doing a monthly release and we are going to evolve fast and adopt to community needs.
Below roadmap is subject to change based on community needs and feedback.

If you would like to prioitize any feature or would like to add a new feature thats not in
our roadmap yet, please file an Issue [Github](https://github.com/open-metadata/OpenMetadata/issues) or ping us on [Slack](https://openmetadata.slack.com/archives/C02DZK3QH8Q) 


## 0.4 Release - Sep 20th, 2021 - Completed

Please check the [release notes](https://github.com/open-metadata/OpenMetadata/releases/tag/0.4.0) and
our [blog post](https://blog.open-metadata.org/openmetadata-0-4-0-release-dashboards-topics-data-reliability-14e8672ae0f5)



## Upcoming Releases

## 0.5 Release - Oct 19th, 2021

#### Theme: Data Reliability and Lineage


### Support for Lineage
* Lineage related schemas and APIs
* Lineage metadata integration from AirFlow for tables
* Lineage metadata  integration from Looker, and Superset for Dashboards
* Extra lineage from queries for BigQuery, Hive, Redshift, and Snowflake
* UI changes to show lineage information to the users

### Eventing & Notification framework
* Design for eventing framework for both internal and external applications
* Schema change event
* Schema change notification

### Other features
* Data Reliability - Data profiler integration work in progress
* Schema versioning


## 0.6 Release - Nov 17th, 2021

#### Theme: User collaboration features

### Support for User Collaboration
* Allow users to ask questions, suggest changes, request new features for data assets
* Activity feeds for User and Data assets
* Tracking activity feeds as tasks

### Lineage new features
* Allow users to add lineage information manually for table and column levels
* Tier propagation to upstream datasets using lineage
* Propagating column level tags and descriptions using lineage (Work in progress)

### Other features
* Metadata Change Event integration into Slack and framework for integration into other services such as Kafka or other Notification frameworks
* Data Health Report
* Delta Lake support,  Databricks, Iceberg


