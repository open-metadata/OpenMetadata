package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.services.connections.pipeline.MatillionConnection;
import org.openmetadata.schema.services.connections.pipeline.matillion.MatillionDPCAuth;
import org.openmetadata.schema.services.connections.pipeline.matillion.MatillionETLAuth;
import org.openmetadata.schema.utils.JsonUtils;

class MatillionConnectionClassConverterTest {

  private final ClassConverter converter =
      ClassConverterFactory.getConverter(MatillionConnection.class);

  @Test
  void testConvertsETLAuth() {
    MatillionETLAuth etlAuth = new MatillionETLAuth().withHostPort("https://matillion.example.com");

    MatillionConnection input = new MatillionConnection().withConnection(etlAuth);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    MatillionConnection result = (MatillionConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertInstanceOf(MatillionETLAuth.class, result.getConnection());
  }

  @Test
  void testConvertsDPCAuth() {
    MatillionDPCAuth dpcAuth =
        new MatillionDPCAuth().withClientId("client-id").withClientSecret("secret");

    MatillionConnection input = new MatillionConnection().withConnection(dpcAuth);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    MatillionConnection result = (MatillionConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertInstanceOf(MatillionDPCAuth.class, result.getConnection());
  }

  @Test
  void testNullConnectionDoesNotThrow() {
    MatillionConnection input = new MatillionConnection();
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    MatillionConnection result = (MatillionConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertNull(result.getConnection());
  }
}
