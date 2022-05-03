# Create Service Application

## Step 1: Access Tokens and ID Tokens

* Navigate to the newly registered application.
* Click on the **Authentication** section.
* Select the checkboxes for **Access Token** and **ID Tokens**.
* Click Save.

![](<../../../.gitbook/assets/image (1) (2) (1).png>)

## Step 2: Expose an API

* Navigate to the section **Expose an API**

![](<../../../.gitbook/assets/image (14) (1) (1) (1).png>)

* Set the **App ID URI.** If it has not been set, the default value is api://\<client\_id>.
* Click Save.

![](<../../../.gitbook/assets/image (4) (2).png>)

## Step 3: Add a Scope

* Click on **Add a Scope**.
* Enter the details with a custom scope name to expose.
* Once completed, click on Add Scope.

![](<../../../.gitbook/assets/image (32) (3).png>)

## Step 4: Register Another Azure Application

Another Azure Application must be registered for Service ingestion.

* Provide an application name.&#x20;
* Create a **public client redirect URI**.&#x20;
* Click on Register.

![](<../../../.gitbook/assets/image (3) (1) (1) (1) (1) (1).png>)

## Step 5: **API Permissions**

* Navigate to the Ingestion Application created in step 4.
* Navigate to the section on API Permissions.
* Click on Add a Permission.

![](<../../../.gitbook/assets/image (17) (2) (1) (1) (1).png>)

* Search for the OpenMetadata Application

![](<../../../.gitbook/assets/image (3) (1) (1) (1) (1).png>)

* Select the custom scope created in Step 3.
* Click on Add Permissions.

![](<../../../.gitbook/assets/image (2) (1) (1) (1).png>)

## Step 6: Grant Admin Consent for Default Directory

Open Metadata Ingestion authenticates and authorizes workflow connectivity with OpenMetadata API using OAuth2 Client Credentials grant. In the Client Credentials flow, there is no GUI to consent application permissions since it’s a machine to machine communication. So OpenMetadata Ingestion Azure Application will need to be pre-consented by Azure Active Directory to use the scope request to connect to OpenMetadata Azure Application via the application.access scope.

* Navigate to the Azure Active Directory >> Enterprise Application.
* Further navigate to the ingestion application created in step 4. This is also called the Service Principal.&#x20;
* Click on Permissions.
* Click on **Grant Admin Consent for Default Directory**.

![](<../../../.gitbook/assets/image (19) (1) (1).png>)

## Step 7: Set the App ID URI

* Navigate to the Azure Active Directory >> App Registrations >> \[OpenMetadata Ingestion Application] >> Expose an API.
* Click on **Set** in Application ID URI

![](<../../../.gitbook/assets/image (21) (1) (1).png>)

* Click on Save to set the App ID URI which is required for scopes while connecting from manual ingestion.

![](<../../../.gitbook/assets/image (7) (1) (1).png>)

## Step 8: Create a Client Secret

* Navigate to **Certificates & Secrets** to generate the `clientSecret`.
* Click on New Client Secret.

![](<../../../.gitbook/assets/image (9) (2) (1).png>)

* Enter a description and an expiry period.

![](<../../../.gitbook/assets/image (20) (1) (1) (1) (1).png>)

* The `secret_key` is required for ingestion.
