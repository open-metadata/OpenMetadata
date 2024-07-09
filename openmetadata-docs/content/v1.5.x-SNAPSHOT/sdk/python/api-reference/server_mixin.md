---
title: Server Mixin
slug: /sdk/python/api-reference/server-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/server_mixin.py#L0")

# module `server_mixin`
Mixin class containing Server and client specific methods 

To be used by OpenMetadata class 



---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/server_mixin.py#L23")

## class `VersionMismatchException`
Used when server and client versions do not match 





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/server_mixin.py#L29")

## class `VersionNotFoundException`
Used when server doesn't return a version 





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/server_mixin.py#L35")

## class `OMetaServerMixin`
OpenMetadata API methods related to the Pipeline Entity 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/server_mixin.py#L44")

### method `get_server_version`

```python
get_server_version() → str
```

Run endpoint /system/version to check server version :return: Server version 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/server_mixin.py#L58")

### method `validate_versions`

```python
validate_versions() → None
```

Validate Server & Client versions. They should match. Otherwise, raise VersionMismatchException 




---


