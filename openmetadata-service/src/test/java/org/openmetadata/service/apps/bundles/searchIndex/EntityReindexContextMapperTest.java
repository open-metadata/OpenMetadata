package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.ReindexContext;

class EntityReindexContextMapperTest {

  @Test
  void aTypeIsFinalizedWithTheChunkGenerationsItsRunStaged() {
    ReindexContext run = new ReindexContext();
    run.add(
        Entity.ONTOLOGY_CONCEPT,
        "ontology_concept_search_index",
        "ontology_concept_search_index_rebuild_1",
        "ontology_concept_search_index_rebuild_2",
        Set.of("ontologyConcept"),
        "ontologyConcept",
        List.of("all"));
    run.setStagedChunkIndex("data_asset_embeddings_chunks_g2");
    run.setStagedOntologyChunkIndex("ontology_embeddings_chunks_g2");

    EntityReindexContext type =
        EntityReindexContextMapper.fromStagedContext(run, Entity.ONTOLOGY_CONCEPT);

    assertEquals("ontology_embeddings_chunks_g2", type.getStagedOntologyChunkIndex());
    assertEquals("data_asset_embeddings_chunks_g2", type.getStagedChunkIndex());
    assertEquals("ontology_concept_search_index_rebuild_2", type.getStagedIndex());
  }
}
