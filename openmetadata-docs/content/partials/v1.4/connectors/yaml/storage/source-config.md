```yaml {% srNumber=100 %}
  sourceConfig:
    config:
      type: StorageMetadata
      # containerFilterPattern:
      #   includes:
      #     - container1
      #     - container2
      #   excludes:
      #     - container3
      #     - container4
      # storageMetadataConfigSource:
      ## For S3
      #   securityConfig:
      #     awsAccessKeyId: ...
      #     awsSecretAccessKey: ...
      #     awsRegion: ...
      #   prefixConfig:
      #     containerName: om-glue-test
      #     objectPrefix: <optional prefix>
      ## For HTTP
      #   manifestHttpPath: http://...
      ## For Local
      #   manifestFilePath: /path/to/openmetadata_storage_manifest.json
```