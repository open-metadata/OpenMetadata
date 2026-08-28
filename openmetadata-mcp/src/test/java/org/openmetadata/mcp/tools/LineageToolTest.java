package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LineageToolTest {

  private static IllegalArgumentException rejects(Map<String, Object> params) {
    return assertThrows(
        IllegalArgumentException.class, () -> new LineageTool().execute(null, null, params));
  }

  @Test
  void rejectsAnEndpointWithNeitherFqnNorId() {
    Map<String, Object> params = new HashMap<>();
    params.put("fromEntity", Map.of("type", "table"));
    params.put("toEntity", Map.of("type", "table", "fqn", "svc.db.schema.target"));

    String message = rejects(params).getMessage();

    assertTrue(message.contains("fromEntity"), "the failing parameter must be named: " + message);
    assertTrue(
        message.contains("'fqn'") && message.contains("'id'"),
        "the message must name both accepted identifiers so the model can retry without guessing: "
            + message);
    assertTrue(
        message.contains("search results return"),
        "the message should point at the identifier the caller already has: " + message);
  }

  @Test
  void rejectsAnEndpointThatIsNotAnObject() {
    Map<String, Object> params = new HashMap<>();
    params.put("fromEntity", "svc.db.schema.source");
    params.put("toEntity", Map.of("type", "table", "fqn", "svc.db.schema.target"));

    String message = rejects(params).getMessage();

    assertTrue(
        message.contains("must be an object"),
        "a bare string endpoint must be explained, not cast-cast-crashed: " + message);
  }
}
