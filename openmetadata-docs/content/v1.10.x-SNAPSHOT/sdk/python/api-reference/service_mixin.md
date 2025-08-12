---
title: Service Mixin
slug: /sdk/python/api-reference/service-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/service_mixin.py#L0")

# module `service_mixin`
Helper mixin to handle services 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/service_mixin.py#L33")

## class `OMetaServiceMixin`
OpenMetadata API methods related to service. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/service_mixin.py#L64")

### method `create_service_from_source`

```python
create_service_from_source(entity: Type[~T], config: Source) → ~T
```

Create a service of type T. 

We need to extract from the WorkflowSource: 
- name: serviceName 
- serviceType: Type Enum 
- connection: (DatabaseConnection, DashboardConnection...) 

:param entity: Service Type :param config: WorkflowSource :return: Created Service 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/service_mixin.py#L42")

### method `get_create_service_from_source`

```python
get_create_service_from_source(entity: Type[~T], config: Source) → ~C
```

Prepare a CreateService request from source config :param entity: Service Type :param config: WorkflowSource :return: CreateService request 

If the OpenMetadata Connection has storeServiceConnection set to false, we won't pass the connection details when creating the service. 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/service_mixin.py#L83")

### method `get_service_or_create`

```python
get_service_or_create(entity: Type[~T], config: Source) → ~T
```

Fetches a service by name, or creates it using the WorkflowSource config :param entity: Entity Type to get or create :param config: WorkflowSource :return: Entity Service of T 




---


