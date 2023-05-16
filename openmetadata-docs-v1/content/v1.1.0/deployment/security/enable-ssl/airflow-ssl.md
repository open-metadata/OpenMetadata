---
title: Enable SSL in Airflow
slug: /deployment/security/enable-ssl/airflow
---

# Enable SSL in Airflow

This will be part of OpenMetadata 1.1.

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
