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
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.update.UpdateAction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfRepository.LineageEdgeData;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/** Deleting an entity takes the lineage details of its edges with it, column lineage included. */
class RdfEntityDeleteLineageTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final String KNOWLEDGE_GRAPH = BASE + "graph/knowledge";
  private static final String PROV_GENERATED = "http://www.w3.org/ns/prov#generated";
  private static final UUID PIPELINE = UUID.randomUUID();

  private final Dataset dataset = DatasetFactory.createTxnMem();
  private final Model graph = dataset.getNamedModel(KNOWLEDGE_GRAPH);
  private final RdfRepository repository = repository();
  private final UUID upstream = UUID.randomUUID();
  private final UUID middle = UUID.randomUUID();
  private final UUID downstream = UUID.randomUUID();
  private final UUID sibling = UUID.randomUUID();
  private final List<LineageEdgeData> edges =
      List.of(
          edge(upstream, "a", middle, "t"),
          edge(middle, "t", downstream, "b"),
          edge(upstream, "a", sibling, "c"));

  @AfterEach
  void close() {
    dataset.close();
  }

  @Test
  void deletingTheMiddleTableBreaksTheColumnPathThroughItAndReAddingItsEdgesRestoresIt() {
    repository.bulkAddLineage(edges, RdfWriteMode.INSERT_ONLY);
    assertTrue(columnPath("a.id", "b.id"));

    repository.delete(new EntityReference().withType(Entity.TABLE).withId(middle));

    assertFalse(columnPath("a.id", "b.id"));
    assertEquals(0, count("?node <" + OM + "toColumn> " + column("t.id")));
    assertEquals(0, count("?node <" + OM + "fromColumn> " + column("t.id")));
    assertEquals(1, count("?details a <" + OM + "LineageDetails>"), "only the sibling's");
    assertEquals(1, count("?pipeline <" + PROV_GENERATED + "> ?details"), "only the sibling's");
    assertTrue(columnPath("a.id", "c.id"), "an edge without the deleted table keeps its details");

    repository.bulkAddLineage(edges.subList(0, 2), RdfWriteMode.INSERT_ONLY);
    assertTrue(columnPath("a.id", "b.id"));
  }

  private boolean columnPath(final String fromColumn, final String toColumn) {
    final String ask =
        "ASK { GRAPH <%s> { %s (^<%sfromColumn>/<%stoColumn>)+ %s } }"
            .formatted(KNOWLEDGE_GRAPH, column(fromColumn), OM, OM, column(toColumn));
    try (QueryExecution execution = QueryExecutionFactory.create(ask, dataset)) {
      return execution.execAsk();
    }
  }

  private long count(final String pattern) {
    final String select =
        "SELECT (COUNT(*) AS ?n) WHERE { GRAPH <%s> { %s } }".formatted(KNOWLEDGE_GRAPH, pattern);
    try (QueryExecution execution = QueryExecutionFactory.create(select, dataset)) {
      return execution.execSelect().next().getLiteral("n").getLong();
    }
  }

  private static String column(final String columnFqn) {
    return "<" + RdfUtils.columnUri(BASE, columnFqn) + ">";
  }

  private static LineageEdgeData edge(
      final UUID fromId, final String fromTable, final UUID toId, final String toTable) {
    return new LineageEdgeData(
        Entity.TABLE,
        fromId,
        Entity.TABLE,
        toId,
        new LineageDetails()
            .withSqlQuery("INSERT INTO " + toTable + " SELECT id FROM " + fromTable)
            .withPipeline(new EntityReference().withType(Entity.PIPELINE).withId(PIPELINE))
            .withColumnsLineage(
                List.of(
                    new ColumnLineage()
                        .withFromColumns(List.of(fromTable + ".id"))
                        .withToColumn(toTable + ".id"))));
  }

  private RdfRepository repository() {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    doAnswer(
            invocation -> {
              UpdateAction.parseExecute(invocation.<String>getArgument(0), dataset);
              return null;
            })
        .when(storage)
        .executeSparqlUpdate(anyString());
    return new RdfRepository(
        new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
        storage,
        new JsonLdTranslator(JsonUtils.getObjectMapper(), BASE),
        () -> null,
        new RdfProjectionLoaders(null, null, null, (type, ids) -> Set.copyOf(ids)));
  }
}
