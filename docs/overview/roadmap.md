# Roadmap

Here is the OpenMetadata Roadmap for the next 3 releases.

We are doing a monthly release and we are going to evolve fast and adapt to community needs. Below roadmap is subject to change based on community needs and feedback. our roadmap yet, please file an Issue [Github](https://github.com/open-metadata/OpenMetadata/issues) or ping us on [Slack](https://slack.open-metadata.org)

If you would like to prioritize any feature or would like to add a new feature that is not in our roadmap yet, please file an Issue on [Github](https://github.com/open-metadata/OpenMetadata/issues) or ping us on [Slack](https://slack.open-metadata.org).

## Roadmap

## 0.9.2 Release - Apr 20th, 2022

### Collaboration

* Support for Micro workflows and tasks
* Users can request for description which becomes a task on owner of a dataset
* Resolve threads and Pin threads around activity
* Glossary approval workflow

### Data Quality

* Support for GreatExpectations to push the test result
* Support for all the tests in GreatExpectations as JsonSchemas
* Test Event notifications such as test success or failure
* UX improvements to tests

### Lineage

* Spark Lineage support
* Column level lineage API support
* Provide versioning support to Lineage

### Security

* Improvements to UI login&#x20;
* Support for AWS SSO and LDAP
* Fine grained policy and operations approach which will give option to restrict per entity and tag based policy enforcement

### Connectors

* Sisense
* Cassandra
* MongoDB
* S3 Connector



## 0.9.3 Release - May 25th, 2022

### Data Insights

* Show users/teams how their data doing
* Cost analysis
* How to improve Data culture

### Data Quality

* Data SLAs
* Freshness and completeness
* Ability to deploy GE tests from OpenMetadata UI

### Lineage

* Column Level Lineage support
* Incident detection through Lineage

### Collaboration

* Tiering Report on how to improve data assets and data culture
* Email notifications
* Webbrowser notifications

### ML Features

* support ML feature UI
* Sagemake connector

##

## 1.0

### Data culture / Data quality

* Tier suggestion
* Data dashboard/Insights
  * Suggested tiers, created, deleted last week, descriptions added, ownership with/without number

### ML Features/ML

* Models UI
* ML Service

### Collaboration

* Tag suggest/accept/approve
* Expiry time
* Remind me later
* Data deleting report

### DBT

* Capture Lineage

## 1.1

### User feedback&#x20;

* Tiering report & nudges
* Badges
* Top datasets as positive feedback

### Freshness/completeness workflows and metadata

* SLA

### Collaboration

* Feature requests for datasets

### Integration

* Alation integration to fetch metadata

## 1.2

### Lineage

* Search for a column and show the entire DAG from origin to see how that column/table is generated&#x20;
* Lineage-based freshness and debugging

## 1.3

### Lineage

* Lineage based description, tag, attribute propagation
* Kafka lineage from services
* Periodic Reviews - Such as Tag Review
* Cost Analysis
