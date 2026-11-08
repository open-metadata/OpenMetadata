/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.rdf.rebuild;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.storage.RdfEntityWriteStrategy;
import org.openmetadata.service.rdf.storage.RdfPayloadTooLargeException;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/**
 * Journal replay replaces each entity's projection, as it did before live entity writes sent
 * differences: a difference adds a read and a read-back to every replayed write, inside the
 * promotion's replay budget.
 */
class RdfMutationReplayTest {
  private static final String ENTITY = "https://open-metadata.org/entity/table/";

  @Test
  void aJournalledEntityWriteIsReplayedAsAReplacement() {
    final UUID id = UUID.randomUUID();
    final Model projection = ModelFactory.createDefaultModel();
    projection.createResource(ENTITY + id).addProperty(RDFS.label, "orders");
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);

    RdfMutation.EntityWrite.capture("table", id, projection).apply(storage);

    verify(storage)
        .storeEntity(eq("table"), eq(id), any(Model.class), eq(RdfEntityWriteStrategy.REPLACE));
  }

  @Test
  void aWholeGraphMayExceedThePerEntityJournalCap() {
    final Model projection = ModelFactory.createDefaultModel();
    projection
        .createResource(ENTITY + "graph")
        .addProperty(RDFS.comment, "x".repeat(RdfMutation.MAX_MODEL_BYTES + 1));
    try {
      assertThrows(
          RdfPayloadTooLargeException.class,
          () -> RdfMutation.EntityWrite.capture("table", UUID.randomUUID(), projection));
      final RdfMutation.GraphReplace replace =
          RdfMutation.GraphReplace.capture("urn:graph", projection);
      assertTrue(replace.rdf().length > RdfMutation.MAX_MODEL_BYTES);
      assertTrue(replace.rdf().length <= RdfMutation.GraphReplace.MAX_GRAPH_BYTES);
    } finally {
      projection.close();
    }
  }
}
