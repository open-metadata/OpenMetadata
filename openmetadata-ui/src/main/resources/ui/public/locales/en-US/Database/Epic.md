# Epic

In this section, we provide guides and references to use the Epic FHIR connector.

You can find further information on the Epic connector in the <a href="https://docs.open-metadata.org/connectors/database/epic" target="_blank">docs</a>.

## Connection Details

$$section
### FHIR Server URL $(id="fhirServerUrl")
Base URL of the Epic FHIR server, e.g. `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/`.
$$

$$section
### FHIR Version $(id="fhirVersion")
FHIR specification version supported by the server. Supported values are `R4`, `STU3`, and `DSTU2`.
$$

$$section
### Database Name $(id="databaseName")
Optional name to give to the database in OpenMetadata. If left blank, `epic` will be used as the default value.
$$

$$section
### Supports Metadata Extraction $(id="supportsMetadataExtraction")
Indicates whether OpenMetadata should attempt to extract metadata from the Epic FHIR server in addition to creating the service connection.
$$
