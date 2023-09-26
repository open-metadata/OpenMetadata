---
title: Kubernetes Helm Values
slug: /deployment/kubernetes/helm-values
---

# Kubernetes Helm Values

This page list all the supported helm values for OpenMetadata Helm Charts.

## Global Chart Values


{%table%}

| Key | Type | Default | Environment Variable from openmetadata.yaml | 
|-----|------|---------| ---------------------- |
| global.authentication.provider | string | `basic` | AUTHENTICATION_PROVIDER |
| global.authentication.publicKeys | list | `[http://openmetadata:8585/api/v1/system/config/jwks]` | AUTHENTICATION_PUBLIC_KEYS |
| global.authentication.authority | string | `https://accounts.google.com` | AUTHENTICATION_AUTHORITY |
| global.authentication.clientId | string | `Empty String` | AUTHENTICATION_CLIENT_ID |
| global.authentication.callbackUrl | string | `Empty String` | AUTHENTICATION_CALLBACK_URL |
| global.authentication.enableSelfSignup | bool | `true` | AUTHENTICATION_ENABLE_SELF_SIGNUP |
| global.authentication.jwtPrincipalClaims | list | `[email,preferred_username,sub]` | AUTHENTICATION_JWT_PRINCIPAL_CLAIMS |
| global.authentication.ldapConfiguration.host | string | `localhost` | AUTHENTICATION_LDAP_HOST |
| global.authentication.ldapConfiguration.port |int | 10636 | AUTHENTICATION_LDAP_PORT |
| global.authentication.ldapConfiguration.dnAdminPrincipal | string | `cn=admin,dc=example,dc=com` | AUTHENTICATION_LOOKUP_ADMIN_DN |
| global.authentication.ldapConfiguration.dnAdminPassword.secretRef | string | `ldap-secret` | AUTHENTICATION_LOOKUP_ADMIN_PWD |
| global.authentication.ldapConfiguration.dnAdminPassword.secretKey | string | `openmetadata-ldap-secret` | AUTHENTICATION_LOOKUP_ADMIN_PWD |
| global.authentication.ldapConfiguration.userBaseDN | string | `ou=people,dc=example,dc=com` | AUTHENTICATION_USER_LOOKUP_BASEDN |
| global.authentication.ldapConfiguration.mailAttributeName | string | `email` | AUTHENTICATION_USER_MAIL_ATTR |
| global.authentication.ldapConfiguration.maxPoolSize | int | 3 | AUTHENTICATION_LDAP_POOL_SIZE |
| global.authentication.ldapConfiguration.sslEnabled | bool | `true` | AUTHENTICATION_LDAP_SSL_ENABLED |
| global.authentication.ldapConfiguration.truststoreConfigType | string | `TrustAll` | AUTHENTICATION_LDAP_TRUSTSTORE_TYPE |
| global.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.trustStoreFilePath | string | `Empty String` | AUTHENTICATION_LDAP_TRUSTSTORE_PATH |
| global.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.trustStoreFilePassword.secretRef | string | `Empty String` | AUTHENTICATION_LDAP_KEYSTORE_PASSWORD |
| global.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.trustStoreFilePassword.secretKey | string | `Empty String` | AUTHENTICATION_LDAP_KEYSTORE_PASSWORD |
| global.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.trustStoreFileFormat | string | `Empty String` | AUTHENTICATION_LDAP_SSL_KEY_FORMAT |
| global.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.verifyHostname | string | `Empty String` | AUTHENTICATION_LDAP_SSL_VERIFY_CERT_HOST |
| global.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.examineValidityDate | bool | `true` | AUTHENTICATION_LDAP_EXAMINE_VALIDITY_DATES |
| global.authentication.ldapConfiguration.trustStoreConfig.hostNameConfig.allowWildCards | bool | `false` | AUTHENTICATION_LDAP_ALLOW_WILDCARDS |
| global.authentication.ldapConfiguration.trustStoreConfig.hostNameConfig.acceptableHostNames | string | `[Empty String]` | AUTHENTICATION_LDAP_ALLOWED_HOSTNAMES |
| global.authentication.ldapConfiguration.trustStoreConfig.jvmDefaultConfig.verifyHostname | string | `Empty String` | AUTHENTICATION_LDAP_SSL_VERIFY_CERT_HOST |
| global.authentication.ldapConfiguration.trustStoreConfig.trustAllConfig.examineValidityDates | bool | `true` | AUTHENTICATION_LDAP_EXAMINE_VALIDITY_DATES |
| global.authentication.saml.debugMode | bool | false | SAML_DEBUG_MODE |
| global.authentication.saml.idp.entityId | string | `Empty` | SAML_IDP_ENTITY_ID |
| global.authentication.saml.idp.ssoLoginUrl |  string | `Empty` | SAML_IDP_SSO_LOGIN_URL |
| global.authentication.saml.idp.idpX509Certificate.secretRef | string | `Empty` | SAML_IDP_CERTIFICATE |
| global.authentication.saml.idp.idpX509Certificate.secretKey |  string | `Empty` | SAML_IDP_CERTIFICATE | 
| global.authentication.saml.idp.authorityUrl | string | `http://openmetadata.default.svc.cluster.local:8585/api/v1/saml/login` | SAML_AUTHORITY_URL |
| global.authentication.saml.idp.nameId | string | `urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress` | SAML_IDP_NAME_ID |
| global.authentication.saml.sp.entityId | string | `http://openmetadata.default.svc.cluster.local:8585/api/v1/saml/metadata` | SAML_SP_ENTITY_ID |
| global.authentication.saml.sp.acs | string | `http://openmetadata.default.svc.cluster.local:8585/api/v1/saml/acs` | SAML_SP_ACS |
| global.authentication.saml.sp.spX509Certificate.secretRef | string | `Empty`  | SAML_SP_CERTIFICATE |
| global.authentication.saml.sp.spX509Certificate.secretKey | string | `Empty`  | SAML_SP_CERTIFICATE |
| global.authentication.saml.sp.callback | string | `http://openmetadata.default.svc.cluster.local:8585/saml/callback` | SAML_SP_CALLBACK |
| global.authentication.saml.security.strictMode |  bool | false | SAML_STRICT_MODE |
| global.authentication.saml.security.tokenValidity | int | 3600 | SAML_SP_TOKEN_VALIDITY |
| global.authentication.saml.security.sendEncryptedNameId | bool | false | SAML_SEND_ENCRYPTED_NAME_ID |
| global.authentication.saml.security.sendSignedAuthRequest | bool | false | SAML_SEND_SIGNED_AUTH_REQUEST |
| global.authentication.saml.security.signSpMetadata | bool  | false | SAML_SIGNED_SP_METADATA |
| global.authentication.saml.security.wantMessagesSigned | bool  | false | SAML_WANT_MESSAGE_SIGNED |
| global.authentication.saml.security.wantAssertionsSigned | bool  | false | SAML_WANT_ASSERTION_SIGNED |
| global.authentication.saml.security.wantAssertionEncrypted | bool  | false | SAML_WANT_ASSERTION_ENCRYPTED |
| global.authentication.saml.security.wantNameIdEncrypted | bool  | false | SAML_WANT_NAME_ID_ENCRYPTED |
| global.authentication.saml.security.keyStoreFilePath |  string | `Empty` | SAML_KEYSTORE_FILE_PATH |
| global.authentication.saml.security.keyStoreAlias.secretRef | string  | `Empty` | SAML_KEYSTORE_ALIAS |
| global.authentication.saml.security.keyStoreAlias.secretKey | string  | `Empty` | SAML_KEYSTORE_ALIAS |
| global.authentication.saml.security.keyStorePassword.secretRef | string  | `Empty` | SAML_KEYSTORE_PASSWORD |
| global.authentication.saml.security.keyStorePassword.secretKey | string  | `Empty` | SAML_KEYSTORE_PASSWORD |
| global.authorizer.allowedEmailRegistrationDomains | list | `[all]` | AUTHORIZER_ALLOWED_REGISTRATION_DOMAIN |
| global.authorizer.className | string | `org.openmetadata.service.security.DefaultAuthorizer` | AUTHORIZER_CLASS_NAME |
| global.authorizer.containerRequestFilter | string | `org.openmetadata.service.security.JwtFilter` | AUTHORIZER_REQUEST_FILTER |
| global.authorizer.enforcePrincipalDomain | bool | `false` | AUTHORIZER_ENFORCE_PRINCIPAL_DOMAIN |
| global.authorizer.enableSecureSocketConnection | bool | `false` | AUTHORIZER_ENABLE_SECURE_SOCKET |
| global.authorizer.initialAdmins | list | `[admin]` | AUTHORIZER_ADMIN_PRINCIPALS |
| global.authorizer.principalDomain | string | `open-metadata.org` | AUTHORIZER_PRINCIPAL_DOMAIN |
| global.airflow.auth.password.secretRef | string | `airflow-secrets` | AIRFLOW_PASSWORD |
| global.airflow.auth.password.secretKey | string | `openmetadata-airflow-password` | AIRFLOW_PASSWORD |
| global.airflow.auth.username | string | `admin` | AIRFLOW_USERNAME |
| global.airflow.enabled | bool | `true` | |
| global.airflow.host | string | `http://openmetadata-dependencies-web.default.svc.cluster.local:8080` | PIPELINE_SERVICE_CLIENT_ENDPOINT |
| global.airflow.openmetadata.serverHostApiUrl | string | `http://openmetadata.default.svc.cluster.local:8585/api` | SERVER_HOST_API_URL |
| global.airflow.sslCertificatePath | string | `/no/path` | PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH |
| global.airflow.verifySsl | string | `no-ssl` | PIPELINE_SERVICE_CLIENT_VERIFY_SSL |
| global.basicLogin.maxLoginFailAttempts | int | 3 | OM_MAX_FAILED_LOGIN_ATTEMPTS |
| global.basicLogin.accessBlockTime | int | 600 | OM_LOGIN_ACCESS_BLOCK_TIME |
| global.clusterName | string | `openmetadata` | OPENMETADATA_CLUSTER_NAME |
| global.database.auth.password.secretRef | string | `mysql-secrets` | DB_USER_PASSWORD |
| global.database.auth.password.secretKey | string | `openmetadata-mysql-password` | DB_USER_PASSWORD |
| global.database.auth.username | string | `openmetadata_user` | DB_USER|
| global.database.databaseName | string | `openmetadata_db` | OM_DATABASE |
| global.database.dbScheme| string | `mysql` | DB_SCHEME |
| global.database.dbUseSSL| bool | `false` | DB_USE_SSL |
| global.database.driverClass| string | `com.mysql.cj.jdbc.Driver` | DB_DRIVER_CLASS |
| global.database.host | string | `mysql` | DB_HOST |
| global.database.port | int | 3306 | DB_PORT |
| global.elasticsearch.auth.enabled | bool | `false` | |
| global.elasticsearch.auth.username | string | `elasticsearch` | ELASTICSEARCH_USER |
| global.elasticsearch.auth.password.secretRef | string | `elasticsearch-secrets` | ELASTICSEARCH_PASSWORD |
| global.elasticsearch.auth.password.secretKey | string | `openmetadata-elasticsearch-password` | ELASTICSEARCH_PASSWORD |
| global.elasticsearch.host | string | `elasticsearch` | ELASTICSEARCH_HOST |
| global.elasticsearch.port | int | 9200 | ELASTICSEARCH_PORT |
| global.elasticsearch.scheme | string | `http` | ELASTICSEARCH_SCHEME |
| global.elasticsearch.searchIndexMappingLanguage | string | `EN`| ELASTICSEARCH_INDEX_MAPPING_LANG |
| global.elasticsearch.trustStore.enabled | bool | `false` | |
| global.elasticsearch.trustStore.path | string | `Empty String` | ELASTICSEARCH_TRUST_STORE_PATH |
| global.elasticsearch.trustStore.password.secretRef | string | `elasticsearch-truststore-secrets` | ELASTICSEARCH_TRUST_STORE_PASSWORD |
| global.elasticsearch.trustStore.password.secretKey | string | `openmetadata-elasticsearch-truststore-password` | ELASTICSEARCH_TRUST_STORE_PASSWORD |
| global.eventMonitor.type | string | `prometheus` | EVENT_MONITOR |
| global.eventMonitor.batchSize | int | `10` | EVENT_MONITOR_BATCH_SIZE |
| global.eventMonitor.pathPattern | list | `[/api/v1/tables/*,/api/v1/health-check]` | EVENT_MONITOR_PATH_PATTERN |
| global.eventMonitor.latency | list | `[]` | EVENT_MONITOR_LATENCY |
| global.fernetkey.value | string | `jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=` | FERNET_KEY |
| global.fernetkey.secretRef | string | `` | FERNET_KEY |
| global.fernetkey.secretKef | string | `` | FERNET_KEY |
| global.jwtTokenConfiguration.enabled | bool | `true` | |
| global.jwtTokenConfiguration.rsapublicKeyFilePath | string | `./conf/public_key.der` | RSA_PUBLIC_KEY_FILE_PATH |
| global.jwtTokenConfiguration.rsaprivateKeyFilePath | string | `./conf/private_key.der` | RSA_PRIVATE_KEY_FILE_PATH |
| global.jwtTokenConfiguration.jwtissuer | string | `open-metadata.org` | JWT_ISSUER |
| global.jwtTokenConfiguration.keyId | string | `Gb389a-9f76-gdjs-a92j-0242bk94356` | JWT_KEY_ID |
| global.logLevel | string | `INFO` | LOG_LEVEL |
| global.maskPasswordsApi | bool | `false` | MASK_PASSWORDS_API |
| global.openmetadata.adminPort | int | 8586 | SERVER_ADMIN_PORT |
| global.openmetadata.host | string | `openmetadata` | OPENMETADATA_SERVER_URL |
| global.openmetadata.port | int | 8585 | SERVER_PORT |
| global.pipelineServiceClientConfig.auth.password.secretRef | string | `airflow-secrets` | AIRFLOW_PASSWORD |
| global.pipelineServiceClientConfig.auth.password.secretKey | string | `openmetadata-airflow-password` | AIRFLOW_PASSWORD |
| global.pipelineServiceClientConfig.auth.username | string | `admin` | AIRFLOW_USERNAME |
| global.pipelineServiceClientConfig.apiEndpoint | string | `http://openmetadata-dependencies-web.default.svc.cluster.local:8080` | PIPELINE_SERVICE_CLIENT_ENDPOINT |
| global.pipelineServiceClientConfig.className | string | `org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient` | PIPELINE_SERVICE_CLIENT_CLASS_NAME |
| global.pipelineServiceClientConfig.enabled | bool | `true` | |
| global.pipelineServiceClientConfig.ingestionIpInfoEnabled | bool | `false` | PIPELINE_SERVICE_IP_INFO_ENABLED |
| global.pipelineServiceClientConfig.metadataApiEndpoint | string | `http://openmetadata.default.svc.cluster.local:8585/api` | SERVER_HOST_API_URL |
| global.pipelineServiceClientConfig.sslCertificatePath | string | `/no/path` | PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH |
| global.pipelineServiceClientConfig.verifySsl | string | `no-ssl` | PIPELINE_SERVICE_CLIENT_VERIFY_SSL | 
| global.pipelineServiceClientConfig.hostIp | string | `Empty` | PIPELINE_SERVICE_CLIENT_HOST_IP |
| global.secretsManager.provider | string | `noop` | SECRET_MANAGER |
| global.secretsManager.additionalParameters.enabled | bool | `false` | |
| global.secretsManager.additionalParameters.accessKeyId.secretRef | string | `aws-access-key-secret` | OM_SM_ACCESS_KEY_ID |
| global.secretsManager.additionalParameters.accessKeyId.secretKey | string | `aws-key-secret` | OM_SM_ACCESS_KEY_ID |
| global.secretsManager.additionalParameters.region | string | `Empty String` | OM_SM_REGION |
| global.secretsManager.additionalParameters.secretAccessKey.secretRef | string | `aws-secret-access-key-secret` | OM_SM_ACCESS_KEY |
| global.secretsManager.additionalParameters.secretAccessKey.secretKey | string | `aws-key-secret` | OM_SM_ACCESS_KEY |
| global.smtpConfig.enableSmtpServer | bool | `false` | AUTHORIZER_ENABLE_SMTP |
| global.smtpConfig.emailingEntity | string | `OpenMetadata` | OM_EMAIL_ENTITY |
| global.smtpConfig.openMetadataUrl | string | `Empty String` | OPENMETADATA_SERVER_URL |
| global.smtpConfig.password.secretKey | string | `Empty String` | SMTP_SERVER_PWD |
| global.smtpConfig.password.secretRef | string | `Empty String` | SMTP_SERVER_PWD |
| global.smtpConfig.serverEndpoint | string | `Empty String` | SMTP_SERVER_ENDPOINT |
| global.smtpConfig.serverPort | string | `Empty String` | SMTP_SERVER_PORT |
| global.smtpConfig.supportUrl | string | `https://slack.open-metadata.org` | OM_SUPPORT_URL |
| global.smtpConfig.transportationStrategy | string | `SMTP_TLS` | SMTP_SERVER_STRATEGY |
| global.smtpConfig.username | string | `Empty String` | SMTP_SERVER_USERNAME |

