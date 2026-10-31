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
import org.openmetadata.schema.metadataIngestion.storage.StorageMetadataGCSConfig;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get a `StorageMetadataGCSConfig` object. */
public class StorageMetadataGCSConfigClassConverter extends ClassConverter {

  public StorageMetadataGCSConfigClassConverter() {
    super(StorageMetadataGCSConfig.class);
  }

  @Override
  public Object convert(Object object) {
    StorageMetadataGCSConfig gcsConfig =
        (StorageMetadataGCSConfig) JsonUtils.convertValue(object, this.clazz);

    tryToConvert(gcsConfig.getSecurityConfig(), List.of(GCPCredentials.class))
        .ifPresent(obj -> gcsConfig.setSecurityConfig((GCPCredentials) obj));

    return gcsConfig;
  }
}
