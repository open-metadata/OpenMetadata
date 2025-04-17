---
title: How to Setup a Glossary
slug: /how-to-guides/data-governance/glossary/setup
---

# How to Setup a Glossary

To create a glossary manually in OpenMetadata:
- Navigate to **Govern > Glossary**
- Click on **+ Add** to add a new glossary

{% image
src="/images/v1.7/how-to-guides/governance/glossary1.png"
alt="Add a New Glossary"
caption="Add a New Glossary"
/%}

- Enter the details to configure the glossary.
  - **Name*** - This is a required field.

  - **Display Name**

  - **Description*** - Describe the context or domain of the glossary. This is a required field.

  - **Tags** - Classification tags can be added to a glossary. 

  - **Mutually Exclusive** - There are cases where only one term from a particular glossary is relevant for a data asset. For example, an asset can either be ‘PII-Sensitive’ or a ‘PII-NonSensitive’. It cannot be both. For such cases, a Glossary can be created where the glossary terms can be mutually exclusive. If this configuration is enabled, you won’t be able to assign multiple terms from the same Glossary to the same data asset.

  - **Owner** - Either a Team or a  User can be the Owner of a Glossary.

  - **Reviewers**  - Multiple reviewers can be added.

{% image
src="/images/v1.7/how-to-guides/governance/glossary2.png"
alt="Configure the Glossary"
caption="Configure the Glossary"
/%}

## Add a Owner and Reviewers to a Glossary

When creating a glossary, you can add the glossary owner. Either a Team or a User can be a Owner of the Glossary. Simply click on the option for **Owner** to select the user or team.

Multiple users can be added as Reviewers by clicking on the pencil icon. If the **Reviewer** details exist for a glossary, then the same details are reflected when adding a new term manually as well.

{% image
src="/images/v1.7/how-to-guides/governance/owner.png"
alt="Add Owner and Reviewers"
caption="Add Owner and Reviewers"
/%}

If the Owner and Reviewer details are added while creating the glossary, and the glossary terms are **[bulk uploaded using a CSV file](/how-to-guides/data-governance/glossary/import)**, then the glossary Owner and Reviewers are inherited for all the glossary terms. These details can be changed later.

{%inlineCallout
  color="violet-70"
  bold="How to Create Glossary Terms"
  icon="MdArrowForward"
  href="/how-to-guides/data-governance/glossary/create-terms"%}
  Setup Glossary Terms to define the terminology. Add tags, synonyms, related terms, links, etc.
{%/inlineCallout%}

{%inlineCallout
  color="violet-70"
  bold="How to Bulk Import a Glossary"
  icon="MdArrowForward"
  href="/how-to-guides/data-governance/glossary/import"%}
  Save time and effort by bulk uploading glossary terms using a CSV file.
{%/inlineCallout%}

{%inlineCallout
  color="violet-70"
  bold="How to Add Assets to Glossary Terms"
  icon="MdArrowForward"
  href="/how-to-guides/data-governance/glossary/assets"%}
  Associate glossary terms to data assets making it easier for data discovery
{%/inlineCallout%}