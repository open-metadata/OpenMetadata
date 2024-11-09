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
import org.openmetadata.schema.services.connections.database.HiveConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.service.util.JsonUtils;

/** Converter class to get an `DatalakeConnection` object. */
public class HiveConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CONFIG_SOURCE_CLASSES =
      List.of(MysqlConnection.class, PostgresConnection.class);

  public HiveConnectionClassConverter() {
    super(HiveConnection.class);
  }

  @Override
  public Object convert(Object object) {
    HiveConnection hiveConnection = (HiveConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvert(hiveConnection.getMetastoreConnection(), CONFIG_SOURCE_CLASSES)
        .ifPresent(hiveConnection::setMetastoreConnection);

    return hiveConnection;
  }
}
