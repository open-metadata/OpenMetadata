package org.openmetadata.service.rdf.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

class RdfCustomPropertyProjectionTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final String ENTITY = BASE + "entity/type/" + ID;
  private final Dataset dataset = DatasetFactory.create();
  private final Model graph = dataset.getNamedModel(BASE + "graph/knowledge");
  private final JsonLdTranslator translator =
      new JsonLdTranslator(JsonUtils.getObjectMapper(), BASE);

  @AfterEach
  void close() {
    dataset.close();
  }

  @Test
  void repeatedTranslationDoesNotDuplicateDefinitions() {
    final Type type = definition(property("costCenter", "string"));
    append(type);
    final long size = graph.size();
    append(type);
    assertEquals(size, graph.size(), "Append/replay must use the same owned definition identity");
    assertEquals(
        BASE + "customProperty/" + ID + "/costCenter",
        graph
            .listObjectsOfProperty(
                graph.createResource(ENTITY), graph.createProperty(OM + "hasCustomProperty"))
            .next()
            .asResource()
            .getURI());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void replacingRemovingAndDeletingDefinitionsLeavesNoStaleNodes(final boolean bulk) {
    final Type type = definition(property("costCenter", "string"), property("removed", "integer"));
    store(type, bulk);
    type.setCustomProperties(List.of(property("costCenter", "integer")));
    store(type, bulk);
    assertFalse(graph.contains(null, graph.createProperty(OM + "propertyName"), "removed"));
    assertFalse(graph.contains(null, graph.createProperty(OM + "propertyType"), "string"));
    assertEquals(1, definitionCount());
    type.setCustomProperties(null);
    store(type, bulk);
    assertEquals(0, definitionCount());
    type.setCustomProperties(List.of(property("deleteMe", "string")));
    store(type, bulk);
    UpdateAction.parseExecute(RdfRepository.buildEntityDeleteUpdate(ENTITY), dataset);
    assertEquals(0, definitionCount());
  }

  @Test
  void replacingDefinitionsAlsoCleansLegacyRandomIdentifiers() {
    final var legacy =
        graph.createResource(BASE + "customProperty/" + ID + "/" + UUID.randomUUID());
    graph.add(graph.createResource(ENTITY), graph.createProperty(OM + "hasCustomProperty"), legacy);
    graph.add(legacy, RDF.type, graph.createResource(OM + "CustomProperty"));
    graph.add(legacy, graph.createProperty(OM + "propertyName"), "legacy");
    store(definition(property("costCenter", "string")), false);
    assertFalse(graph.containsResource(legacy));
    assertEquals(1, definitionCount());
  }

  @Test
  void deletingDefinitionsPreservesAnotherType() {
    store(definition(property("costCenter", "string")), false);
    final Type other =
        definition(property("costCenter", "integer"))
            .withId(UUID.fromString("00000000-0000-0000-0000-000000000002"))
            .withName("topic")
            .withFullyQualifiedName("topic");
    store(other, false);
    UpdateAction.parseExecute(RdfRepository.buildEntityDeleteUpdate(ENTITY), dataset);
    final Model expected = translator.toRdf(other);
    try {
      assertTrue(graph.isIsomorphicWith(expected));
    } finally {
      expected.close();
    }
  }

  private long definitionCount() {
    return graph
        .listResourcesWithProperty(RDF.type, graph.createResource(OM + "CustomProperty"))
        .toList()
        .size();
  }

  private static Type definition(final CustomProperty... properties) {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("type", "type");
    return new Type()
        .withId(ID)
        .withName("table")
        .withFullyQualifiedName("table")
        .withCustomProperties(List.of(properties));
  }

  private static CustomProperty property(final String name, final String fieldType) {
    return new CustomProperty()
        .withName(name)
        .withPropertyType(new EntityReference().withName(fieldType).withType("type"));
  }

  private void append(final Type type) {
    final Model model = translator.toRdf(type);
    try {
      graph.add(model);
    } finally {
      model.close();
    }
  }

  private void store(final Type type, final boolean bulk) {
    final Model model = translator.toRdf(type);
    try {
      final String update =
          bulk
              ? JenaFusekiStorage.buildBulkReconcileUpdate(
                  BASE,
                  List.of(new RdfStorageInterface.EntityWriteRequest("type", type.getId(), model)))
              : JenaFusekiStorage.buildEntityUpsertUpdate(
                  BASE + "entity/type/" + type.getId(), model);
      UpdateAction.parseExecute(update, dataset);
    } finally {
      model.close();
    }
  }
}
