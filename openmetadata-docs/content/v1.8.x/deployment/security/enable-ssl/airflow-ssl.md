---
title: Enable SSL in Airflow | OpenMetadata Security Guide
description: Enable SSL for Airflow-based deployments to secure metadata transport, authentication, and configuration endpoints.
slug: /deployment/security/enable-ssl/airflow
collate: false
---

# Configure OpenMetadata certificates in Airflow

{% note %}

Follow this section if you added SSL certs in the OpenMetadata server.

{% /note %}

The OpenMetadata configuration related to Airflow (or in general, the Pipeline Service Client) is the following:

```yaml
pipelineServiceClientConfiguration:
  # ...
  # This SSL information is about the OpenMetadata server.
  # It will be picked up from the pipelineServiceClient to use/ignore SSL when connecting to the OpenMetadata server.
  verifySSL: ${PIPELINE_SERVICE_CLIENT_VERIFY_SSL:-"no-ssl"} # Possible values are "no-ssl", "ignore", "validate"
  sslConfig:
    certificatePath: ${PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH:-""} # Local path for the Pipeline Service Client
```

Then, in order to add this, you can either update the `openmetadata.yaml` config if your deployment is Bare Metal,
or update the following environment variables:

- `PIPELINE_SERVICE_CLIENT_VERIFY_SSL=validate`
- `PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH="path/to/cert`

Note that the `PIPELINE_SERVICE_CLIENT_SSL_CERT_PATH` should be the path to the certificate you generated
[here](/deployment/security/enable-ssl), and it should be the local path
in your Airflow deployment.


# Enable SSL in Airflow

{% note %}

Follow this section if you want to add SSL certificates in Airflow.

This will secure the connection from the OpenMetadata to Airflow.

{% /note %}

Airflow has two [configurations](https://airflow.apache.org/docs/apache-airflow/stable/configurations-ref.html#web-server-ssl-cert) to be added in `airflow.cfg` to enable SSL:
- `AIRFLOW__WEBSERVER__WEB_SERVER_SSL_CERT`
- `AIRFLOW__WEBSERVER__WEB_SERVER_SSL_KEY`

Those are files that will need to be local to the Airflow deployment.

## Generate Certs

We can generate these files following this [SO](https://stackoverflow.com/questions/47883769/how-to-enable-ssl-on-apache-airflow) thread:

```bash
openssl req \
       -newkey rsa:2048 -nodes -keyout airflow.key \
       -x509 -days 365 -out airflow.crt
```

and we can provide the following answers to try this locally:

```
Country Name (2 letter code) []:US
State or Province Name (full name) []:CA
Locality Name (eg, city) []:San Francisco
Organization Name (eg, company) []:OpenMetadata
Organizational Unit Name (eg, section) []:OpenMetadata
Common Name (eg, fully qualified host name) []:localhost
Email Address []:local@openmetadata.org
```

{% note %}

It is important that the `Common Name` is the host name that will be hosting Airflow. 

{% /note %}

This command will generate the pair `airflow.key` and `airflow.crt`.

## Include Certificates

Once the files are generated we need to add them to the Airflow deployment. For example, if using the `openmetadata-ingestion`
image, you can update it to add the following lines:

```dockerfile
# SET SSL
COPY --chown=airflow:0 ingestion/airflow.key /opt/airflow
COPY --chown=airflow:0 ingestion/airflow.crt /opt/airflow
ENV AIRFLOW__WEBSERVER__WEB_SERVER_SSL_CERT=/opt/airflow/airflow.crt
ENV AIRFLOW__WEBSERVER__WEB_SERVER_SSL_KEY=/opt/airflow/airflow.key
```

If you now start Airflow with these changes, it will be running at `https://localhost:8080`.

## Update the OpenMetadata configuration

Since Airflow will be using SSL, we need to update the OpenMetadata Server configuration to use the certificates
when preparing the connection to the Airflow Webserver.

The `pipelineServiceClientConfiguration` will look like the following:

```yaml
pipelineServiceClientConfiguration:
  [...]

  parameters:
      username: ${AIRFLOW_USERNAME:-admin}
      password: ${AIRFLOW_PASSWORD:-admin}
      timeout: ${AIRFLOW_TIMEOUT:-10}
      # If we need to use SSL to reach Airflow
      truststorePath: ${AIRFLOW_TRUST_STORE_PATH:-""}
      truststorePassword: ${AIRFLOW_TRUST_STORE_PASSWORD:-""}
```

Update the `truststorePath` and `truststorePassword` accordingly, pointing to the `keystore` in your server host
holding the certificates we created.

For docker deployments, you will provide OpenMetadata Server Application with the self signed certificates of Airflow bundled in JVM keystore.
These will be passed to the application using `AIRFLOW_TRUST_STORE_PATH` and `AIRFLOW_TRUST_STORE_PASSWORD` environment variable.

```
AIRFLOW_TRUST_STORE_PATH="<path/to/truststore.jks>"
AIRFLOW_TRUST_STORE_PASSWORD="<JVM_TRUSTSTORE_PASSWORD>"
```
Please make sure to have the the truststore file mounted and available as part of Docker Deployments.

For kubernetes deployments, update the helm values as below -

```yaml
extraEnvs:
- name: AIRFLOW_TRUST_STORE_PASSWORD
  valueFrom:
    secretKeyRef:
      name: truststore-password-secret
      key: password
- name: AIRFLOW_TRUST_STORE_PATH
  value: "/etc/openmetadata/certs/truststore.jks>"
extraVolumes:
- name: jks-vol
  secret:
    secretName: jks-certs
extraVolumeMounts:
- name: jks-vol
  mountPath: /etc/openmetadata/certs
  readOnly: true
```

In the above code snippet, we are mounting the volumes of truststore file from a kubernetes secret. You can create the secret from `truststore.jks` file from the below `kubectl` command -

```bash
kubectl create secret generic jks-certs --from-file truststore.jks --namespace <NAMESPACE_NAME>
kubectl create secret generic truststore-password-secret --from-literal password=<YOUR_TRUSTSTORE_PASSWORD> --namespace <NAMESPACE_NAME>
```

Next, restart or redeploy openmetadata application to take the above configs in effect.

### Example: Setting it locally

For example, if we are running the server locally, we need to add the certificate to the JVM `cacerts` store:

```bash
sudo keytool -import -trustcacerts -keystore cacerts -storepass changeit -noprompt -alias localhost -file /path/to/airflow.crt
```

Then, the values of the YAML config would be something similar to:

```yaml
    truststorePath: "/Library/Java/JavaVirtualMachines/amazon-corretto-11.jdk/Contents/Home/lib/security/cacerts"
    truststorePassword: "changeit"
```

Make sure to update these values to the ones in your host. Also, it's always preferred to use environment variables
instead of hardcoding sensitive information.
