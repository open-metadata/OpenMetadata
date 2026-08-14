package org.openmetadata.service.search;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.json.stream.JsonGenerator;
import java.io.IOException;
import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.opensearch.OpenSearchRequestBuilder;
import org.openmetadata.service.search.opensearch.OpenSearchSourceBuilderFactory;
import org.openmetadata.service.util.EntityUtil;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;

class ScratchDumpQueriesTest {
  @Test
  void dump() throws IOException {
    SearchRepository mockSearchRepository = mock(SearchRepository.class);
    when(mockSearchRepository.getIndexNameWithoutAlias(anyString()))
        .thenAnswer(invocation -> invocation.getArgument(0));
    Entity.setSearchRepository(mockSearchRepository);
    List<String> jsonDataFiles =
        EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
    String json =
        CommonUtil.getResourceAsStream(
            EntityRepository.class.getClassLoader(), jsonDataFiles.getFirst());
    SearchSettings settings = JsonUtils.readValue(json, SearchSettings.class);
    OpenSearchSourceBuilderFactory factory = new OpenSearchSourceBuilderFactory(settings);
    Path outDir = Path.of("/tmp/om_queries");
    Files.createDirectories(outDir);
    List<String> queries = Files.readAllLines(Path.of("/tmp/om_query_list.txt"));
    for (int index = 0; index < queries.size(); index++) {
      String query = queries.get(index);
      if (query.isBlank()) {
        continue;
      }
      OpenSearchRequestBuilder builder =
          factory.getSearchSourceBuilderV2(
              System.getProperty("dumpIndex", Entity.TABLE), query, 0, 25);
      JacksonJsonpMapper mapper = new JacksonJsonpMapper();
      StringWriter writer = new StringWriter();
      JsonGenerator generator = mapper.jsonProvider().createGenerator(writer);
      builder.build("table_search_index").serialize(generator, mapper);
      generator.close();
      Files.writeString(outDir.resolve(index + ".json"), writer.toString());
    }
  }
}
