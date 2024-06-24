---
title: version Mixin
slug: /sdk/python/api-reference/version-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/version_mixin.py#L0")

# module `version_mixin`
Mixin class containing entity versioning specific methods 

To be used by OpenMetadata 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/version_mixin.py#L32")

## class `OMetaVersionMixin`
OpenMetadata API methods related to entity versioning. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/version_mixin.py#L60")

### method `get_entity_version`

```python
get_entity_version(
    entity: Type[~T],
    entity_id: Union[str, Uuid],
    version: Union[str, float],
    fields: Optional[List[str]] = None
) → Optional[~T]
```

Get an entity at a specific version 

Parameters 
---------- entity: T  the entity type entity_id: Union[str, basic.Uuid]  the ID for a specific entity version: Union[str, float]  the specific version of the entity fields: List  List of fields to return 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/version_mixin.py#L88")

### method `get_list_entity_versions`

```python
get_list_entity_versions(
    entity_id: Union[str, Uuid],
    entity: Type[~T]
) → Union[Response, EntityVersionHistory]
```

Retrieve the list of versions for a specific entity 

Parameters 
---------- entity: T  the entity type entity_id: Union[str, basic.Uuid]  the ID for a specific entity 

Returns 
------- List  lists of available versions for a specific entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/version_mixin.py#L41")

### method `version_to_str`

```python
version_to_str(version: Union[str, float])
```

convert float version to str 

Parameters 
---------- version : Union[str, float]  the version number of the entity 

Returns 
------- str  the string representation of the version 




---


