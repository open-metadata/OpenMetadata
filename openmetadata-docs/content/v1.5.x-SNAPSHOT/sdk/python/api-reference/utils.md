---
title: Utils
slug: /sdk/python/api-reference/utils
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/utils.py#L0")

# module `utils`
Helper functions to handle OpenMetadata Entities' properties 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/utils.py#L24")

## function `format_name`

```python
format_name(name: str) → str
```

Given a name, replace all special characters by `_` :param name: name to format :return: formatted string 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/utils.py#L35")

## function `get_entity_type`

```python
get_entity_type(entity: Union[Type[~T], str]) → str
```

Given an Entity T, return its type. E.g., Table returns table, Dashboard returns dashboard... 

Also allow to be the identity if we just receive a string 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/utils.py#L64")

## function `model_str`

```python
model_str(arg: Any) → str
```

Default model stringifying method. 

Some elements such as FQN, EntityName, UUID have the actual value under the pydantic base __root__ 




---


