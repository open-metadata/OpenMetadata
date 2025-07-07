---
title: SSL Troubleshooting | OpenMetadata Security Guide
slug: /deployment/security/enable-ssl/ssl-troubleshooting
collate: false
---

# SSL Troubleshooting

In this section we comment common issues that the user can face when enabling SSL in OpenMetadata.

## Bot using JWT as authentication mechanism

After enabling SSL on the OM server, we have to update also the public keys URL for the validation of the JWT tokens by 
updating to the secured URL: `https://{server_domain}:{port}/api/v1/system/config/jwks`.

In case we are using a self-signed certificate, it will fail with the error below:

{% image
src="/images/v1.7/deployment/enable-ssl/500-error-ssl.png"
alt="500-error-ssl"
caption="Verify config is correct: 500 Server Error"
 /%}

To avoid this error, you must import your public certificate into the Java Keystore of the OM server. If your OM 
deployment is done with Docker or Kubernetes, you must copy the cert into the `openmetadata_server` container or pod. 
After that, you can proceed with the following steps from your terminal:

1. Go to your $JAVA_HOME/lib/security where the **cacerts** keystore is located.

2. Run the following command once in the directory:

```bash
keytool -import -trustcacerts -keystore cacerts -storepass changeit -noprompt -alias localhost -file /path/to/public.cert
```

After that, you can restart the server, and the error 500 will disappear.

## Deploying workflows in Airflow

One common issue after enabling SSL with a self-signed certificate is that our workflows in Airflow will fail or will 
not be deployed. We can notice it because the following error will be shown in the UI when deploying or re-deploying:

{% image
src="/images/v1.7/deployment/enable-ssl/handshake-error-ssl.png"
alt="handshake-error-ssl"
caption="SSLError when SSL is enabled during ingestion"
 /%}

This can be solved in two different ways:

#### 1. Validate the certificate using the public certificate (recommended):

We specify which public certificate must be used to validate the OM server connection.

1. Copy the public certificate into our Airflow instance.
2. Update the configuration of our OM server so that each time a workflow is deployed, we send the new configuration.

- In **docker**:

```yaml
PIPELINE_SERVICE_CLIENT_VERIFY_SSL=validate
PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH=/path/to/certificate/in/airflow
```

- In **bare metal**:

Edit the `conf/openmetadata.yaml` file:

```yaml
pipelineServiceClientConfiguration:
  verifySSL: "validate"
  sslConfig:
    certificatePath: "/path/to/certificate/in/airflow"
```

- In **K8s**:

We have to update in the `values.yaml` file with:

```yaml
openmetadata:
  config:
    pipelineServiceClientConfig:
      verifySsl: "validate"
      sslCertificatePath: "/path/to/certificate/in/airflow"
```

#### 2. Ignore the certification validation (not recommended for production):

When doing any call to the secured OM server, the certificate validation will be ignored.

- In **docker**:

```yaml
PIPELINE_SERVICE_CLIENT_VERIFY_SSL=ignore
```

- In **bare metal**:

Edit the `conf/openmetadata.yaml` file:

```yaml
pipelineServiceClientConfiguration:
  verifySSL: "ignore"
```

- In **K8s**:

We have to update in the `values.yaml` file with:

```yaml
openmetadata:
  config:
    pipelineServiceClientConfig:
      verifySsl: "ignore"
```

Once one of the configurations is set, we can restart our OM server and deploy or redeploy without any issues.

## Ingesting from CLI

Similar to what happens when deploying workflows in Airflow, we have to update our workflow config file with one of 
these options:

- To validate our certificate:

```yaml
workflowConfig:
  openMetadataServerConfig:
    verifySSL: validate
    sslConfig:
      caCertificate: /local/path/to/certificate
```

- To ignore certificate validation:

```yaml
workflowConfig:
  openMetadataServerConfig:
    verifySSL: ignore
```

## Demo of SSL enabled with an SSO and JWT token configured 

In case you are looking for a full dockerized demo of how JWT tokens, SSO configuration, and SSL enabled work together,
please visit our demo repository [here](https://github.com/open-metadata/openmetadata-demo/tree/main/sso-with-ssl).

## Providing a single keystore that has all the cacerts required

This can be achieved using the `OPENMETADATA_OPTS` environment variable configuration across all the deployments.
However, for Production, we recommend you to bundle your cacerts separately for each components (like ElasticSearch/Opensearch and Airflow) and provide that to each individual configs for [openmetadata.yaml](https://github.com/open-metadata/OpenMetadata/blob/main/conf/openmetadata.yaml). 
You can use this environment variable to also provide extra JVM parameters to tune the application as per your infrastructure needs.

Below is an example values to be set for the `OPENMETADATA_OPTS` environment variable to use cacerts truststore which is bundled for an organization issued certificates -

```bash
OPENMETADATA_OPTS="-Djavax.net.ssl.trustStore=<path/to/truststore/file> -Djavax.net.ssl.trustStorePassword=<TRUSTSTORE_PASSWORD>"
```

{%important%}

It is expected to have the keystore file either mounted as external volume or to be available over the filesystem where openmetadata server application will be running.

{%/important%}
