---
title: How to Add Assets to Glossary Terms
slug: /how-to-guides/openmetadata/data-governance/glossary-classification/assets
---

# How to Add Assets to Glossary Terms

After creating a glossary term, data assets can be associated with the term. In the **Glossary Term > Assets Tab** all the assets associated with the glossary term are displayed. These data assets are further subgrouped as Tables, Topics, Dashboards, etc.

{% image
src="/images/v1.1/how-to-guides/governance/term3.png"
alt="Assets Tab"
caption="Assets Tab"
/%}

You can add more assets by clicking on **Add > Assets**.

{% image
src="/images/v1.1/how-to-guides/governance/asset.png"
alt="Add Asset"
caption="Add Asset"
/%}

You can further search and filter assets by type. Simply select the relevant assets and click **Save**.

{% image
src="/images/v1.1/how-to-guides/governance/asset1.png"
alt="Assets Related to the Glossary Term"
caption="Assets Related to the Glossary Term"
/%}

The glossary term lists the Assets, which makes it easy to discover all the data assets related to the term.

## Glossary Terms and Tags

If **Tags** are associated with a **Glossary Term**, then applying that glossary term to a data asset, will also automatically apply the associated tags to that data asset. For example, the glossary term ‘Account’ has a PII.Sensitive tag associated with it. When you add a glossary term to a data asset, the associated tags also get added.

{% image
src="/images/v1.1/how-to-guides/governance/tag5.png"
alt="Glossary Term and Associated Tags"
caption="Glossary Term and Associated Tags"
/%}

{% image
src="/images/v1.1/how-to-guides/governance/tag6.png"
alt="Glossary Term and Tag gets Added to the Data Asset"
caption="Glossary Term and Tag gets Added to the Data Asset"
/%}

{%inlineCallout
  color="violet-70"
  bold="How to Classify Data Assets"
  icon="MdArrowForward"
  href="/how-to-guides/openmetadata/data-governance/glossary-classification/classify-assets"%}
  Add tags to data assets, or request them and discuss about the same, all within OpenMetadata.
{%/inlineCallout%}