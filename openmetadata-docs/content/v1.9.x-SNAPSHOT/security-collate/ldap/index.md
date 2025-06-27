---
title: Ldap Authentication
slug: /security/ldap
collate: true
---

# Setting up Ldap Authentication
{%important%}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Auth0 SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens). The keys we provide
  by default are aimed only for quickstart and testing purposes. They should NEVER be used in a production installation.

{%important%}

OpenMetadata allows using LDAP for validating email and password authentication.
Once setup successfully, the user should be able to sign in to OpenMetadata using the Ldap credentials.

You will need to share the following information with the Collate team:
- `host`: hostName for the Ldap Server (Ex - localhost).
- `port`: port of the Ldap Server to connect to (Ex - 10636).
- `dnAdminPrincipal`: This is the DN Admin Principal(Complete path Example :- cn=admin,dc=example,dc=com) with a lookup access in the Directory.
- `dnAdminPassword`: Above Admin Principal Password.
- `userBaseDN`: User Base DN(Complete path Example :- ou=people,dc=example,dc=com).

Please see the below image for a sample LDAP Configuration in ApacheDS.

{% image src="/images/v1.9/deployment/security/ldap/Ldap_ScreenShot1.png" alt="apache-ldap" /%}

Advanced LDAP Specific Configuration (Optional):

- `maxPoolSize`: Connection Pool Size to use to connect to LDAP Server.
- `sslEnabled`: Set to true if the SSL is enable to connect to LDAP Server.
- `truststoreConfigType`: Truststore type. It is required. Can select from {CustomTrustStore, HostName, JVMDefault, TrustAll}
- `trustStoreConfig`: Config for the selected truststore type. Please check below note for setting this up.

{%note%}

Based on the different `truststoreConfigType`, we have following different `trustStoreConfig`.

1. **TrustAll**: Provides an SSL trust manager which will blindly trust any certificate that is presented to it, although it may optionally reject certificates that are expired or not yet valid. It can be convenient for testing purposes, but it is recommended that production environments use trust managers that perform stronger validation.
- `examineValidityDates`: Indicates whether to reject certificates if the current time is outside the validity window for the certificate.

2. **JVMDefault**: Provides an implementation of a trust manager that relies on the JVM's default set of trusted issuers.
- `verifyHostname`: Controls using TrustAllSSLSocketVerifier vs HostNameSSLSocketVerifier. In case the certificate contains cn=hostname of the Ldap Server set it to true.

3. **HostName**: Provides an SSL trust manager that will only accept certificates whose hostname matches an expected value.
- `allowWildCards`: Indicates whether to allow wildcard certificates which contain an asterisk as the first component of a CN subject attribute or dNSName subjectAltName extension.
- `acceptableHostNames`: The set of hostnames and/or IP addresses that will be considered acceptable. Only certificates with a CN or subjectAltName value that exactly matches one of these names (ignoring differences in capitalization) will be considered acceptable. It must not be null or empty.

4. **CustomTrustStore**: Use the custom Truststore by providing the below details in the config.
- `trustStoreFilePath`: The path to the trust store file to use. It must not be null.
- `trustStoreFilePassword`: The PIN to use to access the contents of the trust store. It may be null if no PIN is required.
- `trustStoreFileFormat`: The format to use for the trust store. (Example :- JKS, PKCS12).
- `verifyHostname`: Controls using TrustAllSSLSocketVerifier vs HostNameSSLSocketVerifier. In case the certificate contains cn=hostname of the Ldap Server set it to true.
- `examineValidityDates`: Indicates whether to reject certificates if the current time is outside the validity window for the certificate.

{%/note%}