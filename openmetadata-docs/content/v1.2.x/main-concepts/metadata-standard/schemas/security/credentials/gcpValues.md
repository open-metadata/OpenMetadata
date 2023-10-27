---
title: gcpValues
slug: /main-concepts/metadata-standard/schemas/security/credentials/gcpvalues
---

# GCP Credentials Values

*Pass the raw credential values provided by GCP*

## Properties

- **`type`** *(string)*: Google Cloud Platform account type.
- **`projectId`**: Project ID.
  - **One of**
    - : Refer to *[#/definitions/singleProjectId](#definitions/singleProjectId)*.
    - : Refer to *[#/definitions/multipleProjectId](#definitions/multipleProjectId)*.
- **`privateKeyId`** *(string)*: Google Cloud private key id.
- **`privateKey`** *(string, format: password)*: Google Cloud private key.
- **`clientEmail`** *(string)*: Google Cloud email.
- **`clientId`** *(string)*: Google Cloud Client ID.
- **`authUri`** *(string, format: uri)*: Google Cloud auth uri. Default: `"https://accounts.google.com/o/oauth2/auth"`.
- **`tokenUri`** *(string, format: uri)*: Google Cloud token uri. Default: `"https://oauth2.googleapis.com/token"`.
- **`authProviderX509CertUrl`** *(string, format: uri)*: Google Cloud auth provider certificate. Default: `"https://www.googleapis.com/oauth2/v1/certs"`.
- **`clientX509CertUrl`** *(string, format: uri)*: Google Cloud client certificate uri.
## Definitions

- <a id="definitions/singleProjectId"></a>**`singleProjectId`** *(string)*
- <a id="definitions/multipleProjectId"></a>**`multipleProjectId`** *(array)*
  - **Items** *(string)*


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
