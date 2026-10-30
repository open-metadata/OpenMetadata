/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataADLSConfig;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataGCSConfig;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataHttpConfig;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataLocalConfig;
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataS3Config;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get a `StorageServiceMetadataPipeline` object with a typed manifest source. */
public class StorageServiceMetadataPipelineClassConverter extends ClassConverter {

  private static final List<Class<?>> MANIFEST_SOURCE_CLASSES =
      List.of(
          StorageMetadataLocalConfig.class,
          StorageMetadataHttpConfig.class,
          StorageMetadataS3Config.class,
          StorageMetadataADLSConfig.class,
          StorageMetadataGCSConfig.class);

  public StorageServiceMetadataPipelineClassConverter() {
    super(StorageServiceMetadataPipeline.class);
  }

  @Override
  public Object convert(Object object) {
    StorageServiceMetadataPipeline pipeline =
        (StorageServiceMetadataPipeline) JsonUtils.convertValue(object, this.clazz);

    // Fails rather than keeping a source no schema matches: left as a map, the masker and the
    // secrets manager never reach the credentials in it.
    tryToConvertOrFail(pipeline.getStorageMetadataConfigSource(), MANIFEST_SOURCE_CLASSES)
        .ifPresent(pipeline::setStorageMetadataConfigSource);

    return pipeline;
  }
}
