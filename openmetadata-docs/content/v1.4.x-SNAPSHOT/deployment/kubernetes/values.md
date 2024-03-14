---
title: Kubernetes Helm Values
slug: /deployment/kubernetes/helm-values
---

# Kubernetes Helm Values

This page list all the supported helm values for OpenMetadata Helm Charts.

## Openmetadata Config Chart Values 

{%table%}

| Key | Type | Default | Environment Variable from openmetadata.yaml | 
|-----|------|---------| ---------------------- |
| openmetadata.config.authentication.enabled | bool | `true` | |
| openmetadata.config.authentication.provider | string | `basic` | AUTHENTICATION_PROVIDER |
| openmetadata.config.authentication.publicKeys | list | `[http://openmetadata:8585/api/v1/system/config/jwks]` | AUTHENTICATION_PUBLIC_KEYS |
| openmetadata.config.authentication.authority | string | `https://accounts.google.com` | AUTHENTICATION_AUTHORITY |
| openmetadata.config.authentication.clientId | string | `Empty String` | AUTHENTICATION_CLIENT_ID |
| openmetadata.config.authentication.callbackUrl | string | `Empty String` | AUTHENTICATION_CALLBACK_URL |
| openmetadata.config.authentication.enableSelfSignup | bool | `true` | AUTHENTICATION_ENABLE_SELF_SIGNUP |
| openmetadata.config.authentication.jwtPrincipalClaims | list | `[email,preferred_username,sub]` | AUTHENTICATION_JWT_PRINCIPAL_CLAIMS |
| openmetadata.config.authentication.ldapConfiguration.host | string | `localhost` | AUTHENTICATION_LDAP_HOST |
| openmetadata.config.authentication.ldapConfiguration.port |int | 10636 | AUTHENTICATION_LDAP_PORT |
| openmetadata.config.authentication.ldapConfiguration.dnAdminPrincipal | string | `cn=admin,dc=example,dc=com` | AUTHENTICATION_LOOKUP_ADMIN_DN |
| openmetadata.config.authentication.ldapConfiguration.dnAdminPassword.secretRef | string | `ldap-secret` | AUTHENTICATION_LOOKUP_ADMIN_PWD |
| openmetadata.config.authentication.ldapConfiguration.dnAdminPassword.secretKey | string | `openmetadata-ldap-secret` | AUTHENTICATION_LOOKUP_ADMIN_PWD |
| openmetadata.config.authentication.ldapConfiguration.userBaseDN | string | `ou=people,dc=example,dc=com` | AUTHENTICATION_USER_LOOKUP_BASEDN |
| openmetadata.config.authentication.ldapConfiguration.groupBaseDN | string | `Empty String` | AUTHENTICATION_GROUP_LOOKUP_BASEDN |
| openmetadata.config.authentication.ldapConfiguration.roleAdminName | string | `Empty String` | AUTHENTICATION_USER_ROLE_ADMIN_NAME |
| openmetadata.config.authentication.ldapConfiguration.allAttributeName | string | `Empty String` | AUTHENTICATION_USER_ALL_ATTR |
| openmetadata.config.authentication.ldapConfiguration.usernameAttributeName | string | `Empty String` | AUTHENTICATION_USER_NAME_ATTR |
| openmetadata.config.authentication.ldapConfiguration.groupAttributeName | string | `Empty String` | AUTHENTICATION_USER_GROUP_ATTR |
| openmetadata.config.authentication.ldapConfiguration.groupAttributeValue | string | `Empty String` | AUTHENTICATION_USER_GROUP_ATTR_VALUE |
| openmetadata.config.authentication.ldapConfiguration.groupMemberAttributeName | string | `Empty String` | AUTHENTICATION_USER_GROUP_MEMBER_ATTR |
| openmetadata.config.authentication.ldapConfiguration.authRolesMapping | string | `Empty String` | AUTH_ROLES_MAPPING |
| openmetadata.config.authentication.ldapConfiguration.authReassignRoles | string | `Empty String` | AUTH_REASSIGN_ROLES |
| openmetadata.config.authentication.ldapConfiguration.mailAttributeName | string | `email` | AUTHENTICATION_USER_MAIL_ATTR |
| openmetadata.config.authentication.ldapConfiguration.maxPoolSize | int | 3 | AUTHENTICATION_LDAP_POOL_SIZE |
| openmetadata.config.authentication.ldapConfiguration.sslEnabled | bool | `true` | AUTHENTICATION_LDAP_SSL_ENABLED |
| openmetadata.config.authentication.ldapConfiguration.truststoreConfigType | string | `TrustAll` | AUTHENTICATION_LDAP_TRUSTSTORE_TYPE |
| openmetadata.config.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.trustStoreFilePath | string | `Empty String` | AUTHENTICATION_LDAP_TRUSTSTORE_PATH |
| openmetadata.config.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.trustStoreFilePassword.secretRef | string | `Empty String` | AUTHENTICATION_LDAP_KEYSTORE_PASSWORD |
| openmetadata.config.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.trustStoreFilePassword.secretKey | string | `Empty String` | AUTHENTICATION_LDAP_KEYSTORE_PASSWORD |
| openmetadata.config.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.trustStoreFileFormat | string | `Empty String` | AUTHENTICATION_LDAP_SSL_KEY_FORMAT |
| openmetadata.config.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.verifyHostname | string | `Empty String` | AUTHENTICATION_LDAP_SSL_VERIFY_CERT_HOST |
| openmetadata.config.authentication.ldapConfiguration.trustStoreConfig.customTrustManagerConfig.examineValidityDate | bool | `true` | AUTHENTICATION_LDAP_EXAMINE_VALIDITY_DATES |
| openmetadata.config.authentication.ldapConfiguration.trustStoreConfig.hostNameConfig.allowWildCards | bool | `false` | AUTHENTICATION_LDAP_ALLOW_WILDCARDS |
| openmetadata.config.authentication.ldapConfiguration.trustStoreConfig.hostNameConfig.acceptableHostNames | string | `[Empty String]` | AUTHENTICATION_LDAP_ALLOWED_HOSTNAMES |
| openmetadata.config.authentication.ldapConfiguration.trustStoreConfig.jvmDefaultConfig.verifyHostname | string | `Empty String` | AUTHENTICATION_LDAP_SSL_VERIFY_CERT_HOST |
| openmetadata.config.authentication.ldapConfiguration.trustStoreConfig.trustAllConfig.examineValidityDates | bool | `true` | AUTHENTICATION_LDAP_EXAMINE_VALIDITY_DATES |
| openmetadata.config.authentication.saml.debugMode | bool | false | SAML_DEBUG_MODE |
| openmetadata.config.authentication.saml.idp.entityId | string | `Empty` | SAML_IDP_ENTITY_ID |
| openmetadata.config.authentication.saml.idp.ssoLoginUrl |  string | `Empty` | SAML_IDP_SSO_LOGIN_URL |
| openmetadata.config.authentication.saml.idp.idpX509Certificate.secretRef | string | `Empty` | SAML_IDP_CERTIFICATE |
| openmetadata.config.authentication.saml.idp.idpX509Certificate.secretKey |  string | `Empty` | SAML_IDP_CERTIFICATE |
| openmetadata.config.authentication.saml.idp.authorityUrl | string | `http://openmetadata:8585/api/v1/saml/login` | SAML_AUTHORITY_URL |
| openmetadata.config.authentication.saml.idp.nameId | string | `urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress` | SAML_IDP_NAME_ID |
| openmetadata.config.authentication.saml.sp.entityId | string | `http://openmetadata:8585/api/v1/saml/metadata` | SAML_SP_ENTITY_ID |
| openmetadata.config.authentication.saml.sp.acs | string | `http://openmetadata:8585/api/v1/saml/acs` | SAML_SP_ACS |
| openmetadata.config.authentication.saml.sp.spX509Certificate.secretRef | string | `Empty`  | SAML_SP_CERTIFICATE |
| openmetadata.config.authentication.saml.sp.spX509Certificate.secretKey | string | `Empty`  | SAML_SP_CERTIFICATE |
| openmetadata.config.authentication.saml.sp.callback | string | `http://openmetadata:8585/saml/callback` | SAML_SP_CALLBACK |
| openmetadata.config.authentication.saml.security.strictMode |  bool | false | SAML_STRICT_MODE |
| openmetadata.config.authentication.saml.security.tokenValidity | int | 3600 | SAML_SP_TOKEN_VALIDITY |
| openmetadata.config.authentication.saml.security.sendEncryptedNameId | bool | false | SAML_SEND_ENCRYPTED_NAME_ID |
| openmetadata.config.authentication.saml.security.sendSignedAuthRequest | bool | false | SAML_SEND_SIGNED_AUTH_REQUEST |
| openmetadata.config.authentication.saml.security.signSpMetadata | bool  | false | SAML_SIGNED_SP_METADATA |
| openmetadata.config.authentication.saml.security.wantMessagesSigned | bool  | false | SAML_WANT_MESSAGE_SIGNED |
| openmetadata.config.authentication.saml.security.wantAssertionsSigned | bool  | false | SAML_WANT_ASSERTION_SIGNED |
| openmetadata.config.authentication.saml.security.wantAssertionEncrypted | bool  | false | SAML_WANT_ASSERTION_ENCRYPTED |
| openmetadata.config.authentication.saml.security.wantNameIdEncrypted | bool  | false | SAML_WANT_NAME_ID_ENCRYPTED |
| openmetadata.config.authentication.saml.security.keyStoreFilePath |  string | `Empty` | SAML_KEYSTORE_FILE_PATH |
| openmetadata.config.authentication.saml.security.keyStoreAlias.secretRef | string  | `Empty` | SAML_KEYSTORE_ALIAS |
| openmetadata.config.authentication.saml.security.keyStoreAlias.secretKey | string  | `Empty` | SAML_KEYSTORE_ALIAS |
| openmetadata.config.authentication.saml.security.keyStorePassword.secretRef | string  | `Empty` | SAML_KEYSTORE_PASSWORD |
| openmetadata.config.authentication.saml.security.keyStorePassword.secretKey | string  | `Empty` | SAML_KEYSTORE_PASSWORD |
| openmetadata.config.authorizer.enabled | bool | `true` | |
| openmetadata.config.authorizer.allowedEmailRegistrationDomains | list | `[all]` | AUTHORIZER_ALLOWED_REGISTRATION_DOMAIN |
| openmetadata.config.authorizer.className | string | `org.openmetadata.service.security.DefaultAuthorizer` | AUTHORIZER_CLASS_NAME |
| openmetadata.config.authorizer.containerRequestFilter | string | `org.openmetadata.service.security.JwtFilter` | AUTHORIZER_REQUEST_FILTER |
| openmetadata.config.authorizer.enforcePrincipalDomain | bool | `false` | AUTHORIZER_ENFORCE_PRINCIPAL_DOMAIN |
| openmetadata.config.authorizer.enableSecureSocketConnection | bool | `false` | AUTHORIZER_ENABLE_SECURE_SOCKET |
| openmetadata.config.authorizer.initialAdmins | list | `[admin]` | AUTHORIZER_ADMIN_PRINCIPALS |
| openmetadata.config.authorizer.principalDomain | string | `open-metadata.org` | AUTHORIZER_PRINCIPAL_DOMAIN |
| openmetadata.config.airflow.auth.password.secretRef | string | `airflow-secrets` | AIRFLOW_PASSWORD |
| openmetadata.config.airflow.auth.password.secretKey | string | `openmetadata-airflow-password` | AIRFLOW_PASSWORD |
| openmetadata.config.airflow.auth.username | string | `admin` | AIRFLOW_USERNAME |
| openmetadata.config.airflow.enabled | bool | `true` | |
| openmetadata.config.airflow.host | string | `http://openmetadata-dependencies-web:8080` | PIPELINE_SERVICE_CLIENT_ENDPOINT |
| openmetadata.config.airflow.openmetadata.serverHostApiUrl | string | `http://openmetadata:8585/api` | SERVER_HOST_API_URL |
| openmetadata.config.airflow.sslCertificatePath | string | `/no/path` | PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH |
| openmetadata.config.airflow.verifySsl | string | `no-ssl` | PIPELINE_SERVICE_CLIENT_VERIFY_SSL |
| openmetadata.config.clusterName | string | `openmetadata` | OPENMETADATA_CLUSTER_NAME |
| openmetadata.config.database.enabled | bool | `true` | |
| openmetadata.config.database.auth.password.secretRef | string | `mysql-secrets` | DB_USER_PASSWORD |
| openmetadata.config.database.auth.password.secretKey | string | `openmetadata-mysql-password` | DB_USER_PASSWORD |
| openmetadata.config.database.auth.username | string | `openmetadata_user` | DB_USER|
| openmetadata.config.database.databaseName | string | `openmetadata_db` | OM_DATABASE |
| openmetadata.config.database.dbParams| string | `allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC` | DB_PARAMS |
| openmetadata.config.database.dbScheme| string | `mysql` | DB_SCHEME |
| openmetadata.config.database.driverClass| string | `com.mysql.cj.jdbc.Driver` | DB_DRIVER_CLASS |
| openmetadata.config.database.host | string | `mysql` | DB_HOST |
| openmetadata.config.database.port | int | 3306 | DB_PORT |
| openmetadata.config.elasticsearch.enabled | bool | `true` | |
| openmetadata.config.elasticsearch.auth.enabled | bool | `false` | |
| openmetadata.config.elasticsearch.auth.username | string | `elasticsearch` | ELASTICSEARCH_USER |
| openmetadata.config.elasticsearch.auth.password.secretRef | string | `elasticsearch-secrets` | ELASTICSEARCH_PASSWORD |
| openmetadata.config.elasticsearch.auth.password.secretKey | string | `openmetadata-elasticsearch-password` | ELASTICSEARCH_PASSWORD |
| openmetadata.config.elasticsearch.host | string | `opensearch` | ELASTICSEARCH_HOST |
| openmetadata.config.elasticsearch.keepAliveTimeoutSecs | int | `600` | ELASTICSEARCH_KEEP_ALIVE_TIMEOUT_SECS |
| openmetadata.config.elasticsearch.port | int | 9200 | ELASTICSEARCH_PORT |
| openmetadata.config.elasticsearch.searchType | string | `opensearch` | SEARCH_TYPE |
| openmetadata.config.elasticsearch.scheme | string | `http` | ELASTICSEARCH_SCHEME |
| openmetadata.config.elasticsearch.clusterAlias | string | `Empty String` | ELASTICSEARCH_CLUSTER_ALIAS |
| openmetadata.config.elasticsearch.searchIndexMappingLanguage | string | `EN`| ELASTICSEARCH_INDEX_MAPPING_LANG |
| openmetadata.config.elasticsearch.trustStore.enabled | bool | `false` | |
| openmetadata.config.elasticsearch.trustStore.path | string | `Empty String` | ELASTICSEARCH_TRUST_STORE_PATH |
| openmetadata.config.elasticsearch.trustStore.password.secretRef | string | `elasticsearch-truststore-secrets` | ELASTICSEARCH_TRUST_STORE_PASSWORD |
| openmetadata.config.elasticsearch.trustStore.password.secretKey | string | `openmetadata-elasticsearch-truststore-password` | ELASTICSEARCH_TRUST_STORE_PASSWORD |
| openmetadata.config.eventMonitor.enabled | bool | `true` | |
| openmetadata.config.eventMonitor.type | string | `prometheus` | EVENT_MONITOR |
| openmetadata.config.eventMonitor.batchSize | int | `10` | EVENT_MONITOR_BATCH_SIZE |
| openmetadata.config.eventMonitor.pathPattern | list | `[/api/v1/tables/*,/api/v1/health-check]` | EVENT_MONITOR_PATH_PATTERN |
| openmetadata.config.eventMonitor.latency | list | `[]` | EVENT_MONITOR_LATENCY |
| openmetadata.config.fernetkey.value | string | `jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=` | FERNET_KEY |
| openmetadata.config.fernetkey.secretRef | string | `` | FERNET_KEY |
| openmetadata.config.fernetkey.secretKef | string | `` | FERNET_KEY |
| openmetadata.config.jwtTokenConfiguration.enabled | bool | `true` | |
| openmetadata.config.jwtTokenConfiguration.rsapublicKeyFilePath | string | `./conf/public_key.der` | RSA_PUBLIC_KEY_FILE_PATH |
| openmetadata.config.jwtTokenConfiguration.rsaprivateKeyFilePath | string | `./conf/private_key.der` | RSA_PRIVATE_KEY_FILE_PATH |
| openmetadata.config.jwtTokenConfiguration.jwtissuer | string | `open-metadata.org` | JWT_ISSUER |
| openmetadata.config.jwtTokenConfiguration.keyId | string | `Gb389a-9f76-gdjs-a92j-0242bk94356` | JWT_KEY_ID |
| openmetadata.config.logLevel | string | `INFO` | LOG_LEVEL |
| openmetadata.config.openmetadata.adminPort | int | 8586 | SERVER_ADMIN_PORT |
| openmetadata.config.openmetadata.host | string | `openmetadata` | OPENMETADATA_SERVER_URL |
| openmetadata.config.openmetadata.port | int | 8585 | SERVER_PORT |
| openmetadata.config.pipelineServiceClientConfig.auth.password.secretRef | string | `airflow-secrets` | AIRFLOW_PASSWORD |
| openmetadata.config.pipelineServiceClientConfig.auth.password.secretKey | string | `openmetadata-airflow-password` | AIRFLOW_PASSWORD |
| openmetadata.config.pipelineServiceClientConfig.auth.username | string | `admin` | AIRFLOW_USERNAME |
| openmetadata.config.pipelineServiceClientConfig.auth.trustStorePath | string | `` | AIRFLOW_TRUST_STORE_PATH |
| openmetadata.config.pipelineServiceClientConfig.auth.trustStorePassword.secretRef | string | `` | AIRFLOW_TRUST_STORE_PASSWORD |
| openmetadata.config.pipelineServiceClientConfig.auth.trustStorePassword.secretKey | string | `` | AIRFLOW_TRUST_STORE_PASSWORD |
| openmetadata.config.pipelineServiceClientConfig.apiEndpoint | string | `http://openmetadata-dependencies-web:8080` | PIPELINE_SERVICE_CLIENT_ENDPOINT |
| openmetadata.config.pipelineServiceClientConfig.className | string | `org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient` | PIPELINE_SERVICE_CLIENT_CLASS_NAME |
| openmetadata.config.pipelineServiceClientConfig.enabled | bool | `true` | PIPELINE_SERVICE_CLIENT_ENABLED |
| openmetadata.config.pipelineServiceClientConfig.healthCheckInterval | int | `300` | PIPELINE_SERVICE_CLIENT_HEALTH_CHECK_INTERVAL |
| openmetadata.config.pipelineServiceClientConfig.ingestionIpInfoEnabled | bool | `false` | PIPELINE_SERVICE_IP_INFO_ENABLED |
| openmetadata.config.pipelineServiceClientConfig.metadataApiEndpoint | string | `http://openmetadata:8585/api` | SERVER_HOST_API_URL |
| openmetadata.config.pipelineServiceClientConfig.sslCertificatePath | string | `/no/path` | PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH |
| openmetadata.config.pipelineServiceClientConfig.verifySsl | string | `no-ssl` | PIPELINE_SERVICE_CLIENT_VERIFY_SSL |
| openmetadata.config.pipelineServiceClientConfig.hostIp | string | `Empty` | PIPELINE_SERVICE_CLIENT_HOST_IP |
| openmetadata.config.secretsManager.enabled | bool | `true` | |
| openmetadata.config.secretsManager.provider | string | `db` | SECRET_MANAGER |
| openmetadata.config.secretsManager.prefix | string | `Empty String` | SECRET_MANAGER_PREFIX |
| openmetadata.config.secretsManager.tags | list | `[]` | SECRET_MANAGER_TAGS |
| openmetadata.config.secretsManager.additionalParameters.enabled | bool | `false` | |
| openmetadata.config.secretsManager.additionalParameters.accessKeyId.secretRef | string | `aws-access-key-secret` | OM_SM_ACCESS_KEY_ID |
| openmetadata.config.secretsManager.additionalParameters.accessKeyId.secretKey | string | `aws-key-secret` | OM_SM_ACCESS_KEY_ID |
| openmetadata.config.secretsManager.additionalParameters.region | string | `Empty String` | OM_SM_REGION |
| openmetadata.config.secretsManager.additionalParameters.secretAccessKey.secretRef | string | `aws-secret-access-key-secret` | OM_SM_ACCESS_KEY |
| openmetadata.config.secretsManager.additionalParameters.secretAccessKey.secretKey | string | `aws-key-secret` | OM_SM_ACCESS_KEY |
| openmetadata.config.smtpConfig.enableSmtpServer | bool | `false` | AUTHORIZER_ENABLE_SMTP |
| openmetadata.config.smtpConfig.emailingEntity | string | `OpenMetadata` | OM_EMAIL_ENTITY |
| openmetadata.config.smtpConfig.openMetadataUrl | string | `Empty String` | OPENMETADATA_SERVER_URL |
| openmetadata.config.smtpConfig.password.secretKey | string | `Empty String` | SMTP_SERVER_PWD |
| openmetadata.config.smtpConfig.password.secretRef | string | `Empty String` | SMTP_SERVER_PWD |
| openmetadata.config.smtpConfig.serverEndpoint | string | `Empty String` | SMTP_SERVER_ENDPOINT |
| openmetadata.config.smtpConfig.serverPort | string | `Empty String` | SMTP_SERVER_PORT |
| openmetadata.config.smtpConfig.supportUrl | string | `https://slack.open-metadata.org` | OM_SUPPORT_URL |
| openmetadata.config.smtpConfig.transportationStrategy | string | `SMTP_TLS` | SMTP_SERVER_STRATEGY |
| openmetadata.config.smtpConfig.username | string | `Empty String` | SMTP_SERVER_USERNAME |
| openmetadata.config.upgradeMigrationConfigs.force | bool | `false` |  |
| openmetadata.config.upgradeMigrationConfigs.migrationLimitParam | int | `1200` | MIGRATION_LIMIT_PARAM |
| openmetadata.config.web.enabled | bool | `true` | |
| openmetadata.config.web.contentTypeOptions.enabled | bool | `false` | WEB_CONF_CONTENT_TYPE_OPTIONS_ENABLED |
| openmetadata.config.web.csp.enabled | bool | `false` | WEB_CONF_XSS_CSP_ENABLED |
| openmetadata.config.web.csp.policy | string | `default-src 'self` | WEB_CONF_XSS_CSP_POLICY |
| openmetadata.config.web.csp.reportOnlyPolicy | string | `Empty String` | WEB_CONF_XSS_CSP_REPORT_ONLY_POLICY |
| openmetadata.config.web.frameOptions.enabled | bool | `false` | WEB_CONF_FRAME_OPTION_ENABLED |
| openmetadata.config.web.frameOptions.option | string | `SAMEORIGIN` | WEB_CONF_FRAME_OPTION |
| openmetadata.config.web.frameOptions.origin | string | `Empty String` | WEB_CONF_FRAME_ORIGIN |
| openmetadata.config.web.hsts.enabled | bool | `false` | WEB_CONF_HSTS_ENABLED |
| openmetadata.config.web.hsts.includeSubDomains | bool | `true` | WEB_CONF_HSTS_INCLUDE_SUBDOMAINS |
| openmetadata.config.web.hsts.maxAge | string | `365 days` | WEB_CONF_HSTS_MAX_AGE |
| openmetadata.config.web.hsts.preload | bool | `true` | WEB_CONF_HSTS_PRELOAD |
| openmetadata.config.web.uriPath | string | `/api` | WEB_CONF_URI_PATH |
| openmetadata.config.web.xssProtection.block | bool | `true` | WEB_CONF_XSS_PROTECTION_BLOCK |
| openmetadata.config.web.xssProtection.enabled | bool | `false` | WEB_CONF_XSS_PROTECTION_ENABLED |
| openmetadata.config.web.xssProtection.onXss | bool | `true` | WEB_CONF_XSS_PROTECTION_ON |
| openmetadata.config.web.referrer-policy.enabled | bool | `false` | WEB_CONF_REFERRER_POLICY_ENABLED |
| openmetadata.config.web.referrer-policy.option | string | `SAME_ORIGIN'` | WEB_CONF_REFERRER_POLICY_OPTION |
| openmetadata.config.web.permission-policy.enabled | bool | `false` | WEB_CONF_PERMISSION_POLICY_ENABLED |
| openmetadata.config.web.permission-policy.option | string | `Empty String` | WEB_CONF_PERMISSION_POLICY_OPTION |

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
| image.tag | string | `1.3.1` |
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
| automountServiceAccountToken| bool | `true` |
| serviceMonitor.annotations | object | `{}` |
| serviceMonitor.enabled | bool | `false` |
| serviceMonitor.interval | string | `30s` |
| serviceMonitor.labels | object | `{}` |
| sidecars | list | `[]` |
| startupProbe.periodSeconds | int | `60` |
| startupProbe.failureThreshold | int | `5` |
| startupProbe.httpGet.path | string | `/healthcheck` |
| startupProbe.httpGet.port | string | `http-admin` |
| startupProbe.successThreshold | int | `1` |
| tolerations | list | `[]` |
| networkPolicy.enabled | bool |`false` |
| podDisruptionBudget.enabled | bool | `false` |
| podDisruptionBudget.config.maxUnavailable | String | `1` |
| podDisruptionBudget.config.minAvailable | String | `1` |

{%/table%}
