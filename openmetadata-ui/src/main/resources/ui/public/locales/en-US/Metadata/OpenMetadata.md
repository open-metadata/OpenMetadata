# OpenMetadata

In this section, we provide guides and references to use the OpenMetadata connector.

## Requirements
<!-- to be updated -->
You can find further information on the Kafka connector in the <a href="https://docs.open-metadata.org/connectors/metadata/openmetadata" target="_blank">docs</a>.

## Connection Details

$$section
### Cluster Name $(id="clusterName")

Cluster name to differentiate OpenMetadata Server instance
<!-- clusterName to be updated -->
$$

$$section
### Host Port $(id="hostPort")

OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api
<!-- hostPort to be updated -->
$$

$$section
### Auth Provider $(id="authProvider")

OpenMetadata Server Authentication Provider. Make sure configure same auth providers as the one configured on OpenMetadata server.
<!-- authProvider to be updated -->
$$

$$section
### Verify SSL $(id="verifySSL")

Client SSL verification. Make sure to configure the SSLConfig if enabled.
<!-- verifySSL to be updated -->
$$

$$section
### Ssl Config $(id="sslConfig")

Client SSL configuration
<!-- sslConfig to be updated -->
$$

$$section
### Certificate Path $(id="certificatePath")

CA certificate path. E.g., /path/to/public.cert. Will be used if Verify SSL is set to `validate`.
<!-- certificatePath to be updated -->
$$

$$section
### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->
$$

$$section
### Secret Key $(id="secretKey")

Custom OIDC Client Secret Key.
<!-- secretKey to be updated -->
$$

$$section
### Audience $(id="audience")

Google SSO audience URL
<!-- audience to be updated -->
$$

$$section
### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->
$$

$$section
### Client ID $(id="clientId")

Custom OIDC Client ID.
<!-- clientID to be updated -->
$$

$$section
### Org URL $(id="orgURL")

Okta org url.
<!-- orgURL to be updated -->
$$

$$section
### Private Key $(id="privateKey")

Okta Private Key.
<!-- privateKey to be updated -->
$$

$$section
### Email $(id="email")

Okta Service account Email.
<!-- email to be updated -->
$$

$$section
### Scopes $(id="scopes")

Azure Client ID.
<!-- scopes to be updated -->
$$

$$section
### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->
$$

$$section
### Client ID $(id="clientId")

Custom OIDC Client ID.
<!-- clientID to be updated -->
$$

$$section
### Secret Key $(id="secretKey")

Custom OIDC Client Secret Key.
<!-- secretKey to be updated -->
$$

$$section
### Domain $(id="domain")

Auth0 Domain.
<!-- domain to be updated -->
$$

$$section
### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->
$$

$$section
### Client Secret $(id="clientSecret")

Azure SSO client secret key
<!-- clientSecret to be updated -->
$$

$$section
### Authority $(id="authority")

Azure SSO Authority
<!-- authority to be updated -->
$$

$$section
### Client ID $(id="clientId")

Custom OIDC Client ID.
<!-- clientID to be updated -->
$$

$$section
### Scopes $(id="scopes")

Azure Client ID.
<!-- scopes to be updated -->
$$

$$section
### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->
$$

$$section
### Client ID $(id="clientId")

Custom OIDC Client ID.
<!-- clientID to be updated -->
$$

$$section
### Secret Key $(id="secretKey")

Custom OIDC Client Secret Key.
<!-- secretKey to be updated -->
$$

$$section
### Token Endpoint $(id="tokenEndpoint")

Custom OIDC token endpoint.
<!-- tokenEndpoint to be updated -->
$$

$$section
### Security Config $(id="securityConfig")

OpenMetadata Client security configuration.
<!-- securityConfig to be updated -->
$$

$$section
### Jwt Token $(id="jwtToken")

OpenMetadata generated JWT token.
<!-- jwtToken to be updated -->
$$

$$section
### Secrets Manager Provider $(id="secretsManagerProvider")

OpenMetadata Secrets Manager Provider. Make sure to configure the same secrets manager providers as the ones configured on the OpenMetadata server.
<!-- secretsManagerProvider to be updated -->
$$

$$section
### Secrets Manager Credentials $(id="secretsManagerCredentials")

