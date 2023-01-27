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

## 0.13.1 Release - Dec 22nd, 2022

<TileContainer>
  <Tile
    title="Lineage"
    text=""
    background="purple-70"
    bordercolor="purple-70"
    link=""
    size="half"
  >
    <li>UI Improvements to the queries collected and attached to a table. Allow users upvote a query to show as an example</li>
  </Tile>
 <Tile
    title="Data Quality"
    text=""
    background="yellow-70"
    bordercolor="blue-70"
  >
    <li>Freshness based on the partition key</li>
    <li>TestCase versioning and results applying to a specific version so that UI can show the results as per the test case version</li>
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
    title="Messaging - Kafka & Redpanda"
    text=""
    background="purple-70"
    bordercolor="blue-70"
  >
    <li>AVRO/Protobuf schema parsing and showing them in the topic entity view; currently, we show it as one payload</li>
    <li>Users will be able to add descriptions/tags at the field level</li>
    <li>Users can search based on fields in a schema of a topic.</li>
  </Tile>

</TileContainer>



## 1.0 Release - Marc 14th, 2023

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
    <li>Overhaul of lineage query parsing and improved new library</li>
    <li>UI Improvements to the queries collected and attached to a table. Allow users upvote a query to show as an example</li>
  </Tile>
  <Tile
    title="Collaboration"
    text=""
    background="pink-70"
    bordercolor="pink-70"
  >
    <li>Improvements Task & Activity Feed</li>
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
    <li>Improvements to Auto Classification of entities by ML</li>
  </Tile>
  <Tile
    title="Security"
    text=""
    background="purple-70"
    bordercolor="purple-70"
  >
    <li>Search results integration for roles and policies</li>
    <li>Domain based restriction and domain only view</li>
    <li>Policy improvements based on community feedback</li>
  </Tile>
</TileContainer>

## 1.1 Release - April 18th 2023

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
    title="Lineage"
    text=""
    background="purple-70"
    bordercolor="purple-70"
    link=""
    size="half"
  >
    <li>Propagation of tags and descriptions through the column-level lineage</li>
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
  <Tile
    title="Reverse Metadata **beta**"
    text=""
    background="yellow-70"
    bordercolor="blue-70"
  >
  </Tile>
</TileContainer>
