---
title: SAML AWS SSO Setup | Configure AWS IAM Identity Center for Collate
description: Learn to set up SAML SSO using AWS IAM Identity Center. Follow step-by-step instructions to configure OpenMetadata access and share metadata with Collate.
slug: /security/saml/aws
collate: true
---

# SAML AWS SSO

Follow the sections in this guide to set up AWS SSO using SAML.

{% note %}

Security requirements for your **production** environment:
- **DELETE** the admin default account shipped by OM.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is enabled.

{% /note %}

## Create OpenMetadata application

### Step 1: Configure a new Application in AWS Console

- Login to [AWS Console](https://aws.amazon.com/console/) as an administrator and search for IAM Identity Center.

{% image src="/images/v1.8/deployment/security/saml/aws/saml-aws-1.png" alt="IAM-Identity-Center" /%}

- Click on `Choose your identity source` and configure as per security requirements.

{% image src="/images/v1.8/deployment/security/saml/aws/saml-aws-2.png" alt="identity-source" /%}

- After identity source is set up successfully, goto step 2 and click on `Manage Access to application` and add all the required users who need access to application.

{% image src="/images/v1.8/deployment/security/saml/aws/saml-aws-3.png" alt="manage-access" /%}

- Click on `Set up Identity Center enabled applications`, and click  `Add application`, and select `Add custom SAML 2.0 application`.

{% image src="/images/v1.8/deployment/security/saml/aws/saml-aws-4.png" alt="saml-application" /%}

- Set Display Name to `OpenMetadata` , and download the metadata xml file and save it someplace safe, it is needed to setup OM Server

{% image src="/images/v1.8/deployment/security/saml/aws/saml-aws-5.png" alt="metadata-xml" /%}

- Click on `Manage assignments to your cloud applications` and select `OpenMetadata` from list of applications.

- Click on `Actions` and select `Edit Configurations` from list. Populate the shown values replacing  `localhost:8585` with your `{domain}:{port}` and Submit.

{% image src="/images/v1.8/deployment/security/saml/aws/saml-aws-6.png" alt="edit-configuration" /%}

- Click on `Actions` again and select `Edit Attribute Mapping` from list. Populate the values as shown below and submit

{% image src="/images/v1.8/deployment/security/saml/aws/saml-aws-7.png" alt="edit-attribute" /%}

Send the Collate team the above information to configure the server.
