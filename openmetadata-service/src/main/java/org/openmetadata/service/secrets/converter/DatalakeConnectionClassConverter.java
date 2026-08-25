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

package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.services.connections.database.DatalakeConnection;
import org.openmetadata.schema.services.connections.database.datalake.AzureConfig;
import org.openmetadata.schema.services.connections.database.datalake.GCSConfig;
import org.openmetadata.schema.services.connections.database.datalake.S3Config;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `DatalakeConnection` object. */
public class DatalakeConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CONFIG_SOURCE_CLASSES =
      List.of(GCSConfig.class, S3Config.class, AzureConfig.class);

  public DatalakeConnectionClassConverter() {
    super(DatalakeConnection.class);
  }

  @Override
  public Object convert(Object object) {
    DatalakeConnection datalakeConnection =
        (DatalakeConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(datalakeConnection.getConfigSource(), CONFIG_SOURCE_CLASSES)
        .ifPresent(datalakeConnection::setConfigSource);

    return datalakeConnection;
  }
}
