package org.openmetadata.service.search;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.DeleteByQueryResponse;
import os.org.opensearch.client.opensearch.indices.OpenSearchIndicesClient;
import os.org.opensearch.client.opensearch.indices.RefreshResponse;
import os.org.opensearch.client.transport.endpoints.BooleanResponse;

@Isolated
class OntologyChunkIndexTest {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void reconcilesOnlyExistingChunksWhenEmbeddingsAreDisabled(boolean chunksExist) throws Exception {
    final var previous = Entity.getSearchRepository();
    final var repository = mock(SearchRepository.class);
    final var client = mock(OpenSearchClient.class);
    final var backend = mock(os.org.opensearch.client.opensearch.OpenSearchClient.class);
    final var indices = mock(OpenSearchIndicesClient.class);
    final var deleted = mock(DeleteByQueryResponse.class);
    when(repository.isVectorEmbeddingEnabled()).thenReturn(false);
    when(client.getNewClient()).thenReturn(backend);
    when(backend.indices()).thenReturn(indices);
    when(indices.exists(any(Function.class))).thenReturn(new BooleanResponse(chunksExist));
    when(indices.refresh(any(Function.class)))
        .thenReturn(RefreshResponse.of(r -> r.shards(s -> s.failed(0).successful(1).total(1))));
    when(backend.deleteByQuery(any(Function.class))).thenReturn(deleted);
    when(deleted.failures()).thenReturn(List.of());
    Entity.setSearchRepository(repository);
    try {
      OntologyChunkIndex.reconcile(
          client,
          "",
          List.of(
              new EntityReference().withId(UUID.randomUUID()).withType(Entity.ONTOLOGY_CONCEPT)),
          Map.of());
      verify(indices, times(chunksExist ? 1 : 0)).refresh(any(Function.class));
      verify(backend, times(chunksExist ? 1 : 0)).deleteByQuery(any(Function.class));
    } finally {
      Entity.setSearchRepository(previous);
    }
  }
}
