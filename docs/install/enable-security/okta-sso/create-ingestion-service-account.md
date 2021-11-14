---
description: This is a guide to create ingestion bot service app.
---

# Create Service Account

## Step 1: Generate Public/Private key pair

* Use a tool such as this JSON [Web Key Generator](https://mkjwk.org) to generate a JWKS public/private key pair for testing.
* For a production use case, use your own [internal instance](https://github.com/mitreid-connect/mkjwk.org) of the key pair generator.
* For production use case, clone the repository using `git clone https://github.com/mitreid-connect/mkjwk.org.git`.
* Use `mvn package -DskipTests && java -jar target/ROOT.war` to run the above repo.
* Go to `http:localhost:8080` to generate **public/private key pairs**.

![Alt text](https://user-images.githubusercontent.com/83201188/126946539-cb31793d-7616-4343-821b-8e190d626b63.png)

* Enter the following values to generate a **public/private key pair**:
  * Key size - 2048
  * Key use — signature
  * Algorithm — RSA256
  * Key ID — (Optional) This can be any random value.

![Alt text](https://user-images.githubusercontent.com/83201188/126946546-1e86ae45-2774-4217-925e-f423053a7a1d.png)

* Once you provide the input, click **Generate**. You will get the **Public/Private Keypair**, **Public/Private Keypair Set,** and **Public Key**

![Alt text](https://user-images.githubusercontent.com/83201188/126946550-ec9fa2b3-0a47-4fe1-ac32-7e326b3f7d45.png)

## Step 2: Create Service-App

* You will need to make a **POST** request to `https://${yourOktaDomain}/oauth2/v1/clients` endpoint to create a service app in okta
* The parameters involved in the request are:
  * **client_name** - the name of the service app
  * **grant_type** - **client_credentials**
  * **token_endpoint_auth_method** — **private_key_jwt**
  * **application_type** — **service**
  * **jwks** — add the **Public/Private Keypair Set** that you created in the previous step.
* The request looks something like this:

![Alt text](https://user-images.githubusercontent.com/83201188/126946556-01bfab7b-1a3a-48da-8661-e01071af66db.png)

* To check if the service app is created navigate to your **Okta Dashboard**.

![Alt text](https://user-images.githubusercontent.com/83201188/126946567-23178d0d-baff-4a3b-8401-330353db1b88.png)

* Click on **Applications -> Applications** on the left side.

![Alt text](https://user-images.githubusercontent.com/83201188/126946558-89969475-c23b-4338-8681-6da66b2c2486.png)

* You should see your service account in the list.

![Alt text](https://user-images.githubusercontent.com/83201188/126948899-3fddfaa6-a881-446a-bf2d-9ccf417275e3.png)

## Step 3: Grant allowed scopes

* To add a grant for an allowed scope to your service app, we need to make a **POST** request to `https://${yourOktaDomain}/api/v1/apps/{serviceappclient_id}/grants` endpoint.
* The parameters involved in the request are:
  * **scopeID** — **okta.clients.manage**
* The request looks something like this:

![Alt text](https://user-images.githubusercontent.com/83201188/126947013-8ba3bf00-26ad-457f-bba4-dab2b022c073.png)

* You can also add scopes by navigating to your **Okta Dashboard** and Clicking on **Applications -> Applications** just like in step 2.

![Alt text](https://user-images.githubusercontent.com/83201188/126946558-89969475-c23b-4338-8681-6da66b2c2486.png)

* Click on your service app.

![Alt text](https://user-images.githubusercontent.com/83201188/126948899-3fddfaa6-a881-446a-bf2d-9ccf417275e3.png)

* Now click on Okta API Scopes available on the top of the form.

![Alt text](https://user-images.githubusercontent.com/83201188/126946565-323ec31e-ec66-48bb-b290-31ae51d0ae2f.png)

* Grant the scopes by clicking on **Grant**.
* To get more info on the scopes. Visit the [Doc](https://developer.okta.com/docs/guides/implement-oauth-for-okta/scopes/)
