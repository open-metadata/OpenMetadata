---
description: This is a guide to create ingestion bot service app.
---

# Create Service Application

## Step 1: Generate Public/Private Key Pair

**For a Test or Staging Instance:**

* Use a tool such as this JSON [Web Key Generator](https://mkjwk.org) to generate a JWKS public/private key pair for testing.

**For a Production Instance:**

* Use your own [internal instance](https://github.com/mitreid-connect/mkjwk.org) of the key pair generator.
* Clone the repository using `git clone https://github.com/mitreid-connect/mkjwk.org.git`.
* Use `mvn package -DskipTests && java -jar target/ROOT.war` to run the above repo.
* Go to `http:localhost:8080` to generate **public/private key pairs**.

![Alt text](https://user-images.githubusercontent.com/83201188/126946539-cb31793d-7616-4343-821b-8e190d626b63.png)

* Enter the following values to generate a **public/private key pair**:
  * Key size - 2048
  * Key use — signature
  * Algorithm — RSA256
  * Key ID — Enter the Key ID that is fetched from the `issuer_url/v1/keys`. Fetch the `kid` as the key ID

![](<../../../../docs/.gitbook/assets/image (12).png>)

![Alt text](https://user-images.githubusercontent.com/83201188/126946546-1e86ae45-2774-4217-925e-f423053a7a1d.png)

* Once you provide the input, click **Generate**. You will get the **Public/Private Keypair**, **Public/Private Keypair Set,** and **Public Key**

![Alt text](https://user-images.githubusercontent.com/83201188/126946550-ec9fa2b3-0a47-4fe1-ac32-7e326b3f7d45.png)

## Step 2: Create a Token

While creating the service application, an authorization token will be needed. To create a token:

* Navigate to **Security -> API** from the left nav bar.
* Click on the **Tokens** tab.
* Click on **Create New Token**
* Save the token safely.

## Step 3: Create Service Application

* You will need to make a **POST** request to `https://${yourOktaDomain}/oauth2/v1/clients` endpoint to create a service app in okta
* The parameters involved in the request are:
  * **client\_name** - the name of the service app
  * **grant\_type** - **client\_credentials**
  * **token\_endpoint\_auth\_method** — **private\_key\_jwt**
  * **application\_type** — **service**
  * **jwks** — add the **Public/Private Keypair Set** that you created in the previous step.
* Create a service app using the below format:

```
curl --location --request POST '<domain-url>/oauth2/v1/clients' \
--header 'Authorization: SSWS <token-created-in-previous-step>' \
--header 'Content-Type: application/json' \
--data-raw '{
    "client_name": "OM-service-app-postman-4",
    "grant_types": [
        "client_credentials"
    ],
    "response_types": [
        "token"
    ],
    "token_endpoint_auth_method": "private_key_jwt",
    "application_type": "service",
    "jwks": {
        <public private key pair set with kid(key id) that of the authorization server>
}' 
```

* To check if the service app is created navigate to your **Okta Dashboard**.
* Click on **Applications -> Applications** in the left navigation bar.
* You should see your service account in the list.

![](<../../../../docs/.gitbook/assets/image (35) (1) (1).png>)

## Step 4: Grant Allowed Scopes

* To add scopes, navigate to your **Okta Dashboard**. Click on **Applications -> Applications** as in step 2.
* Click on your service app.

![](<../../../../docs/.gitbook/assets/image (35).png>)

* Now click on **Okta API Scopes** from the top nav bar.
* Grant the scopes by clicking on **Grant**. Ensure that the following scopes are granted:
  * okta.users.read
  * okta.users.manage
  * okta.clients.read

![](<../../../../docs/.gitbook/assets/image (47).png>)

* To get more information on the Scopes. Visit the [Doc](https://developer.okta.com/docs/guides/implement-oauth-for-okta/scopes/).
