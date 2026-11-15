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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.util.Map;
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

  @Test
  void testRejectsAuthTypeMixingBothOptions() {
    Map<String, String> mixed =
        Map.of(
            "clientSecret", "fixture-client-secret",
            "certificate", "fixture-certificate",
            "privateKey", "fixture-private-key");

    IllegalArgumentException thrown =
        assertThrows(IllegalArgumentException.class, () -> convert(mixed));

    assertTrue(
        thrown.getMessage().contains("Field 'authType.clientSecret' is an undeclared field"));
    assertFalse(thrown.getMessage().contains("fixture-client-secret"));
    assertFalse(thrown.getMessage().contains("fixture-private-key"));
  }

  @Test
  void testIncompleteCertificateIsRejectedOnWriteAndProtectedOnRead() {
    Map<String, String> auth = Map.of("certificate", "fixture-certificate");
    SchemaConversionException failure =
        assertThrows(SchemaConversionException.class, () -> convert(auth));
    assertTrue(failure.getMessage().contains("Field 'authType.privateKey' is required"));
    assertFalse(failure.getMessage().contains("fixture-certificate"));

    MicrosoftFabricConnection stored =
        (MicrosoftFabricConnection) converter.convertForRead(Map.of("authType", auth));
    SchemaBackedMap read = assertInstanceOf(SchemaBackedMap.class, stored.getAuthType());
    assertEquals(auth, read);
    read.visitSecrets(slot -> slot.setValue(PASSWORD_MASK));
    assertEquals(Map.of("certificate", PASSWORD_MASK), read);
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
