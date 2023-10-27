---
title: ldapConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/ldapconfiguration
---

# LdapConfiguration

*LDAP Configuration*

## Properties

- **`host`** *(string)*: LDAP server address without scheme(Example :- localhost).
- **`port`** *(integer)*: Port of the server.
- **`maxPoolSize`** *(integer)*: No of connection to create the pool with. Default: `3`.
- **`isFullDn`** *(boolean)*: If enable need to give full dn to login. Default: `false`.
- **`dnAdminPrincipal`** *(string)*: Distinguished Admin name with search capabilities.
- **`dnAdminPassword`** *(string)*: Password for LDAP Admin.
- **`sslEnabled`** *(boolean)*: LDAPS (secure LDAP) or LDAP. Default: `false`.
- **`userBaseDN`** *(string)*: User base distinguished name.
- **`mailAttributeName`** *(string)*: Email attribute name.
- **`truststoreFormat`** *(string)*: Truststore format e.g. PKCS12, JKS.
- **`truststoreConfigType`** *(string)*: Truststore Type e.g. TrustAll, HostName, JVMDefault, CustomTrustStore. Must be one of: `["TrustAll", "JVMDefault", "HostName", "CustomTrustStore"]`.
- **`trustStoreConfig`**: Truststore Configuration. Refer to *[ldapTrustStoreConfig/truststoreConfig.json](#apTrustStoreConfig/truststoreConfig.json)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
