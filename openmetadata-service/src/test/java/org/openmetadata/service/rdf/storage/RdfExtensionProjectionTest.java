package org.openmetadata.service.rdf.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.update.UpdateAction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

class RdfExtensionProjectionTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private final Dataset dataset = DatasetFactory.create();
  private final Model graph = dataset.getNamedModel(BASE + "graph/knowledge");
  private final JsonLdTranslator translator =
      new JsonLdTranslator(JsonUtils.getObjectMapper(), BASE);

  @AfterEach
  void close() {
    dataset.close();
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void replacingRemovingAndDeletingExtensionsLeavesNoStaleValues(final boolean bulk) {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
    final Table table =
        new Table()
            .withId(UUID.fromString("00000000-0000-0000-0000-000000000001"))
            .withName("table")
            .withFullyQualifiedName("service.db.schema.table")
            .withExtension(Map.of("costCenter", "old", "removed", 10));
    final Table other =
        new Table()
            .withId(UUID.fromString("00000000-0000-0000-0000-000000000002"))
            .withName("other")
            .withFullyQualifiedName("service.db.schema.other")
            .withExtension(Map.of("costCenter", "preserved"));
    store(other, bulk);
    store(table, bulk);
    final String uri = BASE + "entity/table/" + table.getId();
    graph.add(
        graph.createResource(uri),
        graph.createProperty(OM + "downstream"),
        graph.createResource(BASE + "entity/table/" + other.getId()));
    table.setExtension(Map.of("costCenter", "new"));
    store(table, bulk);
    assertFalse(graph.contains(null, null, "old"));
    assertFalse(graph.contains(null, graph.createProperty(OM + "extensionKey"), "removed"));
    assertTrue(graph.contains(null, graph.createProperty(OM + "extensionValue"), "new"));
    assertTrue(graph.contains(null, graph.createProperty(OM + "extensionValue"), "preserved"));
    assertTrue(graph.contains(graph.createResource(uri), graph.createProperty(OM + "downstream")));
    table.setExtension(null);
    store(table, bulk);
    assertFalse(graph.contains(null, null, "new"));
    table.setExtension(Map.of("costCenter", "delete-me"));
    store(table, bulk);
    UpdateAction.parseExecute(RdfRepository.buildEntityDeleteUpdate(uri), dataset);
    assertFalse(graph.contains(null, null, "delete-me"));
    assertEquals(
        1,
        graph
            .listStatements(null, graph.createProperty(OM + "extensionValue"), (String) null)
            .toList()
            .size());
  }

  private void store(final Table table, final boolean bulk) {
    final Model model = translator.toRdf(table);
    try {
      final String update =
          bulk
              ? JenaFusekiStorage.buildBulkReconcileUpdate(
                  BASE,
                  List.of(
                      new RdfStorageInterface.EntityWriteRequest("table", table.getId(), model)))
              : JenaFusekiStorage.buildEntityUpsertUpdate(
                  BASE + "entity/table/" + table.getId(), model);
      UpdateAction.parseExecute(update, dataset);
    } finally {
      model.close();
    }
  }
}
