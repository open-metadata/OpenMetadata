# Create Server Credentials

## Step 1: Login to Azure Active Directory

* Login to [Microsoft Azure Portal](https://azure.microsoft.com/en-in/services/active-directory/external-identities/)
* Navigate to the Azure Active Directory.

{% hint style="info" %}
Admin permissions are required to register the application on the Azure portal.
{% endhint %}

## Step 2: Create a New Application

* From the Azure Active Directory, navigate to the **App Registrations** section from the left nav bar.

![](<../../../.gitbook/assets/image (33).png>)

* Click on **New Registration**. This step is for registering the OpenMetadata UI.

![](<../../../.gitbook/assets/image (34) (1) (1) (1).png>)

* Provide an Application Name for registration
* Provide a redirect URL as a **Single Page Application**.
* Click on \*\*\*\* Register.

![](<../../../.gitbook/assets/image (6) (1) (1) (1) (1) (1).png>)

## Step 3: Where to Find the Credentials

* The `Client ID` and the `Tenant ID` are displayed in the Overview section of the registered application.

![](<../../../../.gitbook/assets/image (71) (1) (1) (4) (7).png>)

* When passing the details for `authority`, the `Tenant ID` is added to the URL as shown in the example below. https://login.microsoftonline.com/TenantID

```javascript
"authority": "https://login.microsoftonline.com/c11234b7c-b1b2-9854-0mn1-56abh3dea295"
```
