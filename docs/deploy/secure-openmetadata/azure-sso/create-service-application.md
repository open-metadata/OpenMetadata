# Create Service Application

## Step 1: Access Tokens and ID Tokens

* Navigate to the newly registered application.
* Click on the **Authentication** section.
* Select the checkboxes for **Access Token** and **ID Tokens**.
* Click Save.

![](<../../../../.gitbook/assets/image (34).png>)

## Step 2: Expose an API

* Navigate to the section **Expose an API**

![](<../../../../.gitbook/assets/image (81).png>)

* Set the **App ID URI.** If it has not been set, the default value is api://\<client\_id>.
* Click Save.

![](<../../../../.gitbook/assets/image (49).png>)

## Step 3: Add a Scope

* Click on **Add a Scope**.
* Enter the details with a custom scope name to expose.
* Once completed, click on Add Scope.

![](<../../../../.gitbook/assets/image (105).png>)

## Step 4: Register Another Azure Application

Another Azure Application must be registered for Service ingestion.

* Provide an application name.
* Create a **public client redirect URI**.
* Click on Register.

![](<../../../../.gitbook/assets/image (45).png>)

## Step 5: **API Permissions**

* Navigate to the Ingestion Application created in step 4.
* Navigate to the section on API Permissions.
* Click on Add a Permission.

![](<../../../../.gitbook/assets/image (91).png>)

* Search for the OpenMetadata Application

![](<../../../../.gitbook/assets/image (18) (1).png>)

* Select the custom scope created in Step 3.
* Click on Add Permissions.

![](<../../../../.gitbook/assets/image (43).png>)

## Step 6: Grant Admin Consent for Default Directory

Open Metadata Ingestion authenticates and authorizes workflow connectivity with OpenMetadata API using OAuth2 Client Credentials grant. In the Client Credentials flow, there is no GUI to consent application permissions since it’s a machine to machine communication. So OpenMetadata Ingestion Azure Application will need to be pre-consented by Azure Active Directory to use the scope request to connect to OpenMetadata Azure Application via the application.access scope.

* Navigate to the Azure Active Directory >> Enterprise Application.
* Further navigate to the ingestion application created in step 4. This is also called the Service Principal.
* Click on Permissions.
* Click on **Grant Admin Consent for Default Directory**.

![](<../../../../.gitbook/assets/image (102) (2).png>)

## Step 7: Set the App ID URI

* Navigate to the Azure Active Directory >> App Registrations >> \[OpenMetadata Ingestion Application] >> Expose an API.
* Click on **Set** in Application ID URI

![](<../../../../.gitbook/assets/image (93).png>)

* Click on Save to set the App ID URI which is required for scopes while connecting from manual ingestion.

![](<../../../../.gitbook/assets/image (61).png>)

## Step 8: Create a Client Secret

* Navigate to **Certificates & Secrets** to generate the `clientSecret`.
* Click on New Client Secret.

![](<../../../../.gitbook/assets/image (72).png>)

* Enter a description and an expiry period.

![](<../../../../.gitbook/assets/image (101).png>)

* The `secret_key` is required for ingestion.
