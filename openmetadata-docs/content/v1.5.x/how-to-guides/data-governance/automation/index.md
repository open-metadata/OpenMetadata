---
title: Collate Automations Documentation
slug: /how-to-guides/data-governance/automation
collate: true
---

# Collate Automations

{%  youtube videoId="ug08aLUyTyE" start="0:00" end="14:52” width="560px" height="315px" /%}

## Overview

Collate's **Automation** feature is a powerful tool designed to simplify and streamline metadata management tasks. By automating repetitive actions such as assigning owners, domains, or tagging data, Collate helps maintain consistency in metadata across an organization's datasets. These automations reduce manual effort and ensure that metadata is always up-to-date, accurate, and governed according to predefined policies.

## Why Automations are Useful

Managing metadata manually can be challenging, particularly in dynamic environments where data constantly evolves. Collate's Automation feature addresses several key pain points:

- **Maintaining Consistency**: Automation helps ensure that metadata such as ownership, tags, and descriptions are applied consistently across all data assets.
- **Saving Time**: Automations allow data teams to focus on higher-value tasks by eliminating the need for manual updates and maintenance.
- **Enforcing Governance Policies**: Automations help ensure that data follows organizational policies at all times by automatically applying governance rules (e.g., assigning data owners or domains).
- **Data Quality and Accountability**: Data quality suffers without clear ownership. Automating ownership assignments helps ensure that data quality issues are addressed efficiently.

## Key Use Cases for Collate Automations

### 1. Bulk Ownership and Domain Assignment

{% image
src="/images/v1.5/how-to-guides/governance/bulk-ownership-and.png"
alt="Getting started with Automation"
caption="Getting started with Automation"
/%}

- **Problem**: Many data assets lack proper ownership and domain assignment, leading to governance and accountability issues. Manually assigning owners can be error-prone and time-consuming.
- **Solution**: Automations can bulk-assign ownership and domains to datasets, ensuring all data assets are correctly categorized and owned. This process can be applied to tables, schemas, or other assets within Collate.
- **Benefit**: This use case ensures data assets have a designated owner and are organized under the appropriate domain, making data more discoverable and accountable.

### 2. Bulk Tagging and Glossary Term Assignment

{% image
src="/images/v1.5/how-to-guides/governance/bulk-tagging-glossary.png"
alt="Getting started with Automation"
caption="Getting started with Automation"
/%}

- **Problem**: Manually applying the same tags or glossary terms to multiple datasets can be inefficient and inconsistent.
- **Solution**: Automations allow users to bulk-apply tags (e.g., PII) or glossary terms (e.g., Customer ID) to specific datasets, ensuring uniformity across the platform.
- **Benefit**: This automation reduces the risk of missing important tags like PII-sensitive and ensures that key metadata elements are applied consistently across datasets.

### 3. Metadata Propagation via Lineage

{% image
src="/images/v1.5/how-to-guides/governance/metadata-propogation.png"
alt="Getting started with Automation"
caption="Getting started with Automation"
/%}

- **Problem**: When metadata such as tags, descriptions, or glossary terms are updated in one part of the data lineage, they may not be propagated across related datasets, leading to inconsistencies.
- **Solution**: Use automations to propagate metadata across related datasets, ensuring that all relevant data inherits the correct metadata properties from the source dataset.
- **Benefit**: Metadata consistency is ensured across the entire data lineage, reducing the need for manual updates and maintaining a single source of truth.

### 4. Automatic PII Detection and Tagging

{% image
src="/images/v1.5/how-to-guides/governance/automatic-detection.png"
alt="Getting started with Automation"
caption="Getting started with Automation"
/%}

- **Problem**: Manually identifying and tagging Personally Identifiable Information (PII) across large datasets is labor-intensive and prone to errors.
- **Solution**: Automations can automatically detect PII data (e.g., emails, usernames) and apply relevant tags to ensure that sensitive data is flagged appropriately for compliance.
- **Benefit**: Ensures compliance with data protection regulations by consistently tagging sensitive data, reducing the risk of non-compliance.

## Best Practices

- **Validate Assets Before Applying Actions**: Always use the **Explore** page to verify the assets that will be affected by the automation. This ensures that only the intended datasets are updated.
- **Use Automation Logs**: Regularly check the **Recent Runs** logs to monitor automation activity and ensure that they are running as expected.
- **Propagate Metadata Thoughtfully**: When propagating metadata via lineage, make sure that the source metadata is correct before applying it across multiple datasets.
