package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.StringWriter;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.service.rdf.semantic.EmbeddingService;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;

class SemanticSearchQueryBuilderTest {

  @Test
  void buildSemanticQueryUsesDocEmbeddingReference() {
    EmbeddingService embeddingService = mock(EmbeddingService.class);
    when(embeddingService.generateEmbedding("revenue metrics")).thenReturn(new float[] {0.1f, 0.2f});

    try (MockedStatic<EmbeddingService> mockedStatic = Mockito.mockStatic(EmbeddingService.class)) {
      mockedStatic.when(EmbeddingService::getInstance).thenReturn(embeddingService);

      SearchRequest request =
          new SearchRequest()
              .withQuery("revenue metrics")
              .withIndex("table")
              .withSemanticSearch(true);

      SemanticSearchQueryBuilder builder = new SemanticSearchQueryBuilder();
      Query query = builder.buildSemanticQuery(request);

      assertNotNull(query);

      JacksonJsonpMapper mapper = new JacksonJsonpMapper();
      StringWriter writer = new StringWriter();
      var generator = mapper.jsonProvider().createGenerator(writer);
      query.serialize(generator, mapper);
      generator.close();

      String json = writer.toString();
      assertTrue(json.contains("doc['embedding']"), json);
      assertTrue(!json.contains("'embedding'"), json);
    }
  }
}
