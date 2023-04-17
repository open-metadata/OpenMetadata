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


## 1.0 Release - April 17th, 2023

<TileContainer>
   <Tile
    title="APIs & Schema"
    text=""
    background="yellow-70"
    bordercolor="yellow-70"
    link=""
  >
    <li>Stabilization and Improvements to Schemas and APIs</li>
    <li>Backward compatability of the APIs </li>
  </Tile>
    <Tile
    title="Ingestion"
    text=""
    background="green-70"
    bordercolor="green-70"
  >
  	 <li> Improved UI/UX for Connector Deployment</li>
  	 <li> Test Connection will provide clear status on what are all the required permissions we need to extract metadat, lineage, profiler etc.. </li>
    <li> Performance Improvements in fetching description, tags </li>
    <li> finite control over the ingesting ownership, tags </li>
    <li> dbt performance improvements </li>
    <li> Support for Tableau & PowerBI data models </li>
    <li> SSO Service accounts for ingestion will be deprecated. JWT token based authentication will be preferred </li>
  </Tile>

  <Tile
    title="Entities"
    text=""
    background="purple-70"
    bordercolor="purple-70"
    link=""
  >
    <li>Object Store service, to extract the objects from storage services such as S3</li>
    <li>ElasticSearch Connector</li>
    <li>Query as Entity, Overhaul of queries UI</li>
    <li>Support for Long Entity Names such as S3 paths</li>
    <li>Import/Export support at all entities </li>
    <li>Tag Propgation using Import/Export </li>
    <li>Data Models for Dashboards </li>
  </Tile>
    <Tile
    title="Glossary"
    text=""
    background="green-70"
    bordercolor="green-70"
  >
  	 <li> Glossary & Tags Search enabled at global search</li>
    <li> Drag & Drop, Glossary Terms with-in Glossary and Across Glossaries </li>    
    <li> Add Assets to a Glossary Term from Glossary Term page </li>
  </Tile>
  
  <Tile
    title="Security"
    text=""
    background="red-70"
    bordercolor="red-70"
    link=""
  >
    <li>SAML support</li>
    <li>User Personal Access Token to access APIs as a user</li>
  </Tile>
    <Tile
    title="Lineage"
    text=""
    background="green-70"
    bordercolor="green-70"
  >
  	 <li> Support for displaying large no.of nodes(1000+) in Lineage UI</li>
    <li> Improved Lineage UI to navigate </li>
    <li> Continued improvements to SQL Parser to handle queries </li>
  </Tile>

  <Tile
    title="Auto Classification"
    text=""
    background="yellow-70"
    bordercolor="yellow-70"
  >
    <li>PII auto classifcation using ML and NLP.</li>
  </Tile>
  <Tile
    title="Localization"
    text=""
    background="purple-70"
    bordercolor="purple-70"
  >
    <li>Full support for localization in the UI</li>
    <li>Support for English, French, Spanish and Chinese</li>
  </Tile>
</TileContainer>

## 1.1 Release - May 18th 2023

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
    title="Entities"
    text=""
    background="green-70"
    bordercolor="green-70"
  >
  <li> Add support for Notebook Entity </li>
  <li> Add support for Report Entity </li>
  </Tile>
 </TileContainer>
