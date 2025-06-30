---
title: What is a Glossary Term
slug: /how-to-guides/data-governance/glossary/glossary-term
---

# What is a Glossary Term

A Glossary Term is a preferred terminology for a concept. In a Glossary term, you can add tags, synonyms, related terms to build a conceptual semantic graph, and also add reference links.

{% note %}
**Tip:** Glossary terms help to organize as well as discover data assets.
{% /note %}

The glossary term can include additional information as follows:
- **Description** - A unique and clear definition to establish consistent usage and understanding of the term. This is a mandatory requirement.

- **Tags** - Classification tags can be added to glossary terms. When adding a glossary term to assets, it will also add the associated tags to that asset. This helps to further describe and categorize the data assets. 

- **Synonyms** - Other terms that are used for the same concept. For e.g., for a term ‘Customer’, the synonyms can be ‘Client’, ‘Shopper’, ‘Purchaser’.

- **Child Terms** - Child terms help to build a conceptual hierarchy (Parent-Child relationship) to go from generic to specific concepts. For e.g., for a term ‘Customer’, the child terms can be ‘Loyal Customer’, ‘New Customer’, ‘Online Customer’.

- **Related Terms** - These terms can build a network of concepts to capture an associative relationship. For e.g., for a term ‘Customer’, the related terms can be ‘Customer LTV (LifeTime Value)’, ‘Customer Acquisition Cost (CAC)’.

- **References** - Add links from the internet from where you inherited the term.

- **Mutually Exclusive** - There are cases where only one term from a particular glossary is relevant for a data asset. For example, an asset can either be ‘PII-Sensitive’ or a ‘PII-NonSensitive’. It cannot be both. For such cases, a Glossary or a Glossary Term can be created where the child terms can be mutually exclusive. If this configuration is enabled, you won’t be able to assign multiple terms from the same Glossary/Term to the same data asset.

- **Reviewers** - A term also has a set of Reviewers who review and accept the changes to the Glossary for Governance. Multiple reviewers can be added. 

- **Assets** - After creating a glossary term, data assets can be associated with the term, which helps in data discovery.

{% image
src="/images/v1.9/how-to-guides/governance/glossary-term.png"
alt="Glossary Term Requirements"
caption="Glossary Term Requirements"
/%}

Each term has a **life cycle status** (e.g., Draft, Approved). Glossary terms can be added manually. You can also [export or bulk import the glossary terms](/how-to-guides/data-governance/glossary/import) using a CSV file.

## Details of a Glossary Term

The details of a Glossary Term in OpenMetadata are displayed in three tabs: Overview, Glossary Terms, and Assets. 

### Overview Tab

The **Overview tab** displays the details of the term, along with the synonyms, related terms, references, and tags. It also displays the Owner and the Reviewers for the Glossary Term.

{% image
src="/images/v1.9/how-to-guides/governance/term1.png"
alt="Overview of a Glossary Term"
caption="Overview of a Glossary Term"
/%}

### Glossary Term Tab

The **Glossary Term Tab** displays all the child terms associated with the parent term. You can also add more child terms from this tab.

{% image
src="/images/v1.9/how-to-guides/governance/term2.png"
alt="Glossary Terms Tab"
caption="Glossary Terms Tab"
/%}

### Assets Tab

The **Assets Tab** displays all the assets that are associated with the glossary term. These data assets are further subgrouped on the basis of databases. The right side panel shows a preview of the data assets selected.

{% image
src="/images/v1.9/how-to-guides/governance/term3.png"
alt="Assets Tab"
caption="Assets Tab"
/%}

You can add more assets by clicking on **Add > Assets**. You can further search and filter assets by type. Simply select the relevant assets and click Save. The glossary term lists the Assets, which makes it easy to discover all the data assets related to the term.

{% note %}
**Pro Tip:** The Global Search in OpenMetadata also helps discover related Glossary Terms and Tags.
{% image
src="/images/v1.9/how-to-guides/governance/tag1.png"
alt="Search for Glossary Terms and Tags"
caption="Search for Glossary Terms and Tags"
/%}
{% /note %}

## Glossary and Glossary Term Version History

The glossary as well as the terms maintain a version history, which can be viewed on the top right. Clicking on the number will display the details of the **Version History**.

{% image
src="/images/v1.9/how-to-guides/governance/version.png"
alt="Glossary Term Version History"
caption="Glossary Term Version History"
/%}

The Backward compatible changes result in a **Minor** version change. A change in the description, tags, or ownership will increase the version of the entity metadata by **0.1** (e.g., from 0.1 to 0.2).

The Backward incompatible changes result in a **Major** version change. For example, when a term is deleted, the version increases by **1.0** (e.g., from 0.2 to 1.2).

{%inlineCallout
  color="violet-70"
  bold="How to Setup a Glossary"
  icon="MdArrowForward"
  href="/how-to-guides/data-governance/glossary/setup"%}
  Learn how to set up a glossary manually in OpenMetadata.
{%/inlineCallout%}