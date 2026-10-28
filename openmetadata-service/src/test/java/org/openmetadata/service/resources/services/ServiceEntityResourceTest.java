package org.openmetadata.service.resources.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class ServiceEntityResourceTest {

  @Test
  void aVersionThatCannotBeDecryptedLosesItsConnectionAndKeepsTheRest() {
    String stored =
        """
        {"id":"8f4c2a1e-3b5d-4f6a-9c7e-1d2b3a4c5d6e","name":"mysql_prod","version":0.2,
         "connection":{"config":{"type":"Mysql","hostPort":"db:3306","username":"etl",
         "authType":{"password":"fernet:gAAAAABstoredCiphertext"}}}}
        """;

    JsonNode returned = JsonUtils.readTree(ServiceEntityResource.withoutConnection(stored));

    assertFalse(returned.has("connection"));
    assertEquals("mysql_prod", returned.get("name").asText());
    assertEquals(0.2, returned.get("version").asDouble());
  }
}
