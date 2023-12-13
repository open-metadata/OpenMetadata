---
title: Provider Registry
slug: /sdk/python/api-reference/provider-registry
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L0")

# module `provider_registry`
Register auth provider init functions here 

**Global Variables**
---------------
- **PROVIDER_CLASS_MAP**

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L52")

## function `warn_auth_deprecation`

```python
warn_auth_deprecation(auth_provider: AuthProvider) → None
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L61")

## function `warn_not_supported`

```python
warn_not_supported() → None
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L75")

## function `no_auth_init`

```python
no_auth_init(config: OpenMetadataConnection) → AuthenticationProvider
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L80")

## function `basic_auth_init`

```python
basic_auth_init(config: OpenMetadataConnection) → AuthenticationProvider
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L87")

## function `saml_auth_init`

```python
saml_auth_init(config: OpenMetadataConnection) → AuthenticationProvider
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L94")

## function `ldap_auth_init`

```python
ldap_auth_init(config: OpenMetadataConnection) → AuthenticationProvider
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L101")

## function `google_auth_init`

```python
google_auth_init(config: OpenMetadataConnection) → AuthenticationProvider
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L107")

## function `okta_auth_init`

```python
okta_auth_init(config: OpenMetadataConnection) → AuthenticationProvider
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L113")

## function `auth0_auth_init`

```python
auth0_auth_init(config: OpenMetadataConnection) → AuthenticationProvider
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L119")

## function `azure_auth_init`

```python
azure_auth_init(config: OpenMetadataConnection) → AuthenticationProvider
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L125")

## function `custom_oidc_auth_init`

```python
custom_oidc_auth_init(config: OpenMetadataConnection) → AuthenticationProvider
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L131")

## function `om_auth_init`

```python
om_auth_init(config: OpenMetadataConnection) → AuthenticationProvider
```






---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/provider_registry.py#L65")

## class `InvalidAuthProviderException`
Raised when we cannot find a valid auth provider in the registry 







---


