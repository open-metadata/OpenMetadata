---
description: >-
  This document will explain how to create a project in Google Cloud and
  configure it for OAuth. This will generate the information required for Single
  Sign On with Google SSO.
---

# Create Server Credentials

## Step 1: Create the Account

* Go to [Create Google Cloud Account](https://console.cloud.google.com)
* Click on `Create Project`

![](<../../../.gitbook/assets/image (64).png>)

## Step 2: Create a New Project

* Enter the **Project name**.
* Enter the parent organization or folder in the **Location box**. That resource will be the hierarchical parent of the new project.
* Click **Create**.

![](<../../../.gitbook/assets/image (26).png>)

## Step 3: How to Configure OAuth Consent

* Select the project you created above and click on **APIs & Services** on the left-side panel.

![](<../../../.gitbook/assets/image (60).png>)

* Click on the **OAuth Consent Screen** available on the left-hand side panel.
* Provide the User Type.
  * Chose **External** if you are testing,
  * Otherwise chose **Internal**

![](<../../../.gitbook/assets/image (52) (2) (1) (2).png>)

* Once the user type is selected, provide the **App Information** and other details.
* Click **Save and Continue**.

![](<../../../.gitbook/assets/image (63).png>)

* On the **Scopes Screen**, Click on **ADD OR REMOVE SCOPES** and select the scopes.
* Once done click on **Update**.

![](<../../../.gitbook/assets/image (44) (2) (1).png>)

* Click **Save and Continue**.

![](<../../../.gitbook/assets/image (66).png>)

* Click on **Back to Dashboard**.

![](<../../../.gitbook/assets/image (30).png>)

![](<../../../.gitbook/assets/image (38).png>)

## Step 4: Create Credentials for the Project

* Once the OAuth Consent is configured, click on **Credentials** available on the left-hand side panel.

![](<../../../.gitbook/assets/image (65).png>)

* Click on **Create Credentials**
* Select **OAuth client ID** from the dropdown.

![](<../../../.gitbook/assets/image (79).png>)

* Once selected, you will be asked to select the **Application type**. Select **Web application**.

![](<../../../.gitbook/assets/image (81).png>)

* After selecting the **Application Type**, name your project and give the authorized URIs.

![](<../../../.gitbook/assets/image (56).png>)

* Click **Create**
* You will get the credentials

![](<../../../.gitbook/assets/image (12) (1) (2) (1).png>)

## Step 5: Where to Find the Credentials

* Go to **Credentials**
* Click on the **pencil icon (Edit OAuth Client)** on the right side of the screen

![](<../../../.gitbook/assets/image (49).png>)

* You will find the **Client ID** and **Client Secret** in the top right corner

![](<../../../.gitbook/assets/image (17) (2) (1) (1) (1) (1) (1).png>)
