---
title: Lineage Ingestion
slug: /connectors/ingestion/auto_tagging
---

## Auto PII Tagging
Here, we are tagging PII Sensitive/NonSensitive tag to column based on the following ways.

PII Tagging is only available during `Profiler Ingestion`.


### During Profiler Ingestion
- During profiler ingestion, we profile sample data.
- First we pass the column name through a regex, which identify credit card,email , etc.
- If it is not parse through regex, we use [presidio](https://microsoft.github.io/presidio/) library, which give spacy entity name and score, which is used to determine PII Sensitive/NonSensitive Tag.
- `confidence` parameter is passed determine minimun score required to tag the column.

