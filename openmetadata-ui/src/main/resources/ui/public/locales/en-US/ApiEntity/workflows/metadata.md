# Metadata

API Service Metadata Pipeline Configuration.

$$section
### API Collection Filter Pattern $(id="apiCollectionFilterPattern")

API Collection filter patterns to control whether to include API Collections as part of metadata ingestion.

**Include**: Explicitly include API Collections by adding a list of regular expressions to the `Include` field. OpenMetadata will include all API Collections with names matching one or more of the supplied regular expressions. All other API Collections will be excluded.

For example, to include only those API Collections whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude API Collections by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all API Collections with names matching one or more of the supplied regular expressions. All other API Collections will be included.

For example, to exclude all API Collections with the name containing the word `demo`, add the regex pattern in the exclude field as `.*demo.*`.

Checkout <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern" target="_blank">this</a> document for further examples on filter patterns.
$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$

$$section
### Mark Deleted API Collection $(id="markDeletedApiCollections")

Optional configuration to soft delete `API Collections` in OpenMetadata if the source `API Collections` are deleted. After deleting, all the associated entities like lineage, etc., with that `API Collection` will be deleted.
$$

$$section
### Override Metadata $(id="overrideMetadata")

Set the `Override Metadata` toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source.

If the toggle is `enabled`, the metadata fetched from the source will override and replace the existing metadata in the OpenMetadata.

If the toggle is `disabled`, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. In this case the metadata will only get updated for fields that has no value added in OpenMetadata.

This is applicable for fields like description, tags, owner and displayName

$$