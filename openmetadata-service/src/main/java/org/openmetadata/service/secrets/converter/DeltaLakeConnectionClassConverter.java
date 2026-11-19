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
import org.openmetadata.schema.services.connections.database.datalake.S3Config;
import org.openmetadata.schema.services.connections.database.deltalake.MetastoreConfig;
import org.openmetadata.schema.services.connections.database.deltalake.StorageConfig;
import org.openmetadata.schema.services.connections.database.deltalake.metastore.MetastoreDbConnection;
import org.openmetadata.schema.services.connections.database.deltalake.metastore.MetastoreFilePathConnection;
import org.openmetadata.schema.services.connections.database.deltalake.metastore.MetastoreHostPortConnection;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `DeltaLakeConnection` object. */
public class DeltaLakeConnectionClassConverter extends ClassConverter {

  // StorageConfig first: both accept a "connection", but only StorageConfig's converter rejects a
  // connection of the other kind, so trying MetastoreConfig first would take an S3 config as a
  // metastore one and leave its credentials untyped.
  private static final List<Class<?>> CONFIG_SOURCE_CLASSES =
      List.of(StorageConfig.class, MetastoreConfig.class);

  /**
   * The connections a metastore config can hold. Released 2.0 versions tried the metastore config
   * first, so a storage config was saved as one, with its default appName: its S3 config is typed
   * here, as the last candidate.
   */
  static final List<Class<?>> METASTORE_CONNECTION_CLASSES =
      List.of(
          MetastoreHostPortConnection.class,
          MetastoreDbConnection.class,
          MetastoreFilePathConnection.class,
          S3Config.class);

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
