# Create Server Credentials

## Step 1: Create the account

* Go to [Create Google Cloud Account](https://console.cloud.google.com)
* Click on `Create Project`

  ![Create Project](../../../.gitbook/assets/g-create-project%20%282%29%20%282%29%20%282%29%20%282%29%20%282%29.png)

## Step 2: Create a new project

* Enter the **Project name**.
* Enter the parent organization or folder in the **Location box**. That resource will be the hierarchical parent of the new project.

![Alt text](https://user-images.githubusercontent.com/83201188/123220306-73322000-d4eb-11eb-9228-cb323cd77628.png)

* Click **Create**.

## Step 3: How to configure OAuth consent

* Select the project you created above and Click on **APIs & Services** on the left-side panel.

![OAuth Consent](../../../.gitbook/assets/g-project-oauth-consent.png)

* Click on the **OAuth Consent Screen** available on the left-hand side panel.
* Provide the User Type. Chose **External** if you are testing otherwise chose **Internal**

![Alt text](https://user-images.githubusercontent.com/83201188/123220629-c4421400-d4eb-11eb-8a1c-9226ccf1f6d3.png)

* Once the user type is selected, provide the **App Information** and other details. 

![Alt text](https://user-images.githubusercontent.com/83201188/123220633-c4daaa80-d4eb-11eb-8da2-e885fb1ca6c7.png)

* Click **Save and Continue**.
* On the **Scopes Screen**, Click on **ADD OR REMOVE SCOPES** and select the scopes. Once done click on **Update**.

![Alt text](https://user-images.githubusercontent.com/83201188/125923094-02d8c3ba-580f-4b4f-8e0e-ea3067253a63.png)

* Click **Save and Continue.**

![Alt text](https://user-images.githubusercontent.com/83201188/125923694-e412b04a-2391-4afd-b436-1c5e362604b5.png)

* Click on **Back to Dashboard**.

![Alt text](https://user-images.githubusercontent.com/83201188/125923897-0277ac41-b95c-4d35-a6d0-aae25cde26b0.png)

![Alt text](https://user-images.githubusercontent.com/83201188/123220646-c73d0480-d4eb-11eb-8354-7bd961bff8a0.png)

## Step 4: Create credentials for the project:

* Once the OAuth Consent is configured, Click on **Credentials** available on the left-hand side panel.

![Alt text](https://user-images.githubusercontent.com/83201188/123220649-c7d59b00-d4eb-11eb-9762-66b4e1f60753.png)

* Click on **Create Credentials**

![Alt text](https://user-images.githubusercontent.com/83201188/123220655-c7d59b00-d4eb-11eb-96c0-711f2938ec99.png)

* Select **OAuth client ID** from the dropdown.
* Once selected, you will be asked to select the **Application Type** . Select **Web Application**

![OAuth Consent](https://user-images.githubusercontent.com/83201188/123220661-c906c800-d4eb-11eb-8ffb-5a7dbc4fc5b6.png)

* After selecting the **Application Type**, name your project and give the authorized URIs

![Create OAuth](../../../.gitbook/assets/g-create-oauth.png)

* Click **Create**
* You will get the credentials

![Alt text](https://user-images.githubusercontent.com/83201188/123220668-ca37f500-d4eb-11eb-95fb-5a7c152c432b.png)

## Step 5: Where to find the credentials

* Go to **Credentials**
* Click on the **pencil icon \(Edit OAuth Client\)** of the right side of the screen

![Alt text](https://user-images.githubusercontent.com/83201188/123220675-cad08b80-d4eb-11eb-9c46-2c7c81b02509.png)

* You will find the **client Id** and **client secret** in the top right corner

![Alt text](https://user-images.githubusercontent.com/83201188/123220680-cc01b880-d4eb-11eb-9479-1379f69a063b.png)

