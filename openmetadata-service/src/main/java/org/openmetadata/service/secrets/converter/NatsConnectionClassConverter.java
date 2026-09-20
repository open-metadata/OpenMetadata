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
import org.openmetadata.schema.services.connections.messaging.NatsConnection;
import org.openmetadata.schema.services.connections.messaging.nats.BasicAuth;
import org.openmetadata.schema.services.connections.messaging.nats.NkeyAuth;
import org.openmetadata.schema.services.connections.messaging.nats.TokenAuth;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Converter class to get a `NatsConnection` object.
 *
 * <p>`authType` and `tlsConfig` are `oneOf`, so they are generated as `Object` and arrive as a
 * `LinkedHashMap`. The secrets manager and the masker only walk into `org.openmetadata` objects, so
 * without this conversion the password, token, NKey seed and SSL key are stored in the clear.
 */
public class NatsConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> AUTH_CLASSES =
      List.of(BasicAuth.class, TokenAuth.class, NkeyAuth.class);

  private static final List<Class<?>> TLS_CLASSES = List.of(ValidateSSLClientConfig.class);

  public NatsConnectionClassConverter() {
    super(NatsConnection.class);
  }

  @Override
  public Object convert(Object object) {
    NatsConnection natsConnection = (NatsConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvert(natsConnection.getAuthType(), AUTH_CLASSES).ifPresent(natsConnection::setAuthType);

    tryToConvert(natsConnection.getTlsConfig(), TLS_CLASSES)
        .ifPresent(natsConnection::setTlsConfig);

    return natsConnection;
  }
}
