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
import org.openmetadata.schema.services.connections.database.DeltaLakeConnection;
import org.openmetadata.schema.services.connections.database.deltalake.MetastoreConfig;
import org.openmetadata.schema.services.connections.database.deltalake.StorageConfig;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `DeltaLakeConnection` object. */
public class DeltaLakeConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CONFIG_SOURCE_CLASSES =
      List.of(MetastoreConfig.class, StorageConfig.class);

  public DeltaLakeConnectionClassConverter() {
    super(DeltaLakeConnection.class);
  }

  @Override
  public Object convert(Object object) {
    DeltaLakeConnection deltalakeConnection =
        (DeltaLakeConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(deltalakeConnection.getConfigSource(), CONFIG_SOURCE_CLASSES)
        .ifPresent(deltalakeConnection::setConfigSource);

    return deltalakeConnection;
  }
}
