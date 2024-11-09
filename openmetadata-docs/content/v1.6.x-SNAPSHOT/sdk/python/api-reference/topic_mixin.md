---
title: Topic Mixin
slug: /sdk/python/api-reference/topic-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/topic_mixin.py#L0")

# module `topic_mixin`
Mixin class containing Topic specific methods 

To be used by OpenMetadata class 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/topic_mixin.py#L24")

## class `OMetaTopicMixin`
OpenMetadata API methods related to Topics. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/topic_mixin.py#L33")

### method `ingest_topic_sample_data`

```python
ingest_topic_sample_data(
    topic: Topic,
    sample_data: TopicSampleData
) → TopicSampleData
```

PUT sample data for a topic 

:param topic: Topic Entity to update :param sample_data: Data to add 




---


