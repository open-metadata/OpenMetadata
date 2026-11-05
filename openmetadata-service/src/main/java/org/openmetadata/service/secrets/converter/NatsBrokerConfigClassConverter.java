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
import org.openmetadata.schema.services.connections.messaging.nats.BasicAuth;
import org.openmetadata.schema.services.connections.messaging.nats.NkeyAuth;
import org.openmetadata.schema.services.connections.messaging.nats.TokenAuth;
import org.openmetadata.schema.services.connections.pipeline.openlineage.NatsBrokerConfig;
import org.openmetadata.schema.services.connections.pipeline.openlineage.nats.CredentialsAuth;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Converter class to get a `NatsBrokerConfig` object.
 *
 * <p>Same reason as {@link NatsConnectionClassConverter}: the `oneOf` fields are generated as
 * `Object`, and a `LinkedHashMap` is walked by neither the secrets manager nor the masker.
 */
public class NatsBrokerConfigClassConverter extends ClassConverter {

  private static final List<Class<?>> AUTH_CLASSES =
      List.of(BasicAuth.class, TokenAuth.class, NkeyAuth.class, CredentialsAuth.class);

  private static final List<Class<?>> TLS_CLASSES = List.of(ValidateSSLClientConfig.class);

  public NatsBrokerConfigClassConverter() {
    super(NatsBrokerConfig.class);
  }

  @Override
  public Object convert(Object object) {
    NatsBrokerConfig brokerConfig = (NatsBrokerConfig) JsonUtils.convertValue(object, this.clazz);

    tryToConvert(brokerConfig.getAuthType(), AUTH_CLASSES).ifPresent(brokerConfig::setAuthType);

    tryToConvert(brokerConfig.getTlsConfig(), TLS_CLASSES).ifPresent(brokerConfig::setTlsConfig);

    return brokerConfig;
  }
}
