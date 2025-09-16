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
import org.openmetadata.schema.entity.utils.SupersetApiConnection;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `SupersetConnection` object. */
public class SupersetConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CONNECTION_CLASSES =
      List.of(SupersetApiConnection.class, MysqlConnection.class, PostgresConnection.class);

  public SupersetConnectionClassConverter() {
    super(SupersetConnection.class);
  }

  @Override
  public Object convert(Object object) {
    SupersetConnection supersetConnection =
        (SupersetConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(supersetConnection.getConnection(), CONNECTION_CLASSES)
        .ifPresent(supersetConnection::setConnection);

    return supersetConnection;
  }
}
