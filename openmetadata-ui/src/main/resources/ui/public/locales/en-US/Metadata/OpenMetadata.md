# OpenMetadata

In this section, we provide guides and references to use the OpenMetadata connector.

# Requirements
<!-- to be updated -->
You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/metadata/openmetadata).

## Connection Details

### Cluster Name $(id="clusterName")

Cluster name to differentiate OpenMetadata Server instance
<!-- clusterName to be updated -->

### Host Port $(id="hostPort")

OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api
<!-- hostPort to be updated -->

### Auth Provider $(id="authProvider")

OpenMetadata Server Authentication Provider. Make sure configure same auth providers as the one configured on OpenMetadata server.
<!-- authProvider to be updated -->

### Verify SSL $(id="verifySSL")

Client SSL verification. Make sure to configure the SSLConfig if enabled.
<!-- verifySSL to be updated -->

### Ssl Config $(id="sslConfig")

Client SSL configuration
<!-- sslConfig to be updated -->

### Certificate Path $(id="certificatePath")

CA certificate path. E.g., /path/to/public.cert. Will be used if Verify SSL is set to `validate`.
<!-- certificatePath to be updated -->

### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->

### Secret Key $(id="secretKey")

Custom OIDC Client Secret Key.
<!-- secretKey to be updated -->

### Audience $(id="audience")

Google SSO audience URL
<!-- audience to be updated -->

### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->

### Client Id $(id="clientId")

Custom OIDC Client ID.
<!-- clientId to be updated -->

### Org URL $(id="orgURL")

Okta org url.
<!-- orgURL to be updated -->

### Private Key $(id="privateKey")

Okta Private Key.
<!-- privateKey to be updated -->

### Email $(id="email")

Okta Service account Email.
<!-- email to be updated -->

### Scopes $(id="scopes")

Azure Client ID.
<!-- scopes to be updated -->

### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->

### Client Id $(id="clientId")

Custom OIDC Client ID.
<!-- clientId to be updated -->

### Secret Key $(id="secretKey")

Custom OIDC Client Secret Key.
<!-- secretKey to be updated -->

### Domain $(id="domain")

Auth0 Domain.
<!-- domain to be updated -->

### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->

### Client Secret $(id="clientSecret")

Azure SSO client secret key
<!-- clientSecret to be updated -->

### Authority $(id="authority")

Azure SSO Authority
<!-- authority to be updated -->

### Client Id $(id="clientId")

Custom OIDC Client ID.
<!-- clientId to be updated -->

### Scopes $(id="scopes")

Azure Client ID.
<!-- scopes to be updated -->

### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->

### Client Id $(id="clientId")

Custom OIDC Client ID.
<!-- clientId to be updated -->

### Secret Key $(id="secretKey")

Custom OIDC Client Secret Key.
<!-- secretKey to be updated -->

### Token Endpoint $(id="tokenEndpoint")

Custom OIDC token endpoint.
<!-- tokenEndpoint to be updated -->

### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->

### Jwt Token $(id="jwtToken")

OpenMetadata generated JWT token.
<!-- jwtToken to be updated -->

### Secrets Manager Provider $(id="secretsManagerProvider")

OpenMetadata Secrets Manager Provider. Make sure to configure the same secrets manager providers as the ones configured on the OpenMetadata server.
<!-- secretsManagerProvider to be updated -->

### Secrets Manager Credentials $(id="secretsManagerCredentials")

OpenMetadata Secrets Manager Client credentials
<!-- secretsManagerCredentials to be updated -->

### Aws Access Key Id $(id="awsAccessKeyId")

AWS Access key ID.
<!-- awsAccessKeyId to be updated -->

### Aws Secret Access Key $(id="awsSecretAccessKey")

AWS Secret Access Key.
<!-- awsSecretAccessKey to be updated -->

### Aws Region $(id="awsRegion")

AWS Region
<!-- awsRegion to be updated -->

### Aws Session Token $(id="awsSessionToken")

AWS Session Token.
<!-- awsSessionToken to be updated -->

### End Point URL $(id="endPointURL")

EndPoint URL for the AWS
<!-- endPointURL to be updated -->

### Profile Name $(id="profileName")

The name of a profile to use with the boto session.
<!-- profileName to be updated -->

### Assume Role Arn $(id="assumeRoleArn")

The Amazon Resource Name (ARN) of the role to assume. Required Field in case of Assume Role
<!-- assumeRoleArn to be updated -->

### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons. Required Field in case of Assume Role
<!-- assumeRoleSessionName to be updated -->

### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The Amazon Resource Name (ARN) of the role to assume. Optional Field in case of Assume Role
<!-- assumeRoleSourceIdentity to be updated -->

### Api Version $(id="apiVersion")

OpenMetadata server API version to use.
<!-- apiVersion to be updated -->

### Include Topics $(id="includeTopics")

Include Topics for Indexing
<!-- includeTopics to be updated -->

### Include Tables $(id="includeTables")

Include Tables for Indexing
<!-- includeTables to be updated -->

### Include Dashboards $(id="includeDashboards")

Include Dashboards for Indexing
<!-- includeDashboards to be updated -->

### Include Pipelines $(id="includePipelines")

Include Pipelines for Indexing
<!-- includePipelines to be updated -->

### Include Ml Models $(id="includeMlModels")

Include MlModels for Indexing
<!-- includeMlModels to be updated -->

### Include Users $(id="includeUsers")

Include Users for Indexing
<!-- includeUsers to be updated -->

### Include Teams $(id="includeTeams")

Include Teams for Indexing
<!-- includeTeams to be updated -->

### Include Glossary Terms $(id="includeGlossaryTerms")

Include Glossary Terms for Indexing
<!-- includeGlossaryTerms to be updated -->

### Include Tags $(id="includeTags")

Include Tags for Indexing
<!-- includeTags to be updated -->

### Include Policy $(id="includePolicy")

Include Tags for Policy
<!-- includePolicy to be updated -->

### Include Messaging Services $(id="includeMessagingServices")

Include Messaging Services for Indexing
<!-- includeMessagingServices to be updated -->

### Enable Version Validation $(id="enableVersionValidation")

Validate Openmetadata Server & Client Version.
<!-- enableVersionValidation to be updated -->

### Include Database Services $(id="includeDatabaseServices")

Include Database Services for Indexing
<!-- includeDatabaseServices to be updated -->

### Include Pipeline Services $(id="includePipelineServices")

Include Pipeline Services for Indexing
<!-- includePipelineServices to be updated -->

### Limit Records $(id="limitRecords")

Limit the number of records for Indexing.
<!-- limitRecords to be updated -->

### Force Entity Overwriting $(id="forceEntityOverwriting")

Force the overwriting of any entity during the ingestion.
<!-- forceEntityOverwriting to be updated -->

### Elastics Search $(id="elasticsSearch")

Configuration for Sink Component in the OpenMetadata Ingestion Framework.
<!-- elasticsSearch to be updated -->

### Config $(id="config")

key/value pairs to pass to workflow component.
<!-- config to be updated -->

### Extra Headers $(id="extraHeaders")

extraHeaders
<!-- extraHeaders to be updated -->

