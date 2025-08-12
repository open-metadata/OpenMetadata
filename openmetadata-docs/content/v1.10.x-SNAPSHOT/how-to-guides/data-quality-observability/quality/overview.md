---
title: Data Quality Overview Section
slug: /how-to-guides/data-quality-observability/quality/overview
collate: true
---

# Data Quality Overview Section
The SaaS version of Collate offers an overview of the data quality test results grouped by dimensions. This gives users a quick insight about data quality performance centered around meaningful categories.

The 6 categories are defined as:
- **Completeness**: contains test cases allowing user to validate if any values are missing from a column/table (e.g. Column Values To Be Not Null)
- **Accuracy**: contains test cases allowing user to validate if any values represent their expected values in the real world (e.g. Column Value Max To Be Between)
- **Consistency**: contains test cases allowing user to validate the information stored between data processing is consistent with the expectations (e.g. Table Data Diff)
- **Validity**: contains test cases allowing user to control the data represent the specifications/expectations of the domain (e.g. Column Values To Not Match Regex)
- **Uniqueness**: contains test cases allowing user to control for potential duplicates in the data (e.g. Column Values To Be Unique)
- **Integrity**: contains test cases allowing user to validate the integrity of entity attributes (e.g. Table Column Count To Be Between)

For a full list of test cases and their dimensions click [here](/how-to-guides/data-quality-observability/quality/tests-yaml)

{% image
src="/images/v1.10/features/ingestion/workflows/data-quality/data-quality-dimensions.png"
alt="Data Quality Overview"
caption="Data Quality Overview"
/%}