{%/table%}

## Chart Values

{%table%}

| Key | Type | Default |
|-----|------|---------|
| affinity | object | `{}` |
| commonLabels | object | `{}` |
| extraEnvs | Extra [environment variables][] which will be appended to the `env:` definition for the container | `[]` |
| extraInitContainers | Templatable string of additional `initContainers` to be passed to `tpl` function | `[]` |
| extraVolumes | Templatable string of additional `volumes` to be passed to the `tpl` function | `[]` |
| extraVolumeMounts | Templatable string of additional `volumeMounts` to be passed to the `tpl` function | `[]` |
| fullnameOverride | string | `"openmetadata"` |
| image.pullPolicy | string | `"Always"` |
| image.repository | string | `"docker.getcollate.io/openmetadata/server"` |
| image.tag | string | `0.13.3` |
| imagePullSecrets | list | `[]` |
| ingress.annotations | object | `{}` |
| ingress.className | string | `""` |
| ingress.enabled | bool | `false` |
| ingress.hosts[0].host | string | `"open-metadata.local"` |
| ingress.hosts[0].paths[0].path | string | `"/"` |
| ingress.hosts[0].paths[0].pathType | string | `"ImplementationSpecific"` |
| ingress.tls | list | `[]` |
| livenessProbe.initialDelaySeconds | int | `60` |
| livenessProbe.periodSeconds | int | `30` |
| livenessProbe.failureThreshold | int | `5` |
| livenessProbe.httpGet.path | string | `/healthcheck` |
| livenessProbe.httpGet.port | string | `http-admin` |
| nameOverride | string | `""` |
| nodeSelector | object | `{}` |
| podAnnotations | object | `{}` |
| podSecurityContext | object | `{}` |
| readinessProbe.initialDelaySeconds | int | `60` |
| readinessProbe.periodSeconds | int | `30` |
| readinessProbe.failureThreshold | int | `5` |
| readinessProbe.httpGet.path | string | `/` |
| readinessProbe.httpGet.port | string | `http` |
| replicaCount | int | `1` |
| resources | object | `{}` |
| securityContext | object | `{}` |
| service.adminPort | string | `8586` |
| service.annotations | object | `{}` |
| service.port | int | `8585` |
| service.type | string | `"ClusterIP"` |
| serviceAccount.annotations | object | `{}` |
| serviceAccount.create | bool | `true` |
| serviceAccount.name | string | `nil` |
| sidecars | list | `[]` |
| tolerations | list | `[]` |
| networkPolicy.enabled | bool |`false` |

{%/table%}
