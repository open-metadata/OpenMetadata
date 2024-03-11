---
title: Client Utils
slug: /sdk/python/api-reference/client-utils
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client_utils.py#L0")

# module `client_utils`
OMeta client create helpers 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client_utils.py#L29")

## function `create_ometa_client`

```python
create_ometa_client(metadata_config: OpenMetadataConnection) → OpenMetadata
```

Create an OpenMetadata client 



**Args:**
 
 - <b>`metadata_config`</b> (OpenMetadataConnection):  OM connection config 



**Returns:**
 
 - <b>`OpenMetadata`</b>:  an OM client 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/client_utils.py#L50")

## function `get_chart_entities_from_id`

```python
get_chart_entities_from_id(
    chart_ids: List[str],
    metadata: OpenMetadata,
    service_name: str
) → List[EntityReference]
```

Method to get the chart entity using get_by_name api 




---


