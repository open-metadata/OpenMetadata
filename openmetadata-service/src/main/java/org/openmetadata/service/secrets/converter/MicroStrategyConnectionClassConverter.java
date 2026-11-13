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
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.dashboard.MicroStrategyConnection;
import org.openmetadata.schema.utils.JsonUtils;

/** Converts the `sslConfig` of a MicroStrategy connection, so its client certificate and key are kept as secrets. */
public class MicroStrategyConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> SSL_SOURCE_CLASS = List.of(ValidateSSLClientConfig.class);

  public MicroStrategyConnectionClassConverter() {
    super(MicroStrategyConnection.class);
  }

  @Override
  public Object convert(Object object) {
    MicroStrategyConnection connection =
        (MicroStrategyConnection) JsonUtils.convertValue(object, this.clazz);
    tryToConvert(connection.getSslConfig(), SSL_SOURCE_CLASS).ifPresent(connection::setSslConfig);
    return connection;
  }
}
