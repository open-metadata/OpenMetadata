---
title: Ometa API
slug: /sdk/python/api-reference/ometa-api
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L0")

# module `ometa_api`
OpenMetadata is the high level Python API that serves as a wrapper for the metadata-server API. It is based on the generated pydantic models from the JSON schemas and provides a typed approach to working with OpenMetadata entities. 

**Global Variables**
---------------
- **ROUTES**


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L73")

## class `MissingEntityTypeException`
We are receiving an Entity Type[T] not covered in our suffix generation list 





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L80")

## class `InvalidEntityException`
We receive an entity not supported in an operation 





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L86")

## class `EmptyPayloadException`
Raise when receiving no data, even if no exception during the API call is received 





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L93")

## class `OpenMetadata`
Generic interface to the OpenMetadata API 

It is a polymorphism on all our different Entities. 

Specific functionalities to be inherited from Mixins 

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L130")

### method `__init__`

```python
__init__(config: OpenMetadataConnection, raw_data: bool = False)
```








---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L523")

### method `close`

```python
close()
```

Closing connection 

Returns  None 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L508")

### method `compute_percentile`

```python
compute_percentile(entity: Union[Type[~T], str], date: str) → None
```

Compute an entity usage percentile 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L258")

### method `create_or_update`

```python
create_or_update(data: ~C) → ~T
```

We allow CreateEntity for PUT, so we expect a type C. 

We PUT to the endpoint and return the Entity generated result 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L487")

### method `delete`

```python
delete(
    entity: Type[~T],
    entity_id: Union[str, Uuid],
    recursive: bool = False,
    hard_delete: bool = False
) → None
```

API call to delete an entity from entity ID 

Args  entity (T): entity Type  entity_id (basic.Uuid): entity ID Returns  None 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L301")

### method `get_by_id`

```python
get_by_id(
    entity: Type[~T],
    entity_id: Union[str, Uuid],
    fields: Optional[List[str]] = None,
    nullable: bool = True
) → Optional[~T]
```

Return entity by ID or None 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L283")

### method `get_by_name`

```python
get_by_name(
    entity: Type[~T],
    fqn: Union[str, FullyQualifiedEntityName],
    fields: Optional[List[str]] = None,
    nullable: bool = True
) → Optional[~T]
```

Return entity by name or None 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L193")

### method `get_create_entity_type`

```python
get_create_entity_type(entity: Type[~T]) → Type[~C]
```

imports and returns the Create Type from an Entity Type T. We are following the expected path structure to import on-the-fly the necessary class and pass it to the consumer 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L224")

### method `get_entity_from_create`

```python
get_entity_from_create(create: Type[~C]) → Type[~T]
```

Inversely, import the Entity type based on the create Entity class 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L356")

### method `get_entity_reference`

```python
get_entity_reference(entity: Type[~T], fqn: str) → Optional[EntityReference]
```

Helper method to obtain an EntityReference from a FQN and the Entity class. :param entity: Entity Class :param fqn: Entity instance FQN :return: EntityReference or None 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L184")

### method `get_module_path`

```python
get_module_path(entity: Type[~T]) → str
```

Based on the entity, return the module path it is found inside generated 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L169")

### method `get_suffix`

```python
get_suffix(entity: Type[~T]) → str
```

Given an entity Type from the generated sources, return the endpoint to run requests. 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L516")

### method `health_check`

```python
health_check() → bool
```

Run version api call. Return `true` if response is not None 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L418")

### method `list_all_entities`

```python
list_all_entities(
    entity: Type[~T],
    fields: Optional[List[str]] = None,
    limit: int = 1000,
    params: Optional[Dict[str, str]] = None,
    skip_on_failure: bool = False
) → Iterable[~T]
```

Utility method that paginates over all EntityLists to return a generator to fetch entities :param entity: Entity Type, such as Table :param fields: Extra fields to return :param limit: Number of entities in each pagination :param params: Extra parameters, e.g., {"service": "serviceName"} to filter :return: Generator that will be yielding all Entities 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L379")

### method `list_entities`

```python
list_entities(
    entity: Type[~T],
    fields: Optional[List[str]] = None,
    after: Optional[str] = None,
    limit: int = 100,
    params: Optional[Dict[str, str]] = None,
    skip_on_failure: bool = False
) → EntityList[~T]
```

Helps us paginate over the collection 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L476")

### method `list_services`

```python
list_services(entity: Type[~T]) → List[EntityList[~T]]
```

Service listing does not implement paging 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L461")

### method `list_versions`

```python
list_versions(
    entity_id: Union[str, Uuid],
    entity: Type[~T]
) → EntityVersionHistory
```

Version history of an entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/ometa_api.py#L211")

### method `update_file_name`

```python
update_file_name(create: Type[~C], file_name: str) → str
```

Update the filename for services and schemas 




---


