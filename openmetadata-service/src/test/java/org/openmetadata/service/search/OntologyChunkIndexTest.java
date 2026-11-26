package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.vector.VectorIndexService;
import os.org.opensearch.client.opensearch._types.ShardStatistics;
import os.org.opensearch.client.opensearch.core.DeleteByQueryRequest;
import os.org.opensearch.client.opensearch.core.DeleteByQueryResponse;
import os.org.opensearch.client.opensearch.indices.OpenSearchIndicesClient;
import os.org.opensearch.client.opensearch.indices.RefreshRequest;
import os.org.opensearch.client.opensearch.indices.RefreshResponse;
import os.org.opensearch.client.util.ObjectBuilder;

class OntologyChunkIndexTest {

  private static final String STAGED = "ontology_embeddings_chunks_g2";

  @Test
  @SuppressWarnings("unchecked")
  void staleTermChunksAreDeletedFromTheGenerationTheRunStaged() throws Exception {
    OpenSearchClient client = mock(OpenSearchClient.class, RETURNS_DEEP_STUBS);
    OpenSearchIndicesClient indices = client.getNewClient().indices();
    RefreshResponse refreshed = mock(RefreshResponse.class);
    when(refreshed.shards()).thenReturn(mock(ShardStatistics.class));
    when(indices.refresh(any(Function.class))).thenReturn(refreshed);
    DeleteByQueryResponse deleted = mock(DeleteByQueryResponse.class);
    when(deleted.failures()).thenReturn(List.of());
    when(client.getNewClient().deleteByQuery(any(Function.class))).thenReturn(deleted);
    SearchRepository searchRepository = mock(SearchRepository.class);
    VectorIndexService vectors = mock(VectorIndexService.class);
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    when(searchRepository.getVectorIndexService()).thenReturn(vectors);
    when(vectors.stagedOntologyChunkTarget()).thenReturn(Optional.of(STAGED));
    EntityReference term =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.ONTOLOGY_CONCEPT);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      OntologyChunkIndex.reconcile(client, null, List.of(term), Map.of());
    }

    ArgumentCaptor<Function<RefreshRequest.Builder, ObjectBuilder<RefreshRequest>>> refresh =
        ArgumentCaptor.forClass(Function.class);
    verify(indices).refresh(refresh.capture());
    assertEquals(
        List.of(STAGED), refresh.getValue().apply(new RefreshRequest.Builder()).build().index());
    ArgumentCaptor<Function<DeleteByQueryRequest.Builder, ObjectBuilder<DeleteByQueryRequest>>>
        delete = ArgumentCaptor.forClass(Function.class);
    verify(client.getNewClient()).deleteByQuery(delete.capture());
    assertEquals(
        List.of(STAGED),
        delete.getValue().apply(new DeleteByQueryRequest.Builder()).build().index());
  }
}
