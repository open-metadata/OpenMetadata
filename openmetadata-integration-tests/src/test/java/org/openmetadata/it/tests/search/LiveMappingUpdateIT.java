package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

/**
 * {@code openmetadata-ops migrate} pushes each mapping file to its existing index. A custom
 * search analyzer cannot be added to an open index, and the mapping update is all-or-nothing, so
 * the update must skip the new {@code search_analyzer} and still apply every other change; the
 * analyzer arrives when the index is recreated.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
class LiveMappingUpdateIT {
  private static final String MAPPING_FILE = "/elasticsearch/%s/it_live_mapping_update.json";

  @Test
  void updateAppliesNewFieldsToAnIndexWithoutTheNewAnalyzer(TestNamespace ns) throws Exception {
    ServerHandle server = OssTestServer.defaultHandle();
    assumeFalse(server.isExternal(), "drives the in-process SearchRepository");
    SearchClient cluster = new SearchClient(server);
    SearchRepository repository = Entity.getSearchRepository();
    String name = "it_live_mapping_" + ns.uniqueShortId();
    IndexMapping mapping =
        IndexMapping.builder()
            .indexName(name)
            .indexMappingFile(MAPPING_FILE)
            .alias(name + "_alias")
            .parentAliases(List.of())
            .childAliases(List.of())
            .build();
    String index = mapping.getIndexName(repository.getClusterAlias());
    try {
      cluster.put("/" + index, previousMapping());

      repository.updateIndex(mapping);

      JsonNode properties = properties(cluster, index);
      assertThat(properties.path("newField").path("type").asText()).isEqualTo("keyword");
      assertThat(ngramField(properties).has("search_analyzer")).isFalse();

      cluster.delete("/" + index);
      repository.updateIndex(mapping);

      assertThat(ngramField(properties(cluster, index)).path("search_analyzer").asText())
          .isEqualTo("om_ngram_search");
    } finally {
      cluster.delete("/" + index);
    }
  }

  /** The same mapping before this change: no search-time twin and no new field. */
  private static String previousMapping() throws IOException {
    ObjectNode root = (ObjectNode) JsonUtils.readTree(resource());
    JsonNode analysis = root.path("settings").path("analysis");
    ((ObjectNode) analysis.path("analyzer")).remove("om_ngram_search");
    ((ObjectNode) analysis.path("tokenizer")).remove("om_ngram_search_tokenizer");
    ((ObjectNode) analysis.path("filter")).removeAll();
    JsonNode properties = root.path("mappings").path("properties");
    ((ObjectNode) properties).remove("newField");
    ((ObjectNode) ngramField(properties)).remove("search_analyzer");
    return JsonUtils.pojoToJson(root);
  }

  private static String resource() throws IOException {
    try (InputStream in =
        LiveMappingUpdateIT.class.getResourceAsStream(String.format(MAPPING_FILE, "en"))) {
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  /** The response is keyed by the concrete index, which may sit behind the name as an alias. */
  private static JsonNode properties(SearchClient cluster, String index) {
    JsonNode body = cluster.mapping(index);
    return body.elements().next().path("mappings").path("properties");
  }

  private static JsonNode ngramField(JsonNode properties) {
    return properties.path("name").path("fields").path("ngram");
  }
}
