---
title: Roadmap
slug: /overview/roadmap
---

# Roadmap

Here is the OpenMetadata Roadmap for the next 3 releases. We are doing a monthly release, and we are going to evolve fast
and adapt to the community needs.

The below roadmap is subject to change based on community needs and feedback. Please file an Issue on [GitHub](https://github.com/open-metadata/OpenMetadata/issues) 
or ping us on [Slack](https://slack.open-metadata.org/) If you would like to prioritize any feature or would like to add a new feature.

<br></br>

You can check the latest release [here](/overview/releases).

## 0.12.0 Release - Aug 17th, 2022

<TileContainer>
  <Tile
    title="Access Control and Policies"
    text=""
    background="yellow-70"
    bordercolor="yellow-70"
    link="https://github.com/open-metadata/OpenMetadata/issues/4199"
  >
    <li>Overhaul of Access Control and Policies to provide fine-grained access control</li>
    <li>Improved organization of Teams and hierarchical Teams</li>
    <li>Define policies and create roles with multiple policies</li>
    <li>UI improvements to add ACLs and control user access based on the roles</li>
  </Tile>
  <Tile
    title="Collaboration"
    text=""
    background="purple-70"
    bordercolor="purple-70"
    link=""
    size="half"
  >
    <li>Request for tags and turn them into tasks</li>
    <li>Glossary term approval workflow as a task</li>
    <li>Improved notifications and integration into web browser notifications</li>
    <li>Announcements. Send announcements to your team or org level</li>
    <li>Table Deprecation announcement</li>
  </Tile>
  <Tile
    title="Data Quality"
    text=""
    background="pink-70"
    bordercolor="pink-70"
    link="https://github.com/open-metadata/OpenMetadata/issues/4652"
  >
    <li>Updated APIs to register to test cases from different platforms such as GE, Deequ, etc.</li>
    <li>Time-Series storage of profiler details and test case results</li>
    <li>Improved UI to visualize the Data Profiler data</li>
    <li>Improved UI to add and visualize the data quality tests</li>
    <li>Test Notifications</li>
  </Tile>
  <Tile
    title="Security"
    text=""
    background="green-70"
    bordercolor="green-70"
    link="https://github.com/open-metadata/OpenMetadata/issues/5803"
    size="half"
  >
    <li>Support for SAML based authentication for AWS SSO and Google</li>
    <li>Support for pluggable secure stores to store any secrets for OpenMetadata such as service connections</li>
  </Tile>
  <Tile
    title="Site-Wide Settings"
    text=""
    background="yellow-70"
    bordercolor="blue-70"
  >
    <li>Single, Centralized settings Page</li>
    <li>Add Slack integrations via Settings page similar to Webhooks</li>
    <li>Custom Attribute support for all entities</li>
  </Tile>
  <Tile
    title="Connectors"
    text=""
    background="purple-70"
    bordercolor="blue-70"
  >
    <li>Fivetran</li>
    <li>Sagemaker</li>
    <li>Mode</li>
    <li>Redpanda</li>
    <li>Prefect</li>
  </Tile>
    <Tile
    title="ML Features"
    text="With the addition of the SageMaker connector"
    background="blue-70"
    bordercolor="blue-70"
  />
</TileContainer>

## 0.13.0 Release - Sept 28th, 2022

<TileContainer>
  <Tile
    title="Data Intelligence"
    text=""
    background="yellow-70"
    bordercolor="yellow-70"
    link=""
  >
    <li>Reports/Dashboards on how to your data is doing</li>
    <li>Data Ownership/Description coverage</li>
    <li>Weekly Notifications through Email to have better coverage</li>
  </Tile>
  <Tile
    title="Collaboration"
    text=""
    background="purple-70"
    bordercolor="purple-70"
    link=""
    size="half"
  >
    <li>Badges for Users to recognize their contributions to improve Data</li>
    <li>Teams Integration</li>
    <li>Email notifications</li>
    <li>Improvements Tasks & Activity Threads</li>
    <li>Capture popularity based on thumbs up/thumbs down and number of followers</li>
  </Tile>
  <Tile
    title="Entities"
    text=""
    background="pink-70"
    bordercolor="pink-70"
  >
    <li>Add support json based documents</li>
    <li>Support for ElasticSearch, MongoDB etc.</li>
    <li>Parse and Expand Arrays of Structs</li>
    <li>Report Entity</li>
    <li>Notebooks as an Entity</li>
  </Tile>
  <Tile
    title="Connectors"
    text=""
    background="green-70"
    bordercolor="green-70"
  >
    <li>Qwik</li>
    <li>DataStudio</li>
    <li>Trino Usage</li>
    <li>LookML</li>
    <li>Dagster</li>
    <li>One click migration from Amundsen and Atlas.</li>
  </Tile>
  <Tile
    title="Data Quality"
    text=""
    background="yellow-70"
    bordercolor="yellow-70"
    link="https://github.com/open-metadata/OpenMetadata/issues/4652"
  >
    <li>Custom SQL improvements, Allow users to validate the sql and run</li>
    <li>Improvements to data profiler metrics</li>
    <li>Performance improvements to data quality</li>
  </Tile>
  <Tile
    title="Security"
    text=""
    background="purple-70"
    bordercolor="purple-70"
  >
    <li>Domain based restriction and domain only view</li>
    <li>Policy improvements based on community feedback</li>
  </Tile>
  <Tile
    title="Reverse Metadata"
    text="Support for propagating OpenMetadata description/tags to data sources such as snowflake, BigQuery, Redshift etc."
    background="pink-70"
    bordercolor="pink-70"
  />
  <Tile
    title="Lineage"
    text="Support Spark Lineage"
    background="green-70"
    bordercolor="green-70"
  />
</TileContainer>

## 0.14.0 Release - Nov 9th, 2022

<TileContainer>
  <Tile
    title="Automation"
    text=""
    background="yellow-70"
    bordercolor="yellow-70"
  >
    <li>Automation framework to listen change events to run automated workflows</li>
    <li>Auto classifier automation</li>
  </Tile>
  <Tile
    title="Data Intelligence"
    text=""
    background="purple-70"
    bordercolor="purple-70"
  >
    <li>Tiering Report</li>
    <li>Cost analysis</li>
  </Tile>
  <Tile
    title="Data Observability"
    text=""
    background="pink-70"
    bordercolor="pink-70"
  >
    <li>Add support for Data Observability with Freshness metric</li>
    <li>ML Support to understand the behavior of datasets and add metrics</li>
    <li>Data SLAs</li>
  </Tile>
  <Tile
    title="Entities"
    text="Add external API endpoints"
    background="green-70"
    bordercolor="green-70"
  />
  <Tile
    title="Connectors"
    text=""
    background="yellow-70"
    bordercolor="blue-70"
  >
    <li>AWS kinesis</li>
    <li>Kafka Connect</li>
    <li>Microstrategy</li>
    <li>Custom service integration - Users can integrate with their own service type</li>
  </Tile>
</TileContainer>

## 1.0 Release - Dec 15th, 2022

<TileContainer>
  <Tile
    title="Announcing 1.0 Release"
    text="OpenMetadata Graduating 1.0 Release with many of our foundational features shipped"
    background="yellow-70"
    bordercolor="yellow-70"
  />
  <Tile
    title="Data Intelligence"
    text="Data Deletion Report"
    background="purple-70"
    bordercolor="purple-70"
  />
  <Tile
    title="Data Observability - Incident Management"
    text=""
    background="pink-70"
    bordercolor="pink-70"
  >
    <li>Identify the failure of pipelines</li>
    <li>Identify the dataset is failing through lineage</li>
    <li>Trigger hard/soft alerts based on the lineage and impact</li>
  </Tile>
</TileContainer>
