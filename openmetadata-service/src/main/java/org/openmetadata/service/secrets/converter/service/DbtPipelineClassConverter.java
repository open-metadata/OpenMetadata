/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.secrets.converter.service;

import java.util.List;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtCloudConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtGCSConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtHttpConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtLocalConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtS3Config;
import org.openmetadata.service.util.JsonUtils;

/** Converter class to get an `SourceConfig` object. */
public class DbtPipelineClassConverter extends ClassConverter {

  private static final List<Class<?>> DBT_CONFIG_CLASSES =
      List.of(DbtCloudConfig.class, DbtGCSConfig.class, DbtHttpConfig.class, DbtLocalConfig.class, DbtS3Config.class);

  public DbtPipelineClassConverter() {
    super(DbtPipeline.class);
  }

  @Override
  public Object convert(Object object) {
    DbtPipeline dbtPipeline = (DbtPipeline) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(dbtPipeline.getDbtConfigSource(), DBT_CONFIG_CLASSES).ifPresent(dbtPipeline::setDbtConfigSource);

    return dbtPipeline;
  }
}
