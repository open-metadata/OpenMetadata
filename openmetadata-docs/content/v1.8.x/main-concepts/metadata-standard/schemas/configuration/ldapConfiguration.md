---
title: LDAP Configuration | OpenMetadata LDAP Config
description: Connect Ldapconfiguration to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
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
- **`groupBaseDN`** *(string)*: Group base distinguished name.
- **`roleAdminName`** *(string)*: Admin role name.
- **`allAttributeName`** *(string)*: All attribute name.
- **`mailAttributeName`** *(string)*: Email attribute name.
- **`usernameAttributeName`** *(string)*: User Name attribute name.
- **`groupAttributeName`** *(string)*: Group Name attribute name.
- **`groupAttributeValue`** *(string)*: Group attribute value.
- **`groupMemberAttributeName`** *(string)*: Group Member Name attribute name.
- **`authRolesMapping`** *(string)*: Json string of roles mapping between LDAP roles and Ranger roles.
- **`authReassignRoles`** *(array)*: Roles should be reassign every time user login.
  - **Items** *(string)*
- **`truststoreFormat`** *(string)*: Truststore format e.g. PKCS12, JKS.
- **`truststoreConfigType`** *(string)*: Truststore Type e.g. TrustAll, HostName, JVMDefault, CustomTrustStore. Must be one of: `["TrustAll", "JVMDefault", "HostName", "CustomTrustStore"]`.
- **`trustStoreConfig`**: Truststore Configuration. Refer to *[ldapTrustStoreConfig/truststoreConfig.json](#apTrustStoreConfig/truststoreConfig.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
