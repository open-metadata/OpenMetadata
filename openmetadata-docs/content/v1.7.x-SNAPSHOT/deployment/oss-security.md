---
title: OSS Security Best Practices
slug: /deployment/oss-security
collate: false
---

# OSS Security

## Encryption of Connection Credentials

OpenMetadata ensures that sensitive information, such as passwords and connection secrets, is securely stored.  

- **Encryption Algorithm**: OpenMetadata uses **Fernet encryption** to encrypt secrets and passwords before storing them in the database.  
- **Fernet Encryption Details**:  
  - Uses **AES-128 in CBC mode** with a strong key-based approach.  
  - **Not based on hashing or salting**, but rather an encryption/decryption method with a symmetric key.  
- **Secrets Manager Support**:  
  - Users can **avoid storing credentials** in OpenMetadata by configuring an external **Secrets Manager**.  
  - More details on setting up a Secrets Manager can be found here:  
    🔗 [Secrets Manager Documentation](https://docs.open-metadata.org/latest/deployment/secrets-manager)

## Secure Connections to Data Sources

OpenMetadata supports **encrypted connections** to various databases and services.  

- **SSL/TLS Support**:  
  - OpenMetadata allows users to configure **SSL/TLS encryption** for secure data transmission.  
  - Users can specify **SSL modes** and provide **CA certificates** for SSL validation.  
- **How to Enable SSL?**  
  - Each connector supports different SSL configurations.  
  - Follow the detailed guide for enabling SSL in OpenMetadata:  
    🔗 [Enable SSL in OpenMetadata](https://docs.open-metadata.org/latest/deployment/security/enable-ssl)

## **Additional Security Measures**  

- **Role-Based Access Control (RBAC)**: OpenMetadata allows administrators to define user roles and permissions.  
- **Authentication & Authorization**: OpenMetadata supports integration with OAuth, SAML, and LDAP for secure authentication.  
- **Data Access Control**: Users can restrict access to metadata based on policies and governance rules.

{% note %}
- **Passwords and secrets are securely encrypted** using **Fernet encryption**.  
- **Connections to data sources can be encrypted** using **SSL/TLS**.  
- **Secrets Managers** can be used to manage credentials externally.  
{% /note %}
