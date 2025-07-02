---
title: Search Index Mixin
slug: /sdk/python/api-reference/search-index-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/search_index_mixin.py#L0")

# module `search_index_mixin`
Mixin class containing Search Index specific methods 

To be used by OpenMetadata class 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/search_index_mixin.py#L29")

## class `OMetaSearchIndexMixin`
OpenMetadata API methods related to search index. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/search_index_mixin.py#L38")

### method `ingest_search_index_sample_data`

```python
ingest_search_index_sample_data(
    search_index: SearchIndex,
    sample_data: SearchIndexSampleData
) → Optional[SearchIndexSampleData]
```

PUT sample data for a search index 

:param search_index: SearchIndex Entity to update :param sample_data: Data to add 




---


