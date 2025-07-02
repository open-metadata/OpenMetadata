---
title: Troubleshooting for MSSQL
description: Fix MS SQL Server connection issues with OpenMetadata's comprehensive troubleshooting guide. Get step-by-step solutions for common database connector problems.
slug: /connectors/database/mssql/troubleshooting
---

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

## Resolving SQL Server Authentication Issue for Windows User

This guide addresses a common issue when connecting to a SQL Server instance using Windows OS. If you encounter the error below, follow the steps outlined to resolve it effectively.  

## Error Description  
When attempting to connect to SQL Server using a Windows user, the following error appears:  

```
(pyodbc.InterfaceError) ('28000', "[28000] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Login failed for user 'domain\\user'. (18456)")
```

Additionally, the SQL Server logs display:

```
Login failed for user 'domain\user'. Reason: Attempting to use an NT account name with SQL Server Authentication.
```
## Root Cause  
The error occurs because the connection is configured to use SQL Server Authentication instead of Windows Authentication. Windows Authentication requires a connection scheme that supports integrated security.  

## Resolution  

### Step 1: Verify Connection Configuration  
1. Ensure that you are connecting to SQL Server using **Windows Authentication**.  
2. Update the connection scheme to use `mssql+pymssql` instead of `mssql.pyodbc`.  

### Step 2: Update the Connection Details in Collate  
1. Navigate to **MSSQL Service Configuration** in the Collate UI.  
2. Update the **Connection Scheme** to `mssql+pymssql`.  
3. Retain the following connection details:  
   - **Host and Port**: e.g., `10.121.89.148:62452`.  
   - **Database**: Specify the target database (e.g., `OneSumx_Stoging`).  
   - **Username**: Use the Windows account username, e.g., `domain\user`.  
4. Save the updated configuration.  

### Step 3: Test the Connection  
1. After saving the changes, click **Test Connection** in the Collate UI.  
2. Confirm that the following steps pass successfully:  
   - **CheckAccess**  
   - **GetDatabases**  
   - **GetSchemas**  
   - **GetTables**  
   - **GetViews**  
   - **GetQueries**  

### Expected Outcome  
After updating the connection scheme, the connection should succeed. The status will display:

```
Connection Status: Success
```
