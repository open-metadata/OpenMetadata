# Create Server Credentials

## Step 1: Login to AWS Portal

* Login to [Amazon AWS Portal](https://aws.amazon.com/)
* Search for "Cognito" in the search box and select Cognito Service from the dropdown menu

![Search for Cognito in AWS Portal](<../../../.gitbook/assets/Screen Shot 2022-07-15 at 3.30.35 PM.png>)

## Step 2: Setup User Pool

* Click on the "Create user pool" button if you do not have any user pools configured yet. Skip this step if you already have a user pool available.
* Select the type of ID providers you want to configure for your users and click "Next"

![Setup User Pool - Step 1](<../../../.gitbook/assets/Screen Shot 2022-07-17 at 11.00.55 PM.png>)

* Configure the security requirements in Step 2 as per your organizational needs and proceed to Step 3
* Configure the Sign-up experience in Step 3. Make sure to add email as a required attribute before proceeding to step 4

![Configure Sign up Experience - Step 3](<../../../.gitbook/assets/Screen Shot 2022-07-17 at 11.08.12 PM.png>)

* Configure message delivery as per your organizational needs and proceed to Step 5
* In Step 5, add a name for the user pool and check the "Use the Cognito Hosted UI" option and provide a Cognito domain as shown in the screen-shot below

![Integrate your App - Step 5](<../../../.gitbook/assets/Screen Shot 2022-07-17 at 11.14.50 PM.png>)

* In the same step, select "Public client" for the Initial App client type and configure the Allowed callback URLs with http://localhost:8585/callback as shown in the screen-shot below.\
  **Note:** For production deployments, the Allowed callback URLs should be updated with the appropriate domain name.

![Configuring the App Client - Step 5](<../../../.gitbook/assets/Screen Shot 2022-07-17 at 11.19.01 PM.png>)

* The last step is to Review and create the User Pool.

## Step 3: Where to find the Credentials

* The `User Pool ID` can be found in the User Pool summary page as seen in the screen-shot below\


![User Pool ID](<../../../.gitbook/assets/Screen Shot 2022-07-17 at 11.57.47 PM.png>)

* The App client ID can be found under the "App Integration" tab of the User Pool page. There will be a section that lists all the App clients with client name and client ID as shown below

![](<../../../.gitbook/assets/Screen Shot 2022-07-18 at 12.00.11 AM (1).png>)

![Client ID](<../../../.gitbook/assets/Screen Shot 2022-07-17 at 11.59.57 PM.png>)
