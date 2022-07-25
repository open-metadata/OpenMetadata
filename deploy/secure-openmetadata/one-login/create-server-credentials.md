# Create Server Credentials

## Configure new Application

* Login to [OneLogin](https://www.onelogin.com) as an administrator and click on Applications

![Add App](<../../../.gitbook/assets/Screen Shot 2022-07-22 at 3.02.49 PM.png>)

* Click on the  "Add App" button and search for "openid connect"
* Select the "OpenId Connect (OIDC)" app

![OpenId Connect App](<../../../.gitbook/assets/Screen Shot 2022-07-22 at 3.03.33 PM.png>)

* Change the Display Name of the app to "Open Metadata" and click "Save"

![](<../../../.gitbook/assets/Screen Shot 2022-07-22 at 3.04.23 PM.png>)

* Configure the login Url (http(s)://\<domain>/signin) and redirect URI (http(s)://\<domain>/callback) as shown below

![](<../../../.gitbook/assets/Screen Shot 2022-07-22 at 3.05.21 PM.png>)

* Configure the users in the organization that can access OpenMetadata app by clicking on the "Users"&#x20;

![](<../../../.gitbook/assets/Screen Shot 2022-07-22 at 3.06.51 PM.png>)

* Click on "SSO" and select "None (PKCE)" for Token Endpoint.

![](<../../../.gitbook/assets/Screen Shot 2022-07-22 at 3.06.22 PM.png>)

## Where to find the Credentials

* Go to "SSO" and copy the Client ID&#x20;

![](<../../../.gitbook/assets/Screen Shot 2022-07-22 at 3.06.22 PM.png>)

* Copy the Issuer URL&#x20;
