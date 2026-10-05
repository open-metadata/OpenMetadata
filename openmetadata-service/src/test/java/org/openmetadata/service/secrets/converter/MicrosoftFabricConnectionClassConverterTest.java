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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.services.connections.database.MicrosoftFabricConnection;
import org.openmetadata.schema.services.connections.database.microsoftFabric.CertificateAuthentication;
import org.openmetadata.schema.services.connections.database.microsoftFabric.ClientSecretAuthentication;
import org.openmetadata.schema.utils.JsonUtils;

class MicrosoftFabricConnectionClassConverterTest {

  private final ClassConverter converter =
      ClassConverterFactory.getConverter(MicrosoftFabricConnection.class);

  @Test
  void testConvertsCertificateAuthentication() {
    CertificateAuthentication auth =
        new CertificateAuthentication()
            .withCertificate("fixture-certificate")
            .withPrivateKey("fixture-private-key")
            .withPrivateKeyPassphrase("fixture-passphrase");

    MicrosoftFabricConnection result = convert(auth);

    CertificateAuthentication converted =
        assertInstanceOf(CertificateAuthentication.class, result.getAuthType());
    assertEquals("fixture-certificate", converted.getCertificate());
    assertEquals("fixture-private-key", converted.getPrivateKey());
    assertEquals("fixture-passphrase", converted.getPrivateKeyPassphrase());
  }

  @Test
  void testConvertsClientSecretAuthentication() {
    ClientSecretAuthentication auth =
        new ClientSecretAuthentication().withClientSecret("fixture-client-secret");

    MicrosoftFabricConnection result = convert(auth);

    ClientSecretAuthentication converted =
        assertInstanceOf(ClientSecretAuthentication.class, result.getAuthType());
    assertEquals("fixture-client-secret", converted.getClientSecret());
  }

  private MicrosoftFabricConnection convert(Object authType) {
    MicrosoftFabricConnection input =
        new MicrosoftFabricConnection()
            .withHostPort("workspace.datawarehouse.fabric.example.test")
            .withClientId("fixture-client-id")
            .withTenantId("fixture-tenant-id")
            .withAuthType(authType);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);
    return (MicrosoftFabricConnection) converter.convert(rawInput);
  }
}
