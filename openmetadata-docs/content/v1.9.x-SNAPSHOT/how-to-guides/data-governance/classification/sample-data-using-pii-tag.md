---
title: Sample Data Handling Using PII Tags
slug: /how-to-guides/data-governance/classification/sample-data-using-pii-tag
---

# Sample Data Handling Using PII Tags

In OpenMetadata, sensitive information is protected through **automatic masking** of sample data when PII (Personally Identifiable Information) tags are applied.

## How It Works

- If a **PII tag** is applied to a **specific column**:
  - Only that column’s sample data will be **masked** and displayed as `******` in the UI.

{% image
src="/images/v1.9/how-to-guides/governance/pii-tags.png"
alt="PII Tag Application at Column Level"
caption="PII Tag Application at Column Level"
/%}

- If a **PII tag** is applied at the **table level**:
  - **All columns** within that table will have their sample data masked automatically.

{% image
src="/images/v1.9/how-to-guides/governance/pii-tags2.png"
alt="PII Tag Application at Table Level"
caption="PII Tag Application at Table Level"
/%}

This behavior ensures that sensitive data is not exposed through sample data views in OpenMetadata.

## Example

| Column Name | Tag             | Sample Data Displayed |
|-------------|------------------|------------------------|
| email       | PII.Sensitive    | ******                 |
| phoneNumber | PII.Sensitive    | ******                 |
| age         | (None)           | 25                     |

When the tag is applied at the **table level**, the result would be:

| Column Name | Tag                   | Sample Data Displayed |
|-------------|------------------------|------------------------|
| email       | Inherited from Table   | ******                 |
| phoneNumber | Inherited from Table   | ******                 |
| age         | Inherited from Table   | ******                 |

## How to Apply PII Tags

1. Navigate to the **column** or **table** in the OpenMetadata UI.
2. Apply the **PII.Sensitive** tag via the tagging options.

{% image
src="/images/v1.9/how-to-guides/governance/pii-tags1.png"
alt="PII.Sensitive Tagging"
caption="PII.Sensitive Tagging"
/%}

3. Ensure auto-classification or manual tagging captures the correct columns during ingestion.
