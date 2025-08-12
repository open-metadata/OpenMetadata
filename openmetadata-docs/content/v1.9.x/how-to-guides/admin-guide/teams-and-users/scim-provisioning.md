---
title: SCIM Provisioning Guide
slug: /how-to-guides/admin-guide/teams-and-users/scim-provisioning-guide
collate: true
---
# SCIM Provisioning Guide

## Prerequisites

For a user to log in using SSO, you must configure SSO from your identity provider to Collate.

## Important Notes

- **Default Provisioning Schedule**:
    - Azure provisioning happens once every 40 minutes by default
    - Okta provisioning can be configured for real-time or scheduled intervals
- **Group Provisioning Behavior in OpenMetadata**:
    - **New Group**: If your identity provider sends a group that doesn't yet exist in Collate, we'll create it at the root (under the Organization) with team type as "group"
    - **Existing Group**: If the group already exists—no matter where it sits in Collate's hierarchy—we'll simply add or remove the user in that group
- **Requirement**: For provisioning to happen, you must assign users/groups to the SCIM App in your identity provider dashboard

---

## Step 1: Configure Collate

> **Note**: As of now, we will enable SCIM from the backend for the customer. In future releases, we will bring out the option to enable/disable from the UI.

To get the secret token:
1. Navigate to **Settings** → **Bot** → **SCIM-Bot**
2. Copy the bot token

---

## Step 2A: Configure Microsoft Entra ID (Azure)

### 2A.1 Create Enterprise Application

1. In your Azure portal, go to **Microsoft Entra ID** → **Enterprise Applications**
2. Click **+ New Application** above the application list
3. Click on **Create your own Application**
4. Enter a **Name** for the application and click **Create**

### 2A.2 Configure Provisioning

1. Under the **Manage** menu, click **Provisioning**
2. Set **Provisioning Mode** to **Automatic**
3. Set the **SCIM API endpoint URL** (will be provided by Collate)
4. Set **Secret Token** to the Collate SCIM token that you generated in Step 1
5. Click **Test Connection** and wait for the confirmation message that the credentials are authorized to enable provisioning
6. Click **Save**

### 2A.3 Assign Users and Groups

1. In the application page, click on **Users and Groups**
2. Click **Add user/group**
3. Select the desired **user/group**
4. Click **Assign**
5. Navigate to **Overview** → **Start Provisioning** to begin the provisioning process

---

## Step 2B: Configure Okta

### 2B.1 Create SCIM Application

1. In your Okta Admin Console, go to **Applications** → **Applications**
2. Click **Create App Integration**
3. Select **SAML 2.0** or **OIDC** for SSO (if not already configured)
4. For SCIM provisioning, go to the **Provisioning** tab in your existing application

### 2B.2 Configure SCIM Settings

1. In the application, click on the **Provisioning** tab
2. Click **Configure API Integration**
3. Check **Enable API integration**
4. Set the **Base URL** to the SCIM API endpoint URL (will be provided by Collate)
5. Set the **API Token** to the Collate SCIM token from Step 1
6. Click **Test API Credentials** to verify the connection
7. Click **Save**

### 2B.3 Configure Provisioning Settings

1. Go to **Provisioning** → **To App**
2. Click **Edit** and enable the following:
    - **Create Users**: Enable to create users in Collate
    - **Update User Attributes**: Enable to sync user attribute changes
    - **Deactivate Users**: Enable to deactivate users when removed from Okta
3. Configure attribute mappings:
    - **userName** → **userName**
    - **email** → **email**
    - **firstName** → **firstName**
    - **lastName** → **lastName**
    - **displayName** → **displayName**
4. Click **Save**

### 2B.4 Assign Users and Groups

1. Go to the **Assignments** tab
2. Click **Assign** → **Assign to People** or **Assign to Groups**
3. Select the users or groups you want to provision
4. Click **Assign** and then **Save and Go Back**
5. Click **Done**

### 2B.5 Configure Group Provisioning

1. In the **Provisioning** tab, go to **To App**
2. Scroll down to **Group Push** section
3. Configure group provisioning options:
    - **Push Groups**: Click **Push Groups** → **Find groups by name** or **Push groups by name/rule**
    - **Create Groups**: Enable to automatically create groups in Collate
    - **Update Group Attributes**: Enable to sync group changes
4. For automatic provisioning, set up **Push groups by name/rule**:
    - Define rules like groups starting with "OM_" or "Collate_"
    - Groups matching these rules will be automatically provisioned
5. Click **Save**

> **Note**: Once configured, groups will be automatically provisioned when they match your rules or when manually pushed. You don't need to click "Push Groups" repeatedly for automatic provisioning.

### 2B.6 Start Provisioning

1. Go to **Provisioning** → **To App**
2. The provisioning will start automatically once users/groups are assigned
3. You can monitor the status in the **Provisioning** dashboard

---

## Managing Provisioning

### Microsoft Entra ID (Azure)
- **Stop Provisioning**: Click on **"Pause Provisioning"**
- **Test Provisioning**: Use **"Provision on demand"**
- **View Logs**: Access provisioning logs from the provisioning section

### Okta
- **Stop Provisioning**: Disable API integration in the Provisioning tab
- **Test Provisioning**: Use **"Test API Credentials"** or check individual user provisioning status
- **View Logs**: Go to **Reports** → **System Log** and filter by the application name

---

## Troubleshooting

### Common Issues for Both Providers

1. **Connection Issues**:
    - Verify the SCIM endpoint URL is correct
    - Ensure the secret token is valid and properly configured
    - Check network connectivity and firewall settings

2. **User/Group Assignment Issues**:
    - Confirm users/groups are properly assigned to the application
    - Verify user attributes are mapped correctly
    - Check for duplicate users or conflicting email addresses

3. **Provisioning Failures**:
    - Review provisioning logs for specific error messages
    - Ensure required user attributes are populated
    - Verify user permissions in Collate

### Microsoft Entra ID Specific
- Check the provisioning logs for error messages
- Verify the application is properly configured in Enterprise Applications

### Okta Specific
- Check the System Log for SCIM-related errors
- Verify API integration is enabled and credentials are correct
- Ensure attribute mappings are configured properly
- Check if users are in the correct state (ACTIVE) in Okta
