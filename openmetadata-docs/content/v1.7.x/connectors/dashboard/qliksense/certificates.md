---
title: Qlik Sense Certificates | `brandName` Connector Setup
description: Configure QlikSense certificate authentication for OpenMetadata dashboard connectors. Step-by-step setup guide for secure SSL/TLS connections and data integration.
slug: /connectors/dashboard/qliksense/certificates
---

# How to generate authentication certificates

OpenMetadata Uses [Qlik Engine APIs](https://help.qlik.com/en-US/sense-developer/May2023/Subsystems/EngineAPI/Content/Sense_EngineAPI/introducing-engine-API.htm) to communicate with Qlik Sense and fetch relevant metadata, and connecting to these APIs require authentication certificates as described in [these docs](https://help.qlik.com/en-US/sense-developer/May2023/Subsystems/EngineAPI/Content/Sense_EngineAPI/GettingStarted/connecting-to-engine-api.htm).


In this document we will explain how you can generate these certificates so that OpenMetadata can communicate with Qlik Sense.


# Step 1: Open Qlik Management Console (QMC)

Open your Qlik Management Console (QMC) and navigate to certificates section.

{% image
  src="/images/v1.7/connectors/qliksense/qlik-certificate-nav.png"
  alt="Navigate to certificates in QMC"
  caption="Navigate to certificates in QMC"
 /%}

# Step 2: Provide Details and Export Certificates

1. In the Machine name box, type the full computer name of the computer that you are creating the certificates for: MYMACHINE.mydomain.com or the IP address.

2. Using a password is optional. If you choose to use a password, the same password applies to exported client and server certificates.
    a. Type a password in the Certificate password box.
    b. Repeat the password in the Retype password box.
    The passwords must match.

3. Select Include secret key if you want to add a secret key to the public key.

4. From the *Export file format for certificates* field select the "Platform independent PEM-format"

{% image
  src="/images/v1.7/connectors/qliksense/qlik-export-cert.png"
  alt="Provide Certificate Details"
  caption="Provide Certificate Details"
 /%}


# Step 3: Locate the certificates

Once you have exported the certificates you can see the location of exported certificates just below the certificate details page. When you navigate to that location you will find the `root.pem`, `client.pem` & `client_key.pem` certificates which will be used by OpenMetadata.

{% image
  src="/images/v1.7/connectors/qliksense/qlik-locate-certificates.png"
  alt="Locate Certificate"
  caption="Locate Certificate"
 /%}