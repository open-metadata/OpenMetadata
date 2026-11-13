package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.dashboard.MicroStrategyConnection;
import org.openmetadata.schema.utils.JsonUtils;

class MicroStrategyConnectionClassConverterTest {

  private final ClassConverter converter =
      ClassConverterFactory.getConverter(MicroStrategyConnection.class);

  @Test
  void sslConfigBecomesTypedSoItsCertificateAndKeyAreTreatedAsSecrets() {
    Map<String, Object> raw =
        Map.of(
            "hostPort",
            "https://mstr.example.com",
            "sslConfig",
            Map.of("caCertificate", "ca", "sslCertificate", "cert", "sslKey", "key"));

    MicroStrategyConnection result = (MicroStrategyConnection) converter.convert(raw);

    ValidateSSLClientConfig ssl =
        assertInstanceOf(ValidateSSLClientConfig.class, result.getSslConfig());
    assertEquals("cert", ssl.getSslCertificate());
    assertEquals("key", ssl.getSslKey());
  }

  @Test
  void connectionWithoutSslConfigIsLeftWithout() {
    Object raw =
        JsonUtils.readValue(
            JsonUtils.pojoToJson(
                new MicroStrategyConnection()
                    .withHostPort(java.net.URI.create("https://mstr.example.com"))),
            Object.class);

    MicroStrategyConnection result = (MicroStrategyConnection) converter.convert(raw);

    assertNull(result.getSslConfig());
  }
}
