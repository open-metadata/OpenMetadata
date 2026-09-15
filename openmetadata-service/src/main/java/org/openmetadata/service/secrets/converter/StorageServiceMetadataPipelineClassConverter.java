package org.openmetadata.service.secrets.converter;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataADLSConfig;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataGCSConfig;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataHttpConfig;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataLocalConfig;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataS3Config;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.utils.JsonUtils;

public class StorageServiceMetadataPipelineClassConverter extends ClassConverter {
  private static final List<Class<?>> CONFIG_CLASSES =
      List.of(
          StorageMetadataS3Config.class,
          StorageMetadataADLSConfig.class,
          StorageMetadataGCSConfig.class,
          StorageMetadataLocalConfig.class,
          StorageMetadataHttpConfig.class);

  public StorageServiceMetadataPipelineClassConverter() {
    super(StorageServiceMetadataPipeline.class);
  }

  @Override
  public Object convert(Object object) {
    final StorageServiceMetadataPipeline pipeline =
        JsonUtils.convertValue(object, StorageServiceMetadataPipeline.class);
    final Object source = pipeline.getStorageMetadataConfigSource();
    if (!nullOrEmpty(JsonUtils.valueToTree(source))) {
      tryToConvertOrFail(source, CONFIG_CLASSES)
          .ifPresent(pipeline::setStorageMetadataConfigSource);
      if (pipeline.getStorageMetadataConfigSource() instanceof StorageMetadataGCSConfig gcsConfig) {
        gcsConfig.setSecurityConfig(
            (GCPCredentials)
                ClassConverterFactory.getConverter(GCPCredentials.class)
                    .convert(gcsConfig.getSecurityConfig()));
      }
    }
    return pipeline;
  }
}
