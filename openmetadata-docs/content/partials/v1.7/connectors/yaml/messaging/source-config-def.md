#### Source Configuration - Source Config

{% codeInfo srNumber=100 %}

The sourceConfig is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/messagingServiceMetadataPipeline.json):

- **generateSampleData:** Option to turn on/off generating sample data during metadata extraction.

- **topicFilterPattern:** Note that the `topicFilterPattern` supports regex as include or exclude.

- **generateSampleData:** Option to turn on/off generating sample data during metadata extraction. `generateSampleData` supports boolean value either `true` or `false`.

- **markDeletedTopics:** Optional configuration to soft delete topics in OpenMetadata if the source topics are deleted. Also, if the topic is deleted, all the associated entities like sample data, lineage, etc., with that topic will be deleted. `markDeletedTopics` supports boolean value either `true` or `false`.

- **overrideMetadata:** Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. `overrideMetadata` supports boolean value either `true` or `false`.

{% /codeInfo %}