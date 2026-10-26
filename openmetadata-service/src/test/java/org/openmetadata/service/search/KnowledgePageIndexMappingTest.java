package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class KnowledgePageIndexMappingTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static JsonNode properties(String language) throws IOException {
    String path = "/elasticsearch/" + language + "/knowledge_page_search_index.json";
    try (InputStream in = KnowledgePageIndexMappingTest.class.getResourceAsStream(path)) {
      assertNotNull(in, "missing resource " + path);
      return MAPPER.readTree(in).path("mappings").path("properties");
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"en", "jp", "ko", "ru", "zh"})
  void idHasTheKeywordSubfieldTheSortTiebreakerUses(String language) throws IOException {
    // Every search query sorts on id.keyword as its tiebreaker. Without the subfield a page hit
    // sorts as null, search_after cannot move past it and a paginating client re-reads one page.
    assertEquals("keyword", properties(language).at("/id/fields/keyword/type").asText(), language);
  }
}
