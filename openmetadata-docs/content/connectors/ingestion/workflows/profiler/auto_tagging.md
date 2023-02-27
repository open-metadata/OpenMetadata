---
title: Lineage Ingestion
slug: /connectors/ingestion/auto_tagging
---

## Auto PII Tagging
Here, we are tagging PII Sensitive/NonSensitive tag to column based on the following ways

### During Metadata Ingestion
- During metadata ingestion, we use the column name to determine the PII tag.
- We pass the column name through regex, which gives the `PII` Sensitive/NonSensitive tag.

### During Profiler Ingestion
- During profiler ingestion, we profiler through the sample data.
- This sample data is passed through a [spacy](https://spacy.io/) library, wich give spacy entity name, which is used to determine PII Sensitive/NonSensitive Tag.


#### Case: Profiler Ingestion 
Here, if `Auto PII Tagging` is enabled during Metadata Ingestion, we skip the `Auto PII Tag` in Profiler Ingestion even if enabled.

#### Case: Column PII Tag
If `PII Tag` is already attached to column, we will skip that column.
