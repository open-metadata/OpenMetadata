---
title: Glossary | OpenMetadata Data Glossary Guide
description: Set up glossary terms and definitions to improve search, categorization, and shared understanding.
slug: /how-to-guides/data-governance/glossary
---

# Glossary

A Glossary is a Controlled Vocabulary to describe important concepts and terminologies within your organization to foster a common and consistent understanding of data. A controlled vocabulary is an organized arrangement of words and phrases to define terminology to organize and retrieve information. 

Glossary adds semantics or meaning to data by defining the business terminologies. It defines concepts related to a specific domain. For example, Business Glossary or Bank Glossary. A well-defined business glossary helps foster team collaboration with the use of standard terms. The terms from the glossary can be used for labeling or tagging as additional metadata of data assets for describing and categorizing things. Glossaries are important for data discovery, retrieval, and exploration through conceptual terms, and facilitates **Data Governance**.

## Glossary in OpenMetadata

OpenMetadata models a Glossary as a Thesauri that organizes terms with **hierarchical**, equivalent, and associative relationships within a domain. The Glossary in OpenMetadata can be accessed from **Govern >>  Glossary**. All the Glossaries are displayed in the left nav bar. Clicking on a specific glossary will display the expanded view to show the entire hierarchy of the glossary terms (parent-child terms).

{% image
src="/images/v1.7/how-to-guides/governance/banking.png"
alt="Banking Glossary"
caption="Banking Glossary"
/%}

{% note %}
**Tip:** A well-defined and centralized glossary makes it easy to **onboard new team members** and help them get familiar with the **organizational terminology**.
{% /note %}

Watch the [Webinar on Glossaries and Classifications in OpenMetadata](https://www.youtube.com/watch?v=LII_5CDo_0s)

{%  youtube videoId="LII_5CDo_0s" start="0:00" end="52:35" width="800px" height="450px" /%}

## Glossary APIs

OpenMetadata has extensive Glossary APIs. The main entities are **Glossary** and **Glossary Term**. These entities are identified by a Unique ID. Glossary terms have a fully qualified name in the form of `glossary.parentTerm.childTerm`

You can create, delete, modify, and update using APIs. Refer to the **[Glossary API documentation](https://sandbox.open-metadata.org/docs#tag/Glossaries)**.

{%inlineCalloutContainer%}
 {%inlineCallout
  color="violet-70"
  bold="Glossary Term"
  icon="MdMenuBook"
  href="/how-to-guides/data-governance/glossary/glossary-term"%}
  Learn about the hierarchically arranged glossary terms.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Setup a Glossary"
  icon="MdMenuBook"
  href="/how-to-guides/data-governance/glossary/setup"%}
  Learn how to set up a glossary manually in OpenMetadata.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Create Glossary Terms"
  icon="MdMenuBook"
  href="/how-to-guides/data-governance/glossary/create-terms"%}
  Setup glossary terms to define the terminology. Add tags, synonyms, related terms, links, etc.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Bulk Import a Glossary"
  icon="MdUpload"
  href="/how-to-guides/data-governance/glossary/import"%}
  Save time and effort by bulk uploading glossary terms using a CSV file.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Glossary Export"
  icon="MdDownload"
  href="/how-to-guides/data-governance/glossary/export"%}
  Quickly export a glossary as a CSV file.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Glossary Approval Workflow"
  icon="MdPushPin"
  href="/how-to-guides/data-governance/glossary/approval"%}
  Set up a review and approval process for glossary terms.
 {%/inlineCallout%}
  {%inlineCallout
  color="violet-70"
  bold="Glossary Styling"
  icon="MdPushPin"
  href="/how-to-guides/data-governance/glossary/styling"%}
  Stylize your glossary terms with color-coding and icons.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Add Assets to Glossary Terms"
  icon="MdPushPin"
  href="/how-to-guides/data-governance/glossary/assets"%}
  Associate glossary terms to data assets making it easier for data discovery
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Best Practices for Glossary"
  icon="MdThumbUp"
  href="/how-to-guides/data-governance/glossary/best-practices"%}
  Here are the Top 8 Best Practices around Terminologies.
 {%/inlineCallout%}
{%/inlineCalloutContainer%}