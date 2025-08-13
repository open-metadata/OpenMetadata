---
title: Ldap Authentication for Docker | Official Documentation
description: Integrate LDAP-based authentication in Docker for centralized credential management and user access across containerized applications.
slug: /deployment/security/ldap/docker
collate: false
---

# Ldap Authentication for Docker

To enable LDAP for docker deployment, there are a couple of files/certificates which are required to carry out the process.
With the help of this documentation, we can provide those files/certificates to the docker container to use.
To enable security for the Docker deployment, follow the next steps:

## Ways to configure LDAP using docker
* #### [**Using Volumes**](#configure-using-volumes)
* #### [**Extending docker image**](#extend-the-openmetadata-server-docker-image)

## Configure Using Volumes
In `docker/docker-compose-quickstart/docker-compose.yml` file configure the volumes based on the `truststoreConfigType`

**NO NEED TO ADD VOLUMES IF** `truststoreConfigType` **IS** `TrustAll` **OR** `HostName`.

### **Using JVMDefault**
For docker container to access cacerts, copy the cacerts to `docker/ldap/config` and add the path in volumes.
```shell
    volumes:
      - docker/ldap/config/cacerts:/usr/lib/jvm/java-17-openjdk/lib/security/cacerts
```

### **Using CustomTrustStore**
For docker container to access your truststore, copy the truststore to `docker/ldap/config` and add the path in volumes.
```shell
    volumes:
      - docker/ldap/config/{YOUR_TRUSTSTORE}:/opt/openmetadata/ldap/truststore/{YOUR_TRUSTSTORE}
```
## Extend the OpenMetadata server docker image

Create a docker file and add the following details based on the `truststoreConfigType`.


**NO NEED TO CREATE THIS FILE IF** `truststoreConfigType` **IS** `TrustAll` **OR** `HostName`.
### **Using JVMDefault**
   For docker container to access cacerts, copy the cacerts to `docker/ldap/config` as shown below.
```shell
FROM docker.getcollate.io/openmetadata/server:0.13.2
COPY docker/ldap/config/cacerts /usr/lib/jvm/java-17-openjdk/lib/security/cacerts
```

### **Using CustomTrustStore**
   For docker container to access your truststore, copy the truststore to `docker/ldap/config` as shown below.
```shell
FROM docker.getcollate.io/openmetadata/server:0.13.2
COPY docker/ldap/config/{YOUR_TRUSTSTORE} /opt/openmetadata/ldap/truststore/{YOUR_TRUSTSTORE}
```

Run the following command from OpenMetadata root directory to create an image:
```text
docker build -f {DOCKER_FILE_PATH} -t {DOCKER_NAME}:{TAG} .
```
**NOTE:** After the image is created, in `docker/docker-compose-quickstart/docker-compose.yml` file, under openmetadata-server service replace the image name with the above created docker image.
```shell
    image: {DOCKER_NAME}:{TAG}
```

## Create an .env file

Create an openmetadata_ldap.env file and add the following contents as an example. Use the information generated when setting up the account.

Based on the different `truststoreConfigType`, we have following different `trustStoreConfig`.

### Trust Store Config Type: TrustAll

```shell
AUTHENTICATION_PROVIDER=ldap
AUTHENTICATION_LDAP_HOST={HOST}
AUTHENTICATION_LDAP_PORT={PORT}
AUTHENTICATION_LOOKUP_ADMIN_DN={ADMIN_DN}
AUTHENTICATION_LOOKUP_ADMIN_PWD={ADMIN_DN_PASSWORD}
AUTHENTICATION_USER_LOOKUP_BASEDN={USER_DN}
AUTHENTICATION_USER_MAIL_ATTR={MAIL_ATTRIBUTE}
AUTHENTICATION_LDAP_POOL_SIZE=3
AUTHENTICATION_LDAP_SSL_ENABLED=true
AUTHENTICATION_LDAP_TRUSTSTORE_TYPE=TrustAll
AUTHENTICATION_LDAP_EXAMINE_VALIDITY_DATES=true
```

### Trust Store Config Type: JVMDefault

```shell
AUTHENTICATION_PROVIDER=ldap
AUTHENTICATION_LDAP_HOST={HOST}
AUTHENTICATION_LDAP_PORT={PORT}
AUTHENTICATION_LOOKUP_ADMIN_DN={ADMIN_DN}
AUTHENTICATION_LOOKUP_ADMIN_PWD={ADMIN_DN_PASSWORD}
AUTHENTICATION_USER_LOOKUP_BASEDN={USER_DN}
AUTHENTICATION_USER_MAIL_ATTR={MAIL_ATTRIBUTE}
AUTHENTICATION_LDAP_POOL_SIZE=3
AUTHENTICATION_LDAP_SSL_ENABLED=true
AUTHENTICATION_LDAP_TRUSTSTORE_TYPE=TrustAll
AUTHENTICATION_LDAP_SSL_VERIFY_CERT_HOST=true
```

### Trust Store Config Type: HostName

```shell
AUTHENTICATION_PROVIDER=ldap
AUTHENTICATION_LDAP_HOST={HOST}
AUTHENTICATION_LDAP_PORT={PORT}
AUTHENTICATION_LOOKUP_ADMIN_DN={ADMIN_DN}
AUTHENTICATION_LOOKUP_ADMIN_PWD={ADMIN_DN_PASSWORD}
AUTHENTICATION_USER_LOOKUP_BASEDN={USER_DN}
AUTHENTICATION_USER_MAIL_ATTR={MAIL_ATTRIBUTE}
AUTHENTICATION_LDAP_POOL_SIZE=3
AUTHENTICATION_LDAP_SSL_ENABLED=true
AUTHENTICATION_LDAP_TRUSTSTORE_TYPE=TrustAll
AUTHENTICATION_LDAP_ALLOW_WILDCARDS=false
AUTHENTICATION_LDAP_ALLOWED_HOSTNAMES={[ACCEPTABLE_HOSTNAMES]}
```

### Trust Store Config Type: CustomTrustStore

```shell
AUTHENTICATION_PROVIDER=ldap
AUTHENTICATION_LDAP_HOST={HOST}
AUTHENTICATION_LDAP_PORT={PORT}
AUTHENTICATION_LOOKUP_ADMIN_DN={ADMIN_DN}
AUTHENTICATION_LOOKUP_ADMIN_PWD={ADMIN_DN_PASSWORD}
AUTHENTICATION_USER_LOOKUP_BASEDN={USER_DN}
AUTHENTICATION_USER_MAIL_ATTR={MAIL_ATTRIBUTE}
AUTHENTICATION_LDAP_POOL_SIZE=3
AUTHENTICATION_LDAP_SSL_ENABLED=true
AUTHENTICATION_LDAP_TRUSTSTORE_TYPE=TrustAll
AUTHENTICATION_LDAP_TRUSTSTORE_PATH={TRUSTSTORE_FILEPATH}
AUTHENTICATION_LDAP_KEYSTORE_PASSWORD={TRUSTSTORE_PASSWORD}
AUTHENTICATION_LDAP_SSL_KEY_FORMAT={FORMAT} # JKS, PKCS12
AUTHENTICATION_LDAP_SSL_VERIFY_CERT_HOST=true
AUTHENTICATION_LDAP_EXAMINE_VALIDITY_DATES=true
```

## Start Docker

```commandline
docker compose --env-file ~/openmetadata_ldap.env up -d
```

{% partial file="/v1.9/deployment/configure-ingestion.md" /%}
