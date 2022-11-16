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

## 0.13.0 Release - Nov 16th, 2022

<TileContainer>
  <Tile
    title="Data Insights"
    text=""
    background="pink-70"
    bordercolor="pink-70"
    link="https://github.com/open-metadata/OpenMetadata/issues/4652"
  >
    <li>Data Insights will provide analytics on top of metadata collected in OpenMetadata.</li>
    <li>Reports/Dashboards on how to your data is doing</li>
    <li>Data Ownership/Description coverage</li>
    <li>Admins should be able to view aggregated user activity, such as user growth and user engagement, in OpenMetadata</li>
    <li>Weekly Data Insights Reports to the team to understand how their team is performing relative to KPIs set at the org level and, in general, nudging the teams to get to better data by giving insights into the metadata.</li>
  </Tile>
  <Tile
    title="Access Control and Policies"
    text=""
    background="yellow-70"
    bordercolor="yellow-70"
    link="https://github.com/open-metadata/OpenMetadata/issues/4199"
  >
    <li>Add Search Results Integration</li>
    <li>Roles and Policies application to TestSuite and TestCases</li>
  </Tile>
  <Tile
    title="Glossary"
    text=""
    background="purple-70"
    bordercolor="purple-70"
    link=""
    size="half"
  >
    <li>Bulk upload of Glossary Terms</li>
    <li>Glossary Review Workflow. Owners and Reviewers can approve or deny a Glossary Term to be used. When a user adds a GlossaryTerm, it will open a task and assign it to the owner and reviewers.</li>
    <li>Propagate tags at the root of glossary terms to its children</li>
    <li>Propagate tags/glossary by tagging at the database/schema level and applying them to all the schemas/tables underneath them.</li>
  </Tile>
  <Tile
    title="Notifications"
    text=""
    background="green-70"
    bordercolor="green-70"
    link="https://github.com/open-metadata/OpenMetadata/issues/5803"
    size="half"
  >
    <li>Improved workflow to build Alerts and filtering mechanisms</li>
    <li>Admins can now configure email templates. </li>
    <li>Admins can set up an email notification for an event, such as a schema change notification, etc..</li>
  </Tile>
  <Tile
    title="Lineage"
    text=""
    background="yellow-70"
    bordercolor="blue-70"
  >
    <li>Better lineage coverage for DBT and PowerBI</li>
    <li>Traceability at the table-level land column-level lineage</li>
    <li>Showcase transformations or functions used to convert one column to another as an edge</li>
    <li>Improvements to our SQL Parser to collect lineage and extend the parser to more SQL dialects</li>
  </Tile>
  <Tile
    title="Data Quality"
    text=""
    background="yellow-70"
    bordercolor="blue-70"
  >
    <li>Freshness based on the partition key</li>
    <li>TestCase versioning and results applying to a specific version so that UI can show the results as per the test case version</li>
    <li>Auto Classification by Tagging entities using profiler - **beta**</li>
  </Tile>
  <Tile
    title="Connectors"
    text=""
    background="blue-70"
    bordercolor="purple-70"
  >
    <li>Domo</li>
    <li>Databricks SQL</li>
    <li>Amundsen</li>
    <li>Improve coverage of primary/foreign key/partition details for all the databases/data </li>
    <li>Several improvements to the Ingestion framework.</li>
  </Tile>
  <Tile
    title="Messaging - Kafka & Redpanda"
    text=""
    background="purple-70"
    bordercolor="blue-70"
  >
    <li>AVRO/Protobuf schema parsing and showing them in the topic entity view; currently, we show it as one payload</li>
    <li>Users will be able to add descriptions/tags at the field level</li>
    <li>Users can search based on fields in a schema of a topic.</li>
  </Tile>
  <Tile
    title="Reverse Metadata"
    text=""
    background="yellow-70"
    bordercolor="blue-70"
  >
    <li>We are super excited about this feature coming in 0.13.0</li>
  </Tile>
  
</TileContainer>

## 1.0 Release - Dec 21st, 2022

<TileContainer>
  <Tile
    title="APIs & Schemas"
    text=""
    background="yellow-70"
    bordercolor="yellow-70"
    link=""
  >
    <li>Entity Schema specification versioning</li>
    <li>Defining API backward compatability</li>
  </Tile>
  <Tile
    title="Lineage"
    text=""
    background="purple-70"
    bordercolor="purple-70"
    link=""
    size="half"
  >
    <li>Spark Lineage</li>
    <li>Propagation of tags and descriptions through the column-level lineage</li>
    <li>UI Improvements to the queries collected and attached to a table. Allow users upvote a query to show as an example</li>
  </Tile>
  <Tile
    title="Collaboration"
    text=""
    background="pink-70"
    bordercolor="pink-70"
  >
    <li>Improvements Task & Activity Feed</li>
    <li>Capture the popularity of entities based on thumbs up and down</li>
    <li>Knowledge Articles - Users/Data Stewards can build knowledge articles right within OpenMetadata and attach them at the entity or database level. These articles can be searchable</li>
  </Tile>
  <Tile
    title="Entities"
    text=""
    background="green-70"
    bordercolor="green-70"
  >
    <li> Add support for NoSQL/Json-based documents as entities. This will help integrate Cassandra/ElasticSearch etc.. services.</li>
    <li>Storage Services such as S3 and showcase buckets as independent entities</li>
  </Tile>
  <Tile
    title="Data Quality"
    text=""
    background="yellow-70"
    bordercolor="yellow-70"
    link="https://github.com/open-metadata/OpenMetadata/issues/4652"
  >
    <li>Complex types</li>
    <li>Add support for computing completeness</li>
    <li>Add support for anomaly detection</li>
    <li>Improvements to Auto Classification of entities by ML</li>
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
    text=""
    background="green-70"
    bordercolor="green-70"
  >
    <li>Spark Lineage</li>
    <li>Connector Lineage improvements</li>
  </Tile>
</TileContainer>

## 1.1 Release - Feb 15th 2023

<TileContainer>
  <Tile
    title="Automation"
    text=""
    background="yellow-70"
    bordercolor="yellow-70"
  >
    <li>Automation framework to listen change events to run automated workflows</li>
  </Tile>
  <Tile
    title="Data Observability"
    text=""
    background="purple-70"
    bordercolor="purple-70"
  >
    <li>Notifications will be grouped into Activity vs. Alert type notifications</li>
    <li>Data SLAs</li>
    <li>Impact Analysis</li>
  </Tile>
  <Tile
    title="Data Insights"
    text=""
    background="pink-70"
    bordercolor="pink-70"
  >
    <li>Cost analysis report</li>
    <li>Data Deletion Report</li>
  </Tile>
  <Tile
    title="Entities"
    text=""
    background="green-70"
    bordercolor="green-70"
  >
  <li> Add support for Notebook Entity </li>
  <li> Add support for Report Entity </li>
  </Tile>
</TileContainer>
