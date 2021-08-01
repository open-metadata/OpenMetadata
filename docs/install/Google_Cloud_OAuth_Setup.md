# How to use google cloud for oauth
**This document is all about how to create the Google cloud project and configure it for oauth.
It will generate several information which is required to perform a single-signon activity using Google.**

## Step 1: Create the account

* **Go to [Create Google Cloud Account](https://console.cloud.google.com)**

* **Click on `Create Project`**

## Step 2: Create a new project

* **Enter the `Project name`. A project name can contain only letters, numbers, single quotes, hyphens, spaces, or exclamation points, and must be between 4 and 30 characters.**

* **Enter the parent organization or folder in the `Location box`. That resource will be the hierarchical parent of the new project.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220306-73322000-d4eb-11eb-9228-cb323cd77628.png)
****
* **Click `Create`.**

## Step 3: How to configure OAuth consent

* **Click on the `OAuth Consent Screen` available on the left-hand side panel.**

* **Provide the User Type.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220629-c4421400-d4eb-11eb-8a1c-9226ccf1f6d3.png)
****
* **Once the user type is selected, provide the `App Information` and other details. Only providing the required details will do the work.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220633-c4daaa80-d4eb-11eb-8da2-e885fb1ca6c7.png)
****
* **Click `Save and Continue`.**

* **On the `Scopes Screen`, Click `Save and Continue`.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220636-c5734100-d4eb-11eb-8f96-545390a4ef70.png)
****
* **Click on `Back to Dashboard`.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220641-c60bd780-d4eb-11eb-8029-eac1c94c2cbf.png)
****
* **You are now done.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220646-c73d0480-d4eb-11eb-8354-7bd961bff8a0.png)

## Step 4: Create credentials for the project:

* **Once the OAuth Consent is configured, Click on `Credentials` available on the left-hand side panel.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220649-c7d59b00-d4eb-11eb-9762-66b4e1f60753.png)
****
* **Click on `Create Credentials`.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220655-c7d59b00-d4eb-11eb-96c0-711f2938ec99.png)
****
* **Select `OAuth client ID` from the dropdown.**

* **Once selected, you will be asked to select the `Application Type`.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220661-c906c800-d4eb-11eb-8ffb-5a7dbc4fc5b6.png)
****
* **After selecting the `Application Type`, name your project and give the authorized URIs(Optional).**

![Alt text](https://user-images.githubusercontent.com/83201188/123220665-c99f5e80-d4eb-11eb-9aa9-a0a3572962e7.png)
****
* **Click `Create`.**

* **You will get the credentials.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220668-ca37f500-d4eb-11eb-95fb-5a7c152c432b.png)
****
## Step 5: Where to find the credentials

* **Go to `Credentials` like in Step 4.**

* **Click on the pencil icon (Edit OAuth Client) of the right side of the screen.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220675-cad08b80-d4eb-11eb-9c46-2c7c81b02509.png)
****
* **You will find the `client Id` and `client secret` in the top right corner.**

![Alt text](https://user-images.githubusercontent.com/83201188/123220680-cc01b880-d4eb-11eb-9479-1379f69a063b.png)
****

## Step 6: Adding the details in Catalog.yaml

* **Once the `Client Id` and `Client secret` is generated.
  Add the `Client Id` in catalog-security.yaml file in `client_id` field.**


![Alt text](https://user-images.githubusercontent.com/83201188/123221536-ade88800-d4ec-11eb-9c49-d7ce16eecb7d.png)
****
