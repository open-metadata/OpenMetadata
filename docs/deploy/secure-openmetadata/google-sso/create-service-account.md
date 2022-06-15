---
description: This is a guide to create ingestion bot service account.
---

# Create Service Account

## Step 1: Create Service-Account

* Navigate to your project dashboard

![](<../../../.gitbook/assets/image (21) (2) (1).png>)

* Click on **Credentials** on the left side panel

![](<../../../.gitbook/assets/image (25).png>)

* Click on **Manage service accounts** available on the center-right side.

![](<../../../.gitbook/assets/image (18) (1) (1) (1) (1) (1) (1) (1) (2).png>)

* Click on **CREATE SERVICE ACCOUNT**

![](<../../../.gitbook/assets/image (16).png>)

* Provide the required service account details.

{% hint style="warning" %}
Ensure that the Service Account ID is **ingestion-bot** and click on **CREATE AND CONTINUE**. If you chose a different Service Account Id, add it to the default bots list in [Configure OpenMetadata Server](https://github.com/StreamlineData/catalog/tree/3d53fa7c645ea55f846b06d0210ac63f8c38463f/docs/install/install/google-catalog-config.md)
{% endhint %}

![](<../../../.gitbook/assets/image (70).png>)

* Click on **Select a role** and give the **Owner** role. Then click **Continue.**

![](<../../../.gitbook/assets/image (61).png>)

* Click **DONE**

![](<../../../.gitbook/assets/image (24).png>)

* Now you should see your service account listed.

![](<../../../.gitbook/assets/image (20) (2) (1).png>)

## Step 2: Enable Domain-Wide Delegation

* Click on the service account in the list.

![](<../../../.gitbook/assets/image (29) (2) (1) (1).png>)

* On the details page, click on **SHOW DOMAIN-WIDE DELEGATION**

![](<../../../.gitbook/assets/image (50).png>)

* Enable Google Workspace Domain-wide Delegation
* Click on **SAVE**

![](<../../../.gitbook/assets/image (15) (1) (1) (1).png>)

## How to Generate Private-Key/Service-Account JSON File

* Once done with the above steps, click on **KEYS** available next to the **DETAILS** tab.
* Click on **ADD KEY** and select **Create a new key**.

![](<../../../.gitbook/assets/image (27).png>)

* Select the format. The **JSON format** is recommended.
* Next, click on **CREATE**

![](<../../../.gitbook/assets/image (35).png>)

* The private-key/service-account JSON file will be downloaded.
