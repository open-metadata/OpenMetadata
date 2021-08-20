---
description: This is a guide to create ingestion bot service account.
---

# Create Service Account/Client-Credential Flow

## Step 1: Enable Client-Credential

* Go to your project dashboard.

![Alt text](https://user-images.githubusercontent.com/83201188/130019116-16ed406e-3e76-4b33-8804-3a9eebebc578.png)

* Click on `Application > Applicaiton` on the left side.

![Alt text](https://user-images.githubusercontent.com/83201188/130019122-2435ada0-3321-46a6-a17b-dfb6bb589182.png)

* Select your application from the list.

![Alt text](https://user-images.githubusercontent.com/83201188/130190043-8b88d27b-bca8-4220-a141-bc960a3c75a7.png)

* Once selected, scroll down until you see `Application Properties` section.

![Alt text](https://user-images.githubusercontent.com/83201188/130190078-43065e80-0bf9-47d0-8e63-cd8dc339e86d.png)

* In that change `Token Endpoint Authentication Method` from None to Basic.

![Alt text](https://user-images.githubusercontent.com/83201188/130190048-7c19da03-6d05-4217-ab7f-5e5348561174.png)

* Now scroll further down util you see `Addition Settings`.

![Alt text](https://user-images.githubusercontent.com/83201188/130190051-a3b7e740-6e4a-4dad-b95b-33eb7568f496.png)

* Click on it and select `Grant Types`.

![Alt text](https://user-images.githubusercontent.com/83201188/130190060-8316de74-31de-4696-ba14-1775492b1b65.png)

* In the grant types, select `Client Credentials`.

![Alt text](https://user-images.githubusercontent.com/83201188/130190064-9de1c9ae-3461-4567-a169-038f55e504a3.png)

* Once done, click on `Save Changes`.

## Step 2: Authorize the API with our Application.

* Go to `Application > APIs` available on the left side.

![Alt text](https://user-images.githubusercontent.com/83201188/130190083-f11904f8-acf1-47da-8904-de2eadc3eb01.png)

* You will see the `Auth0 Management API`.

![Alt text](https://user-images.githubusercontent.com/83201188/130190072-306e7934-85a2-4c11-bcb1-e8208b3193c4.png)

* Select that API.

![Alt text](https://user-images.githubusercontent.com/83201188/130190086-bb20042c-07be-421d-806e-fb6d8d03f722.png)

* Select `Machine to Machine Applications`

![Alt text](https://user-images.githubusercontent.com/83201188/130190088-a4a1931d-a6e7-48ee-a9ed-201bca85f2f3.png)

* You will see you application listed below

![Alt text](https://user-images.githubusercontent.com/83201188/130190073-ad31b0aa-fcf1-494c-9313-6eb6ddc86858.png)

* Click on the toggle to authorize.

![Alt text](https://user-images.githubusercontent.com/83201188/130190090-b0458fc0-7642-46f1-9344-ad8706dd2625.png)

* Once done you will see the down arrow, click on it.

![Alt text](https://user-images.githubusercontent.com/83201188/130190090-b0458fc0-7642-46f1-9344-ad8706dd2625.png)

* Select which permissions (scopes) should be granted to the client. \
Click on `Update`.

![Alt text](https://user-images.githubusercontent.com/83201188/130190076-28e2e11a-273d-491e-b998-db81bf1fb813.png)
