#### Source Configuration - Source Config

{% codeInfo srNumber=100 %}

The sourceConfig is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/messagingServiceMetadataPipeline.json):

**markDeletedMlModels**: Set the Mark Deleted Ml Models toggle to flag ml models as soft-deleted if they are not present anymore in the source system.

**mlModelFilterPattern**: Regex to only fetch MlModels with names matching the pattern.

**overrideMetadata**: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName.

{% /codeInfo %}
