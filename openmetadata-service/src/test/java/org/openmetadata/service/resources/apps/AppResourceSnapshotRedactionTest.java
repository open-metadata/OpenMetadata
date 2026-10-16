package org.openmetadata.service.resources.apps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class AppResourceSnapshotRedactionTest {

  @Test
  void rawSnapshotWithSecretsGetsRedacted() {
    String snapshot =
        """
        {"name":"myapp","openMetadataServerConnection":{"securityConfig":{"jwtToken":"secret"}},\
        "privateConfiguration":{"token":"abc"},"appConfiguration":{"keep":"me"}}""";

    JsonNode result =
        JsonUtils.readTree((String) AppResource.redactRuntimeSecretsFromRawSnapshot(snapshot));

    assertFalse(result.has("openMetadataServerConnection"));
    assertFalse(result.has("privateConfiguration"));
    assertTrue(result.has("appConfiguration"));
    assertEquals("myapp", result.get("name").asText());
  }

  @Test
  void rawSnapshotWithoutSecretsIsPreserved() {
    String snapshot = "{\"name\":\"myapp\",\"appConfiguration\":{\"keep\":\"me\"}}";

    JsonNode result =
        JsonUtils.readTree((String) AppResource.redactRuntimeSecretsFromRawSnapshot(snapshot));

    assertEquals("myapp", result.get("name").asText());
    assertTrue(result.has("appConfiguration"));
  }

  @Test
  void unparseableSnapshotFailsClosed() {
    Object result = AppResource.redactRuntimeSecretsFromRawSnapshot("not-json");

    assertEquals("{}", result);
  }
}
