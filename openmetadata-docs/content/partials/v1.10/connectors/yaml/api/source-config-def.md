#### Source Configuration - Source Config

{% codeInfo srNumber=100 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/apiServiceMetadataPipeline.json):

**markDeletedApiCollections**: To flag API collections as soft-deleted if they are not present anymore in the source system.

**overrideMetadata**: Set the Override Metadata toggle to control whether to override the metadata if it already exists.

**apiCollectionFilterPattern**: Note that the filter supports regex as include or exclude.

{% /codeInfo %}
