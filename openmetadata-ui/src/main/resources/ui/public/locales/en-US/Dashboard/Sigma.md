# Sigma

In this section, we provide guides and references to use the Sigma connector.

## Requirements

OpenMetadata relies on Sigma's REST API. To know more you can read the <a href="https://help.sigmacomputing.com/reference/get-started-sigma-api#about-the-api" target="_blank">Sigma API Get Started docs</a>. To <a href="https://help.sigmacomputing.com/reference/generate-client-credentials#user-requirements" target="_blank">generate API client credentials</a>, you must be assigned the Admin account type.

You can find further information on the Sigma connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/sigma" target="_blank">docs</a>.

## Connection Details

$$section
### Host Port $(id="hostPort")

The hostPort parameter specifies the host and port of the Sigma's API request URL. This should be specified as a string in the format `https://aws-api.sigmacomputing.com`. Sigma's API request URL varies according to the sigma cloud. you can determine your API url by following the docs <a href="https://help.sigmacomputing.com/reference/get-started-sigma-api#identify-your-api-request-url" target="_blank">here</a>.
$$

$$section
### Client Id $(id="clientId")

Get the Client Id and client Secret by following below steps:
- Navigate to your Sigma homepage.
- Click on Administration in the lower left corner.
- Click on Developer Access on the left side.
- To generate a new Client Id and client Secret, On upper left corner click `Create New`.
- Enter the required details asked and click `Create`.
- Copy the generated access token and password.

For detailed information visit <a href="https://help.sigmacomputing.com/reference/generate-client-credentials#generate-api-client-credentials" target="_blank">here</a>.
$$

$$section
### Client Secret $(id="clientSecret")

Copy the access token password from the step above where a new token is generated.

For detailed information visit <a href="https://help.sigmacomputing.com/reference/generate-client-credentials#generate-api-client-credentials" target="_blank">here</a>.
$$

$$section
### Api Version $(id="apiVersion")

Version of the Sigma REST API by default `v2`.

To get to know the Sigma REST API Version visit <a href="https://help.sigmacomputing.com/reference/get-started-sigma-api#identify-your-api-request-url" target="_blank">here</a> and look into the `Token URL` section.
$$

$$section
### Skip Permission Check $(id="skipPermissionCheck")

Sigma's API lists the workbooks and data models that the owner of the client credentials can access: the ones in their **My Documents** folder and the ones shared with them, directly or through a folder or workspace. Workbooks nobody shared with that user are not ingested.

Turn this on to list every workbook and data model in the organization instead. It sends Sigma's `skipPermissionCheck` parameter on the two listings, which Sigma documents as <a href="https://help.sigmacomputing.com/reference/list-workbooks" target="_blank">"Only available to Sigma admins"</a>, so the credentials' owner must have the **Admin** account type. Custom views, the private per-user views of a workbook, are never listed. The connection test uses the same listing, so it shows what Sigma answers for your credentials.

A workbook that is listed this way but that the user still cannot open is skipped when its details cannot be read; when only its pages cannot be read, its dashboard is created without charts or data models. If you cannot use an Admin credential, share each workspace with the user that owns the credentials instead.
$$

## Certification Badges

When **Include Tags** is on, a workbook's certification badge (Endorsed, Warning or Deprecated) is added to its dashboard as a tag in the `SigmaBadge` classification.

## Projects

A Sigma workbook's project is its workspace, the first part of the workbook's path in Sigma (for example `My Documents`). **Project Filter Pattern** includes or excludes workbooks by that workspace name.

## Data Models

When **Include Data Models** is on, each Sigma Data Model is ingested as one data model, with a table column per data model element holding that element's columns. **Data Model Filter Pattern** matches the Sigma Data Model name. A workbook element that reads a Sigma Data Model gets lineage from it.

## Custom Properties

When **Include Custom Properties** is on, each workbook's dashboard gets a `latestVersion` custom property: the most recently published version of the workbook in Sigma. The property is added to every dashboard in OpenMetadata, and is left alone when a property of that name already exists with another type.

## Lineage

The Sigma connector extracts lineage by parsing SQL queries from workbooks to identify source tables. If SQL queries are unavailable, it falls back to Sigma's lineage API to retrieve metadata-based lineage information.

Source tables are looked up in the database services listed in **Database Service Prefixes**, or in every database service when it is empty. A table is linked only when exactly one table matches across the services searched; a table that matches several, for example the same schema and table in two services, is left without lineage. Set **Database Service Prefixes** to the services Sigma reads from to resolve such tables.
