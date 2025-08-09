---
title: SAML SSO Integration | Configure Identity Provider for Collate
description: Set up SAML SSO for Collate. Configure Identity and Service Providers, manage JWT settings, and enable secure authentication with providers like AWS or Azure.
slug: /security/saml
collate: true
---

# SAML SSO

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is enabled.

{% /note %}

## Configuring Identity Provider and Service Provider

### Identity Provide (IDP) Configuration

- Every IDP will have the following information

1. EntityId/Authority -> Same as IDP Openmetadata has an Entity Id
2. SignOn Url -> Service Provider SignOn Url
3. X509 Certificate -> In case the SP expects (wantAuthnRequestSigned) then provide certificate for validating.
4. Authority Url -> We just need to update the domain `localhost`.
5. NameID: This is sent as part of request and is provided by the IDP.

Every IDP provides this information, we can download the XML Metadata and configure the OM taking the values from the XML.

### Service Provider (SP) Configuration

- Openmetadata is the service provider, we just update the `localhost` to the hosted URI.

1. EntityId/Authority -> Normally a Url providing info about the provider.
2. SignOn Url -> Url to be used for signing purpose.
3. X509 Certificate -> In case the SP expects a signed response from IDP, the IDP can be configured with Signing Certificate given by SP.
4. Private Key -> In case SP expects a encrypted response from the IDP , the IDP can be  configured with SPs public key for encryption and the Private Key can be used for SP for decrypting.

### Security Configuration

Security Configuration controls the SP requirement for the Security related aspects.
The SP can be configured to send signed or encrypted or both request , and in return can also expect 
signed or encrypted or both responses from the IDP.

## Setup JWT Configuration

Jwt Configuration is mandatory for Saml SSO.

- Follow the guide here for JWT Configuration [Enable JWT Token](/deployment/security/enable-jwt-tokens).

{% note %}

Security requirements for your **production** environment:
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) the ones shipped with OM are for POC only.

{% /note %}

More specific details on different IDPs can be found below:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="celebration"
    bold="AWS Saml"
    href="/security/saml/aws" %}
    Configure AWS as IDP.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Azure Saml"
href="/security/saml/azure" %}
Configure AWS as IDP.
{% /inlineCallout %}
{% /inlineCalloutContainer %}
