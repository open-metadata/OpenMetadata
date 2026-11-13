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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.storage.RdfEntityWriteStrategy;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/**
 * Journal replay replaces each entity's projection, as it did before live entity writes sent
 * differences: a difference adds a read and a read-back to every replayed write, inside the
 * promotion's replay budget. A whole ontology graph is journaled by its release and projected
 * again on replay, so no entry carries graph bytes.
 */
class RdfMutationReplayTest {
  private static final String ENTITY = "https://open-metadata.org/entity/table/";
  private static final String GRAPH = "https://open-metadata.org/graph/ontology/test";
  private static final ReleaseGraphs NO_RELEASES =
      release -> {
        throw new AssertionError("No release should be projected");
      };

  @Test
  void aJournalledEntityWriteIsReplayedAsAReplacement() {
    final UUID id = UUID.randomUUID();
    final Model projection = ModelFactory.createDefaultModel();
    projection.createResource(ENTITY + id).addProperty(RDFS.label, "orders");
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);

    RdfMutation.EntityWrite.capture("table", id, projection).apply(storage, NO_RELEASES);

    verify(storage)
        .storeEntity(eq("table"), eq(id), any(Model.class), eq(RdfEntityWriteStrategy.REPLACE));
  }

  @Test
  void aGraphReplacementIsJournaledByItsReleaseAndProjectedAgainOnReplay() {
    final UUID release = UUID.fromString("00000000-0000-0000-0000-000000000007");
    final String entry = JsonUtils.pojoToJson(new RdfMutation.GraphReplace(GRAPH, release));
    assertEquals(
        "{\"operation\":\"replaceReleaseGraph\",\"graph\":\""
            + GRAPH
            + "\",\"releaseId\":\"00000000-0000-0000-0000-000000000007\"}",
        entry);
    final Model projection = ModelFactory.createDefaultModel();
    projection.createResource("https://example.org/Customer").addProperty(RDFS.label, "Customer");
    final Dataset dataset = DatasetFactory.createTxnMem();
    try {
      JsonUtils.readValue(entry, RdfMutation.class)
          .apply(
              storage(dataset),
              id -> {
                assertEquals(release, id);
                return ModelFactory.createDefaultModel().add(projection);
              });
      assertTrue(dataset.getNamedModel(GRAPH).isIsomorphicWith(projection));
    } finally {
      dataset.close();
      projection.close();
    }
  }

  @Test
  void aGraphReplacementWithoutAReleaseEmptiesTheGraph() {
    final Dataset dataset = DatasetFactory.createTxnMem();
    try {
      dataset
          .getNamedModel(GRAPH)
          .createResource("https://example.org/Old")
          .addProperty(RDFS.label, "Old");
      new RdfMutation.GraphReplace(GRAPH, null).apply(storage(dataset), NO_RELEASES);
      assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
    } finally {
      dataset.close();
    }
  }

  private static RdfStorageInterface storage(final Dataset dataset) {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class, CALLS_REAL_METHODS);
    doAnswer(
            call -> {
              UpdateAction.parseExecute(call.<String>getArgument(0), dataset);
              return null;
            })
        .when(storage)
        .executeSparqlUpdate(anyString());
    return storage;
  }
}
