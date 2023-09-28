---
title: What is a Glossary
slug: /how-to-guides/openmetadata/data-governance/glossary-classification/glossary
---

# What is a Glossary

A Glossary is a Controlled Vocabulary to describe important concepts and terminologies within your organization to foster a common and consistent understanding of data. It defines concepts related to a specific domain. For example, Business Glossary or Bank Glossary. A well-defined business glossary helps foster team collaboration with the use of standard terms. Glossaries are important for data discovery, retrieval, and exploration through conceptual terms, and facilitates **Data Governance**.

Glossary adds semantics or meaning to data. OpenMetadata models a Glossary as a Thesauri that organizes terms with **hierarchical**, equivalent, and associative relationships within a domain.

The Glossary in OpenMetadata can be accessed from **Govern >>  Glossary**. All the Glossaries are displayed in the left nav bar. Clicking on a specific glossary will display the expanded view to show the entire hierarchy of the glossary terms (parent-child terms).

{% image
src="/images/v1.1/how-to-guides/governance/banking.png"
alt="Banking Glossary"
caption="Banking Glossary"
/%}

{% note %}
**Tip:** A well-defined and centralized glossary makes it easy to **onboard new team members** and help them get familiar with the **organizational terminology**.
{% /note %}

## Glossary Term

A Glossary Term is a preferred terminology for a concept. In a Glossary term, you can add tags, synonyms, related terms to build a conceptual semantic graph, and also add reference links.

The glossary term can include additional information as follows:
- **Description** - A unique and clear definition to establish consistent usage and understanding of the term. This is a mandatory requirement.

- **Tags** - Classification tags can be added to glossary terms. When adding a glossary term to assets, it will also add the associated tags to that asset. This helps to further describe and categorize the data assets. 

- **Synonyms** - Other terms that are used for the same concept. For e.g., for a term ‘Customer’, the synonyms can be ‘Client’, ‘Shopper’, ‘Purchaser’.

- **Child Terms** - Child terms help to build a conceptual hierarchy (Parent-Child relationship) to go from generic to specific concepts. For e.g., for a term ‘Customer’, the child terms can be ‘Loyal Customer’, ‘New Customer’, ‘Online Customer’.

- **Related Terms** - These terms can build a network of concepts to capture an associative relationship. For e.g., for a term ‘Customer’, the related terms can be ‘Customer LTV (LifeTime Value)’, ‘Customer Acquisition Cost (CAC)’.

- **References** - Add links from the internet from where you inherited the term.

- **Mutually Exclusive** - There are cases where only one term from a particular glossary is relevant for a data asset. For example, an asset can either be ‘PII-Sensitive’ or a ‘PII-NonSensitive’. It cannot be both. For such cases, a Glossary or a Glossary Term can be created where the child terms can be mutually exclusive. If this configuration is enabled, you won’t be able to assign multiple terms from the same Glossary/Term to the same data asset.

- **Reviewers** - Multiple reviewers can be added. 

- **Assets** - After creating a glossary term, data assets can be associated with the term.

{% image
src="/images/v1.1/how-to-guides/governance/glossary-term.png"
alt="Glossary Term Requirements"
caption="Glossary Term Requirements"
/%}

The details of a Glossary Term in OpenMetadata are displayed in three tabs: Overview, Glossary Terms, and Assets. The **Overview tab** displays the details of the term, along with the synonyms, related terms, references, and tags. It also displays the Owner and the Reviewers for the Glossary Term.

{% image
src="/images/v1.1/how-to-guides/governance/term1.png"
alt="Overview of a Glossary Term"
caption="Overview of a Glossary Term"
/%}

The **Glossary Term Tab** displays all the child terms associated with the parent term. You can also add more child terms from this tab.

{% image
src="/images/v1.1/how-to-guides/governance/term2.png"
alt="Glossary Terms Tab"
caption="Glossary Terms Tab"
/%}

{% note %}
**Tip:** Glossary terms help to organize as well as discover data assets.
{% /note %}

The **Assets Tab** displays all the assets that are associated with the glossary term. These data assets are further subgrouped as Tables, Topics, Dashboards. The right side panel shows a preview of the data assets selected.

{% image
src="/images/v1.1/how-to-guides/governance/term3.png"
alt="Assets Tab"
caption="Assets Tab"
/%}

You can add more assets by clicking on **Add > Assets**. You can further search and filter assets by type. Simply select the relevant assets and click Save. The glossary term lists the Assets, which makes it easy to discover all the data assets related to the term.

{% note %}
**Pro Tip:** The Global Search in OpenMetadata also helps discover related Glossary Terms and Tags.
{% image
src="/images/v1.1/how-to-guides/governance/tag1.png"
alt="Search for Glossary Terms and Tags"
caption="Search for Glossary Terms and Tags"
/%}
{% /note %}

## Glossary and Glossary Term Version History

The glossary as well as the terms maintain a version history, which can be viewed on the top right. Clicking on the number will display the details of the **Version History**.

{% image
src="/images/v1.1/how-to-guides/governance/version.png"
alt="Glossary Term Version History"
caption="Glossary Term Version History"
/%}

The Backward compatible changes result in a **Minor** version change. A change in the description, tags, or ownership will increase the version of the entity metadata by **0.1** (e.g., from 0.1 to 0.2).

The Backward incompatible changes result in a **Major** version change. For example, when a term is deleted, the version increases by **1.0** (e.g., from 0.2 to 1.2).

## Glossary APIs

OpenMetadata has extensive Glossary APIs. The main entities are **Glossary** and **Glossary Term**. These entities are identified by a Unique ID. Glossary terms have a fully qualified name in the form of `glossary.parentTerm.childTerm`

You can create, delete, modify, and update using APIs. Refer to the **[Glossary API documentation](https://sandbox.open-metadata.org/docs#tag/Glossaries)**.

You can also [export or bulk import the glossary terms](/how-to-guides/openmetadata/data-governance/glossary-classification/import-glossary) using a CSV file.

{%inlineCallout
  color="violet-70"
  bold="What is Classification"
  icon="MdArrowForward"
  href="/how-to-guides/openmetadata/data-governance/glossary-classification/classification"%}
  Learn about the classification tags, system tags, and mutually exclusive tags.
{%/inlineCallout%}