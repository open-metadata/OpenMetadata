---
description: This is a guide to create ingestion bot service account.
---

# Create Service Account

## Step 1: Create Service-Account

* Go to your project dashboard

![Alt text](https://user-images.githubusercontent.com/83201188/125935620-63a9c619-7e0c-49f7-a1a4-c190194a7f30.png)

* Click on **Credentials** available on the left side panel

![Alt text](https://user-images.githubusercontent.com/83201188/125935630-254cc611-f959-4c5e-b33d-73c1a09cc384.png)

* Click on **Manage service accounts** available on the centre-right side.

![Alt text](https://user-images.githubusercontent.com/83201188/125935633-cfcc4c3f-3a68-4886-a291-fd98521bc3ad.png)

* Click on **CREATE SERVICE ACCOUNT**

![Alt text](https://user-images.githubusercontent.com/83201188/125935638-e090f62e-86f0-4f14-8887-2b15d38f4f48.png)

* Provide the required service account details.

{% hint style="warning" %}
Make sure the Service Account Id is **ingestion-bot** and click on **CREATE AND CONTINUE**. If you chose a different Service Account Id, add it to the default bots list in [Configure OpenMetadata Server](https://github.com/StreamlineData/catalog/tree/3d53fa7c645ea55f846b06d0210ac63f8c38463f/docs/install/install/google-catalog-config.md)
{% endhint %}

![](../../../../.gitbook/assets/ingestion-bot-service-account.png)

* Click on **Select a role** and give the **Owner** role. Then click **Continue.**

![Alt text](https://user-images.githubusercontent.com/83201188/125935643-748b30ee-526b-473b-9c39-8b86e50605a8.png)

* Click **DONE**

![Alt text](https://user-images.githubusercontent.com/83201188/125935647-8042d108-d00a-4ced-9a01-f4c380278982.png)

* Now you should see your service account listed.

![Alt text](https://user-images.githubusercontent.com/83201188/125935649-05d6ec56-d6c1-45ac-8b57-b331c959c087.png)

## Step 2: Enable Domain-Wide Delegation

* Click on the service account in the list.

![Alt text](https://user-images.githubusercontent.com/83201188/125935649-05d6ec56-d6c1-45ac-8b57-b331c959c087.png)

* On the details page, you should see **SHOW DOMAIN-WIDE DELEGATION**

![Alt text](https://user-images.githubusercontent.com/83201188/125935652-7f4d684a-f97e-4915-8994-af8d442004a4.png)

* Click on it and enable google workspace domain-wide delegation and then click on **SAVE**

![Alt text](https://user-images.githubusercontent.com/83201188/125935654-73181d92-8e9d-43ec-accf-cba3edbe0166.png)

## How to generate Private-Key/Service-Account JSON file

* Once done with the above steps, click on **KEYS** available new to **DETAILS**

![Alt text](https://user-images.githubusercontent.com/83201188/125935657-df55ad24-303f-4c65-931b-39ebf65acf09.png)

* Click on **ADD KEY** and then **Create a new key**

![Alt text](https://user-images.githubusercontent.com/83201188/125935661-ce32b714-a67a-42fa-b989-395a29678e84.png)

* Select the format. The **JSON format** is recommended. Then click on **CREATE**

![Alt text](https://user-images.githubusercontent.com/83201188/125935663-d047f025-ae85-4cc7-9900-632586cc31be.png)

* **The private-key/service-account JSON file will be downloaded**
