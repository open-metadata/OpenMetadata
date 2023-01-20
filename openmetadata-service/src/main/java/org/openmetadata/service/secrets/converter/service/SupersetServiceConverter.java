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
import java.util.Map;
import java.util.Objects;
import org.openmetadata.schema.entity.utils.SupersetApiConnection;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.service.util.JsonUtils;

/** Factory class to get a `ServiceConverter` based on the service class. */
public class SupersetServiceConverter extends ServiceConverter {

  private static final List<Class<?>> CONNECTION_CLASSES =
      List.of(SupersetApiConnection.class, MysqlConnection.class, PostgresConnection.class);

  public SupersetServiceConverter(Class<?> serviceClass) {
    super(serviceClass);
  }

  @Override
  public Object convertFromJson(Object connectionConfig) {
    SupersetConnection supersetConnection =
        (SupersetConnection) JsonUtils.convertValue(connectionConfig, this.serviceClass);
    if (supersetConnection.getConnection() instanceof Map) {
      Object connection =
          CONNECTION_CLASSES.stream()
              .map(clazz -> convertConnectionFromJson(supersetConnection.getConnection(), clazz))
              .filter(Objects::nonNull)
              .findFirst()
              .orElse(null);
      supersetConnection.setConnection(connection);
    }
    return supersetConnection;
  }

  private Object convertConnectionFromJson(Object connection, Class<?> clazz) {
    try {
      return JsonUtils.convertValue(connection, clazz);
    } catch (Exception ignore) {
      // this can be ignored
      return null;
    }
  }
}
