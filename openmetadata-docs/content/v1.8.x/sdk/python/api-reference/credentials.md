---
title: Credentials
slug: /sdk/python/api-reference/credentials
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/credentials.py#L0")

# module `credentials`
Helper methods to handle creds retrieval for the OpenMetadata Python API 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/credentials.py#L99")

## function `get_credentials`

```python
get_credentials(
    key_id: str = None,
    secret_key: str = None,
    oauth: str = None
) → Tuple[str, str, str]
```

Get credentials 



**Args:**
  key_id (str):  secret_key (str):  oauth (oauth): 

**Returns:**
  Credentials 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/credentials.py#L131")

## function `get_api_version`

```python
get_api_version(api_version: str) → str
```

Get version API 



**Args:**
  api_version (str): 

**Returns:**
  str 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/credentials.py#L28")

## class `URL`
Handle URL for creds retrieval 



**Args:**
  value (tuple): 



**Attributes:**
  value (value): 





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/credentials.py#L60")

## class `DATE`
date string in the format YYYY-MM-DD 





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/credentials.py#L83")

## class `FLOAT`
api allows passing floats or float as strings. let's make sure that param passed is one of the two, so we don't pass invalid strings all the way to the servers. 







---


