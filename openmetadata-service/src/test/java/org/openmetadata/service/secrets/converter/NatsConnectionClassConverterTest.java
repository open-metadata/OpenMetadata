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

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.messaging.NatsConnection;
import org.openmetadata.schema.services.connections.messaging.nats.BasicAuth;
import org.openmetadata.schema.services.connections.messaging.nats.NkeyAuth;
import org.openmetadata.schema.services.connections.messaging.nats.TokenAuth;
import org.openmetadata.schema.utils.JsonUtils;

class NatsConnectionClassConverterTest {

  private final ClassConverter converter = ClassConverterFactory.getConverter(NatsConnection.class);

  @Test
  void testConvertsEachAuthVariantToItsOwnClass() {
    // a LinkedHashMap here would mean neither the masker nor the secrets manager reaches the
    // password, token or seed, because both only walk into org.openmetadata objects
    assertInstanceOf(
        BasicAuth.class, convertedAuth(Map.of("username", "om", "password", "s3cret")));
    assertInstanceOf(TokenAuth.class, convertedAuth(Map.of("token", "s3cret")));
    assertInstanceOf(NkeyAuth.class, convertedAuth(Map.of("nkeySeed", "SUACSSL")));
  }

  @Test
  void testConvertsTlsConfig() {
    NatsConnection result =
        convert(
            new NatsConnection()
                .withNatsServers("nats://localhost:4222")
                .withTlsConfig(Map.of("sslKey", "-----BEGIN PRIVATE KEY-----")));

    assertInstanceOf(ValidateSSLClientConfig.class, result.getTlsConfig());
  }

  @Test
  void testNullAuthTypeDoesNotThrow() {
    NatsConnection result = convert(new NatsConnection().withNatsServers("nats://localhost:4222"));

    assertNotNull(result);
    assertNull(result.getAuthType());
  }

  private Object convertedAuth(Map<String, String> authType) {
    return convert(
            new NatsConnection().withNatsServers("nats://localhost:4222").withAuthType(authType))
        .getAuthType();
  }

  private NatsConnection convert(NatsConnection connection) {
    Object raw = JsonUtils.readValue(JsonUtils.pojoToJson(connection), Object.class);
    return (NatsConnection) converter.convert(raw);
  }
}
