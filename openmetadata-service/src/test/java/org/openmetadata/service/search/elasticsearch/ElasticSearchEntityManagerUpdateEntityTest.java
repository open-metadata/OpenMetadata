package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.core.UpdateRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class ElasticSearchEntityManagerUpdateEntityTest {

  private static final String TEST_CASE_ID = "11111111-1111-1111-1111-111111111111";

  private final ElasticSearchEntityManager entityManager = new ElasticSearchEntityManager(null);

  /**
   * The upsert is the document the cluster stores when the target doc is missing. A logical test
   * suite's relationship-preserving script keeps whatever {@code tests}/{@code testsRevision} the
   * upsert carried, so an upsert serialized as {@code {}} per field left {@code tests: {}} in the
   * index and failed {@code testSuites/search/list} with a 400 (#33492).
   */
  @Test
  void upsertDocumentCarriesFieldValues() {
    Map<String, Object> doc = new HashMap<>();
    doc.put("name", "suite");
    doc.put("tests", List.of(Map.of("id", TEST_CASE_ID, "type", "testCase")));
    doc.put("testsRevision", 5L);

    JsonNode upsert = serializeUpsert(doc);

    assertTrue(upsert.path("tests").isArray(), "tests must be stored as an array: " + upsert);
    assertEquals(TEST_CASE_ID, upsert.path("tests").path(0).path("id").asText());
    assertEquals(5L, upsert.path("testsRevision").asLong());
    assertEquals("suite", upsert.path("name").asText());
  }

  @Test
  void upsertDocumentOmitsNullFieldsAndRemovalInstructions() {
    Map<String, Object> doc = new HashMap<>();
    doc.put("name", "suite");
    doc.put("tier", null);
    doc.put("fieldsToRemove", List.of("certification"));

    JsonNode upsert = serializeUpsert(doc);

    assertFalse(upsert.has("tier"), "null fields must not be stored: " + upsert);
    assertFalse(upsert.has("fieldsToRemove"), "script instructions are not document data");
  }

  private JsonNode serializeUpsert(Map<String, Object> doc) {
    UpdateRequest<Map, Map> request =
        entityManager.buildUpdateEntityRequest("test_suite_search_index", "id", doc, "script");
    JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    StringWriter writer = new StringWriter();
    try (JsonGenerator generator = mapper.jsonProvider().createGenerator(writer)) {
      request.serialize(generator, mapper);
    }
    return JsonUtils.readTree(writer.toString()).path("upsert");
  }
}