OpenMetadata Secrets Manager Client credentials
<!-- secretsManagerCredentials to be updated -->
$$

$$section
### AWS Access Key ID $(id="awsAccessKeyId")

AWS Access key ID.
<!-- awsAccessKeyID to be updated -->
$$

$$section
### AWS Secret Access Key $(id="awsSecretAccessKey")

AWS Secret Access Key.
<!-- awsSecretAccessKey to be updated -->
$$

$$section
### AWS Region $(id="awsRegion")

AWS Region
<!-- awsRegion to be updated -->
$$

$$section
### AWS Session Token $(id="awsSessionToken")

AWS Session Token.
<!-- awsSessionToken to be updated -->
$$

$$section
### Endpoint URL $(id="endPointURL")

EndPoint URL for the AWS
<!-- endPointURL to be updated -->
$$

$$section
### Profile Name $(id="profileName")

The name of a profile to use with the boto session.
<!-- profileName to be updated -->
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")

The Amazon Resource Name (ARN) of the role to assume. Required Field in case of Assume Role
<!-- assumeRoleARN to be updated -->
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons. Required Field in case of Assume Role
<!-- assumeRoleSessionName to be updated -->
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The Amazon Resource Name (ARN) of the role to assume. Optional Field in case of Assume Role
<!-- assumeRoleSourceIdentity to be updated -->
$$

$$section
### Api Version $(id="apiVersion")

OpenMetadata server API version to use.
<!-- apiVersion to be updated -->
$$

$$section
### Include Topics $(id="includeTopics")

Include Topics for Indexing
<!-- includeTopics to be updated -->
$$

$$section
### Include Tables $(id="includeTables")

Include Tables for Indexing
<!-- includeTables to be updated -->
$$

$$section
### Include Dashboards $(id="includeDashboards")

Include Dashboards for Indexing
<!-- includeDashboards to be updated -->
$$

$$section
### Include Pipelines $(id="includePipelines")

Include Pipelines for Indexing
<!-- includePipelines to be updated -->
$$

$$section
### Include Ml Models $(id="includeMlModels")

Include MlModels for Indexing
<!-- includeMlModels to be updated -->
$$

$$section
### Include Users $(id="includeUsers")

Include Users for Indexing
<!-- includeUsers to be updated -->
$$

$$section
### Include Teams $(id="includeTeams")

Include Teams for Indexing
<!-- includeTeams to be updated -->
$$

$$section
### Include Glossary Terms $(id="includeGlossaryTerms")

Include Glossary Terms for Indexing
<!-- includeGlossaryTerms to be updated -->
$$

$$section
### Include Tags $(id="includeTags")

Include Tags for Indexing
<!-- includeTags to be updated -->
$$

$$section
### Include Policy $(id="includePolicy")

Include Tags for Policy
<!-- includePolicy to be updated -->
$$

$$section
### Include Messaging Services $(id="includeMessagingServices")

Include Messaging Services for Indexing
<!-- includeMessagingServices to be updated -->
$$

$$section
### Enable Version Validation $(id="enableVersionValidation")

Validate Openmetadata Server & Client Version.
<!-- enableVersionValidation to be updated -->
$$

$$section
### Include Database Services $(id="includeDatabaseServices")

Include Database Services for Indexing
<!-- includeDatabaseServices to be updated -->
$$

$$section
### Include Pipeline Services $(id="includePipelineServices")

Include Pipeline Services for Indexing
<!-- includePipelineServices to be updated -->
$$

$$section
### Limit Records $(id="limitRecords")

Limit the number of records for Indexing.
<!-- limitRecords to be updated -->
$$

$$section
### Force Entity Overwriting $(id="forceEntityOverwriting")

Force the overwriting of any entity during the ingestion.
<!-- forceEntityOverwriting to be updated -->
$$

$$section
### Elastics Search $(id="elasticsSearch")

Configuration for Sink Component in the OpenMetadata Ingestion Framework.
<!-- elasticsSearch to be updated -->
$$

$$section
### Config $(id="config")

key/value pairs to pass to workflow component.
<!-- config to be updated -->
$$

$$section
### Extra Headers $(id="extraHeaders")

extraHeaders
<!-- extraHeaders to be updated -->
$$
