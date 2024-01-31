---
title: Aut Provider
slug: /sdk/python/api-reference/auth-provider
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L0)

# module `auth_provider`
Interface definition for an Auth provider 

**Global Variables**
---------------
- **ACCESS_TOKEN**
- **EXPIRY**


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L60")

## class `AuthenticationException`
Error trying to get the token from the provider 





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L66")

## class `AuthenticationProvider`
Interface definition for an Authentication provider 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L84")

### method `auth_token`

```python
auth_token() → str
```

Authentication token 



**Returns:**
  str 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L72")

### classmethod `create`

```python
create(config: ConfigModel) → AuthenticationProvider
```

Create authentication 



**Arguments:**
 
 - <b>`config`</b> (ConfigModel):  configuration 

**Returns:**
 AuthenticationProvider 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L93")

### method `get_access_token`

```python
get_access_token()
```

Authentication token 



**Returns:**
  str 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L103")

## class `NoOpAuthenticationProvider`
Extends AuthenticationProvider class 



**Args:**
  config (MetadataServerConfig): 



**Attributes:**
  config (MetadataServerConfig) 

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L114")

### method `__init__`

```python
__init__(config: OpenMetadataConnection)
```








---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L121")

### method `auth_token`

```python
auth_token()
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L117")

### classmethod `create`

```python
create(config: OpenMetadataConnection)
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L124")

### method `get_access_token`

```python
get_access_token()
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L128")

## class `GoogleAuthenticationProvider`
Google authentication implementation 



**Args:**
  config (MetadataServerConfig): 



**Attributes:**
  config (MetadataServerConfig) 

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L139")

### method `__init__`

```python
__init__(config: OpenMetadataConnection)
```








---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L150")

### method `auth_token`

```python
auth_token() → None
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L146")

### classmethod `create`

```python
create(config: OpenMetadataConnection)
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L164")

### method `get_access_token`

```python
get_access_token()
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L169")

## class `OktaAuthenticationProvider`
Prepare the Json Web Token for Okta auth 

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L174")

### method `__init__`

```python
__init__(config: OpenMetadataConnection)
```








---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L185")

### method `auth_token`

```python
auth_token() → None
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L181")

### classmethod `create`

```python
create(config: OpenMetadataConnection)
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L272")

### method `get_access_token`

```python
get_access_token()
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L279")

## class `Auth0AuthenticationProvider`
OAuth authentication implementation 

**Args:**
  config (MetadataServerConfig): 

**Attributes:**
  config (MetadataServerConfig) 

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L288")

### method `__init__`

```python
__init__(config: OpenMetadataConnection)
```








---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L299")

### method `auth_token`

```python
auth_token() → None
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L295")

### classmethod `create`

```python
create(config: OpenMetadataConnection)
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L323")

### method `get_access_token`

```python
get_access_token()
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L328")

## class `AzureAuthenticationProvider`
Prepare the Json Web Token for Azure auth 

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L334")

### method `__init__`

```python
__init__(config: OpenMetadataConnection)
```








---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L344")

### method `auth_token`

```python
auth_token() → None
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L340")

### classmethod `create`

```python
create(config: OpenMetadataConnection)
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L361")

### method `get_access_token`

```python
get_access_token()
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L366")

## class `CustomOIDCAuthenticationProvider`
Custom OIDC authentication implementation 



**Args:**
  config (MetadataServerConfig): 



**Attributes:**
  config (MetadataServerConfig) 

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L377")

### method `__init__`

```python
__init__(config: OpenMetadataConnection) → None
```








---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L390")

### method `auth_token`

```python
auth_token() → None
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L384")

### classmethod `create`

```python
create(config: OpenMetadataConnection) → CustomOIDCAuthenticationProvider
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L417")

### method `get_access_token`

```python
get_access_token() → Tuple[str, int]
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L422")

## class `OpenMetadataAuthenticationProvider`
OpenMetadata authentication implementation 



**Args:**
  config (MetadataServerConfig): 



**Attributes:**
  config (MetadataServerConfig) 

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L433")

### method `__init__`

```python
__init__(config: OpenMetadataConnection)
```








---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L443")

### method `auth_token`

```python
auth_token() → None
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L439")

### classmethod `create`

```python
create(config: OpenMetadataConnection)
```





---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/auth_provider.py#L455")

### method `get_access_token`

```python
get_access_token()
```
