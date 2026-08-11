# Microsoft Fabric Pipeline

In this section, we provide guides and references to use the Microsoft Fabric Pipeline connector. This connector supports Microsoft Fabric Data Factory pipelines.

## Requirements

### Service Principal (Application) Setup

OpenMetadata uses Service Principal authentication to connect to Microsoft Fabric. Follow these steps to set up authentication:

1. **Register an Azure AD Application:**
   - Log into <a href="https://portal.azure.com" target="_blank">Azure Portal</a>
   - Navigate to `Azure Active Directory` > `App registrations` > `New registration`
   - Provide a name for your application (e.g., "OpenMetadata-Fabric-Connector")
   - Click `Register`
   - Copy the `Application (client) ID` and `Directory (tenant) ID` for later use

2. **Create a Client Secret:**
   - In your registered app, go to `Certificates & secrets`
   - Click `New client secret`
   - Provide a description (e.g., "OpenMetadata Secret") and choose expiration period
   - Click `Add` and copy the secret **value** (not the secret ID)
   - **Important:** Save this value immediately as it won't be shown again

3. **Grant Permissions to Fabric Workspace:**
   - Navigate to your Fabric workspace in <a href="https://app.fabric.microsoft.com" target="_blank">Microsoft Fabric</a>
   - Go to `Workspace settings` > `Manage access`
   - Click `Add people or groups`
   - Search for your registered application name
   - Assign the appropriate role:
     - **Admin** - Full access including pipeline execution details
     - **Member** - Read and write access
     - **Contributor** - Read access (minimum for metadata extraction)
     - **Viewer** - Read-only access

4. **Enable Fabric API Access:**
   - The application needs access to Fabric API scope: `https://api.fabric.microsoft.com/.default`
   - This is automatically requested by OpenMetadata during authentication
   - No additional API permissions need to be configured in Azure AD

### Workspace Permissions

The Service Principal needs at least **Contributor** role on the workspace to:
- List all data pipelines in the workspace
- Read pipeline definitions and task (activity) configurations
- Access pipeline execution history and run details
- Fetch individual activity/task execution information and timing

### What Gets Extracted

OpenMetadata extracts the following information from Microsoft Fabric pipelines:

**Pipeline Metadata:**
- Pipeline name and description
- Pipeline tasks/activities and their configurations
- Task dependencies and execution flow
- Pipeline source URL in Fabric UI

**Execution History:**
- Pipeline run status (Completed, Failed, InProgress, etc.)
- Pipeline execution start and end times
- Individual task/activity execution details
- Task-level timing and duration
- Task status for each execution
- Failure reasons and error details

$$note
OpenMetadata now fetches actual **task-level execution details** from Microsoft Fabric API, providing precise timing and status for each activity in your pipeline runs. This is a significant improvement over inferring task status from pipeline-level information.
$$

You can find further information on the Microsoft Fabric Pipeline connector in the <a href="https://docs.open-metadata.org/connectors/pipeline/microsoft-fabric-pipeline" target="_blank">docs</a>.

## Connection Details

$$section
### Workspace ID $(id="workspaceId")
The Microsoft Fabric workspace ID where your pipelines are located.

To find your workspace ID:
1. Open your workspace in <a href="https://app.fabric.microsoft.com" target="_blank">Microsoft Fabric</a>
2. Look at the URL - it will be in the format: `https://app.fabric.microsoft.com/groups/<workspace-id>/...`
3. Copy the GUID that appears after `/groups/`
$$

$$section
### Client ID $(id="clientId")
Azure Active Directory Application (Client) ID.

To get this:
1. Log into <a href="https://portal.azure.com" target="_blank">Azure Portal</a>
2. Go to `Azure Active Directory` > `App registrations`
3. Select your registered application
4. Copy the `Application (client) ID` from the Overview page
$$

$$section
### Client Secret $(id="clientSecret")
Azure Active Directory Application Client Secret.

To get this:
1. In your registered app, go to `Certificates & secrets`
2. Click `New client secret`
3. Copy the **Value** (not the Secret ID)
4. **Important:** This value is shown only once, save it immediately
$$

$$section
### Tenant ID $(id="tenantId")
Azure Active Directory Tenant ID.

To get this:
1. Log into <a href="https://portal.azure.com" target="_blank">Azure Portal</a>
2. Go to `Azure Active Directory` > `App registrations`
3. Select your registered application
4. Copy the `Directory (tenant) ID` from the Overview page
$$

$$section
### Authority URI $(id="authorityUri")
Azure Active Directory authority URI. Defaults to `https://login.microsoftonline.com/`

You can leave this as default unless you're using a sovereign cloud:
- **Azure Global:** `https://login.microsoftonline.com/` (default)
- **Azure Government:** `https://login.microsoftonline.us/`
- **Azure China:** `https://login.chinacloudapi.cn/`
- **Azure Germany:** `https://login.microsoftonline.de/`
$$

$$section
### Pipeline Filter Pattern $(id="pipelineFilterPattern")
Regex to only include/exclude pipelines that match the pattern.

Examples:
- Include only production pipelines: `^prod_.*`
- Exclude test pipelines: `^(?!test_).*`
- Include specific pipelines: `^(sales_pipeline|marketing_etl)$`
$$

## Task-Level Execution Details

$$note
**New Feature:** OpenMetadata now captures individual task/activity execution information!

For each pipeline run, OpenMetadata fetches:
- **Task Name** - Name of the activity (e.g., "Wait_Start", "Copy_Data")
- **Task Type** - Type of activity (Wait, Copy, SetVariable, Notebook, etc.)
- **Task Status** - Actual execution status (Succeeded, Failed, Skipped)
- **Start Time** - Precise task start timestamp
- **End Time** - Precise task completion timestamp
- **Duration** - Exact task execution duration in milliseconds
- **Input/Output** - Task input parameters and output values
- **Error Details** - Failure reasons and error messages for failed tasks

This provides complete visibility into your pipeline execution history at the task level!
$$

## Supported Pipeline Activities

The connector extracts metadata for all Microsoft Fabric Data Factory activities, including:

**Data Movement:**
- Copy Data
- Lakehouse
- Warehouse
- Notebook

**Data Transformation:**
- Data Flow
- Stored Procedure
- Script

**Control Flow:**
- If Condition
- Switch
- For Each
- Until
- Wait
- Set Variable
- Append Variable
- Invoke Pipeline

**External Services:**
- Web Activity
- Azure Function
- Databricks

## Troubleshooting

### Common Issues

**1. Authentication Failed:**
- Verify your Client ID, Client Secret, and Tenant ID are correct
- Ensure the client secret hasn't expired
- Check that the application has proper workspace permissions

**2. No Pipelines Found:**
- Verify the Workspace ID is correct
- Ensure the Service Principal has at least Contributor role
- Check pipeline filter pattern isn't excluding all pipelines

**3. Missing Task Execution Details:**
- This is normal for old pipeline runs where tasks have been removed/renamed
- Only tasks that exist in the current pipeline definition will show execution details
- Check the ingestion logs for any API errors

**4. Workspace Access Denied:**
- Grant the Service Principal access to the workspace
- Ensure the application has the proper role (minimum: Contributor)

### Getting Help

If you encounter issues:
1. Check the <a href="https://docs.open-metadata.org/connectors/pipeline/microsoft-fabric-pipeline" target="_blank">full documentation</a>
2. Review ingestion logs for detailed error messages
3. Verify all prerequisites are met
4. Report issues on <a href="https://github.com/open-metadata/OpenMetadata/issues" target="_blank">GitHub</a>
