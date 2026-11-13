package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.core.UpdateRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.search.SearchClient;

class ElasticSearchEntityManagerUpsertTest {
  private final ObjectMapper objectMapper = new ObjectMapper();

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void updatePreservesJsonTypesInUpsertAndScriptParameters(boolean emptySuites) throws Exception {
    final List<Map<String, Object>> suites =
        emptySuites ? List.of() : List.of(Map.of("id", "suite-id", "name", "suite", "basic", true));
    final Map<String, Object> document =
        Map.of(
            "name",
            "data_exists",
            "testSuites",
            suites,
            "testSuitesRevision",
            2L,
            "testCaseResult",
            Map.of("testCaseStatus", "Success", "timestamp", 123L));
    final JsonNode payload = captureUpdate(document);
    final JsonNode expected = objectMapper.readTree(objectMapper.writeValueAsString(document));

    // JsonData values work as script parameters but serialize as {} inside a generic Map upsert.
    assertTrue(payload.path("upsert").path("testSuites").isArray(), payload.toString());
    assertEquals(expected, payload.path("upsert"));
    assertEquals(expected, payload.path("script").path("params"));
    assertTrue(payload.path("scripted_upsert").asBoolean());
  }

  @Test
  void updateRetainsNullFieldRemovalParameters() throws Exception {
    final Map<String, Object> document = new HashMap<>();
    document.put("name", "data_exists");
    document.put("tier", null);
    final JsonNode payload = captureUpdate(document);
    final JsonNode parameters = payload.path("script").path("params");

    assertEquals("data_exists", payload.path("upsert").path("name").asText());
    assertEquals("data_exists", parameters.path("name").asText());
    assertFalse(parameters.has("tier"));
    assertEquals(objectMapper.readTree("[\"tier\"]"), parameters.path("fieldsToRemove"));
  }

  @Test
  void updatePreservesEmptyDocument() throws Exception {
    final JsonNode payload = captureUpdate(Map.of());

    assertEquals(objectMapper.readTree("{}"), payload.path("upsert"));
    assertEquals(objectMapper.readTree("{}"), payload.path("script").path("params"));
  }

  private JsonNode captureUpdate(Map<String, Object> document) throws Exception {
    final UpdateRequest<Map, Map> request =
        new ElasticSearchEntityManager(null)
            .buildUpdateEntityRequest(
                "test_case_search_index", "case-id", document, SearchClient.DEFAULT_UPDATE_SCRIPT);
    return serialize(request);
  }

  private JsonNode serialize(UpdateRequest<?, ?> request) throws Exception {
    final JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    final StringWriter writer = new StringWriter();
    try (JsonGenerator generator = mapper.jsonProvider().createGenerator(writer)) {
      request.serialize(generator, mapper);
    }
    return objectMapper.readTree(writer.toString());
  }
}
