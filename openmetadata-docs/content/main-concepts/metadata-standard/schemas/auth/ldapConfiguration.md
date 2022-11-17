---
title: ldapConfiguration
slug: /main-concepts/metadata-standard/schemas/auth/ldapconfiguration
---

# LdapConfiguration

*LDAP Configuration*

## Properties

- **`host`** *(string)*: LDAP server address without scheme(Example :- localhost).
- **`port`** *(integer)*: Port of the server.
- **`maxPoolSize`** *(integer)*: No of connection to create the pool with. Default: `3`.
- **`isFullDn`** *(boolean)*: If enable need to give full dn to login. Default: `False`.
- **`dnAdminPrincipal`** *(string)*: Distinguished Admin name with search capabilities.
- **`dnAdminPassword`** *(string)*: Password for LDAP Admin.
- **`sslEnabled`** *(boolean)*: Ldaps or Ldap. Default: `False`.
- **`keyStorePath`** *(string)*: Path of the Keystore for SSL.
- **`keyStorePassword`** *(string)*: Password of the Keystore.
- **`userBaseDN`** *(string)*: Password for LDAP Admin.
- **`mailAttributeName`** *(string)*: Password for LDAP Admin.
- **`truststoreFormat`** *(string)*: Password for LDAP Admin.
- **`verifyCertificateHostname`** *(boolean)*: If true use HostNameSSLVerifier(only ehen trust store as cn as hostname) else TrustAll . Default: `False`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
