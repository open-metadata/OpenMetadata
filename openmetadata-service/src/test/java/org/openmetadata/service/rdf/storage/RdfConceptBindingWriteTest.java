package org.openmetadata.service.rdf.storage;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfUtils;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.EntityWriteRequest;
import org.openmetadata.service.rdf.translator.ConceptBindingLookup.ServedBinding;
import org.openmetadata.service.rdf.translator.ConceptBindingLookup.ServedColumn;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.rdf.translator.ReferenceScope;

/**
 * Concept binding edges point into the asset they bind, so the asset's own writes must replace and
 * delete them: a differential write, a full replacement, a bulk reconcile and an entity delete.
 */
class RdfConceptBindingWriteTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String RELEASE_GRAPH = BASE + "graph/ontology/" + UUID.randomUUID();
  private static final String CUSTOMER = "https://example.com/onto/Customer";
  private static final String ORDER = "https://example.com/onto/Order";
  private static final String EMAIL = "https://example.com/onto/email";
  private static final String STREET = "https://example.com/onto/street";
  private static final UUID TABLE_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
  private static final UUID OTHER_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a2");
  private static final String TABLE_URI = BASE + "entity/table/" + TABLE_ID;
  private static final String OTHER_URI = BASE + "entity/table/" + OTHER_ID;

  private final Map<UUID, List<ServedBinding>> served = new HashMap<>();
  private final JsonLdTranslator translator =
      new JsonLdTranslator(
          JsonUtils.getObjectMapper(),
          BASE,
          (type, fqns) -> Map.of(),
          assetIds -> served,
          ReferenceScope.ALL);
  private final Dataset diff = DatasetFactory.create();
  private final Dataset replace = DatasetFactory.create();

  @BeforeAll
  static void registerEntityTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
  }

  @BeforeEach
  void seedTheReleaseAndAnotherBoundAsset() {
    for (Dataset dataset : List.of(diff, replace)) {
      final Model release = dataset.getNamedModel(RELEASE_GRAPH);
      release.createResource(CUSTOMER).addProperty(RDF.type, OWL2.Class);
      release.createResource(CUSTOMER).addProperty(RDFS.label, "Customer");
      release.createResource(EMAIL).addProperty(RDF.type, OWL2.DatatypeProperty);
    }
    served.put(OTHER_ID, List.of(new ServedBinding(CUSTOMER, List.of())));
    writeBoth(OTHER_URI, table(OTHER_ID, "warehouse.db.sales.leads", "cust_email"));
  }

  @AfterEach
  void close() {
    diff.close();
    replace.close();
  }

  @Test
  void removingAnAssignmentOrABindingRemovesOnlyItsEdge() {
    final Table customers = customers();
    served.put(
        TABLE_ID,
        List.of(
            new ServedBinding(
                CUSTOMER,
                List.of(
                    new ServedColumn(EMAIL, List.of("cust_email")),
                    new ServedColumn(STREET, List.of("address", "street")))),
            new ServedBinding(ORDER, List.of())));
    writeBoth(TABLE_URI, customers);
    assertTrue(graph(diff).contains(resource(STREET), boundColumn(), column("address.street")));

    served.put(
        TABLE_ID,
        List.of(
            new ServedBinding(CUSTOMER, List.of(new ServedColumn(EMAIL, List.of("cust_email")))),
            new ServedBinding(ORDER, List.of())));
    writeBoth(TABLE_URI, customers);
    assertSameGraph();
    assertFalse(graph(diff).contains(resource(STREET), boundColumn(), (RDFNode) null));
    assertTrue(graph(diff).contains(resource(EMAIL), boundColumn(), column("cust_email")));

    served.put(TABLE_ID, List.of(new ServedBinding(ORDER, List.of())));
    writeBoth(TABLE_URI, customers);
    assertSameGraph();
    assertFalse(graph(diff).contains(resource(CUSTOMER), boundAsset(), resource(TABLE_URI)));
    assertFalse(graph(diff).contains(resource(EMAIL), boundColumn(), (RDFNode) null));
    assertTrue(graph(diff).contains(resource(ORDER), boundAsset(), resource(TABLE_URI)));
    assertOthersUntouched();
  }

  @Test
  void droppingOrRenamingABoundColumnLeavesNoEdgeToTheOldColumn() {
    served.put(
        TABLE_ID,
        List.of(
            new ServedBinding(CUSTOMER, List.of(new ServedColumn(EMAIL, List.of("cust_email"))))));
    writeBoth(TABLE_URI, customers());

    writeBoth(TABLE_URI, table(TABLE_ID, "warehouse.db.sales.customers", "email_address"));
    assertSameGraph();
    assertFalse(graph(diff).contains(resource(EMAIL), boundColumn(), column("cust_email")));

    writeBoth(TABLE_URI, table(TABLE_ID, "warehouse.db.crm.customers", "cust_email"));
    assertSameGraph();
    assertTrue(
        graph(diff)
            .contains(
                resource(EMAIL),
                boundColumn(),
                resource(RdfUtils.columnUri(BASE, "warehouse.db.crm.customers.cust_email"))));
    assertFalse(graph(diff).contains(resource(EMAIL), boundColumn(), column("cust_email")));
    assertOthersUntouched();
  }

  @Test
  void deletingTheAssetRemovesTheEdgesToItAndToItsColumns() {
    served.put(
        TABLE_ID,
        List.of(
            new ServedBinding(
                CUSTOMER,
                List.of(
                    new ServedColumn(EMAIL, List.of("cust_email")),
                    new ServedColumn(STREET, List.of("address", "street"))))));
    writeBoth(TABLE_URI, customers());

    UpdateAction.parseExecute(RdfRepository.buildEntityDeleteUpdate(TABLE_URI), diff);

    assertFalse(graph(diff).contains(null, boundAsset(), resource(TABLE_URI)));
    assertFalse(graph(diff).contains(resource(EMAIL), boundColumn(), column("cust_email")));
    assertFalse(graph(diff).contains(resource(STREET), boundColumn(), (RDFNode) null));
    assertOthersUntouched();
  }

  @Test
  void aBulkReconcileReprojectsTheEdgesTheCurrentBindingsHold() {
    served.put(
        TABLE_ID,
        List.of(
            new ServedBinding(
                CUSTOMER,
                List.of(
                    new ServedColumn(EMAIL, List.of("cust_email")),
                    new ServedColumn(STREET, List.of("address", "street"))))));
    writeBoth(TABLE_URI, customers());
    served.put(TABLE_ID, List.of(new ServedBinding(ORDER, List.of())));
    final Model current = translator.toRdf(customers());

    UpdateAction.parseExecute(
        JenaFusekiStorage.buildBulkReconcileUpdate(
            BASE, List.of(new EntityWriteRequest("table", TABLE_ID, current))),
        diff);

    assertTrue(graph(diff).containsAll(current));
    assertFalse(graph(diff).contains(resource(CUSTOMER), boundAsset(), resource(TABLE_URI)));
    assertFalse(graph(diff).contains(null, boundColumn(), column("cust_email")));
    assertFalse(graph(diff).contains(null, boundColumn(), column("address.street")));
    assertOthersUntouched();
  }

  private void assertOthersUntouched() {
    assertTrue(graph(diff).contains(resource(CUSTOMER), boundAsset(), resource(OTHER_URI)));
    final Model release = diff.getNamedModel(RELEASE_GRAPH);
    assertTrue(release.contains(resource(CUSTOMER), RDFS.label, "Customer"));
    assertTrue(release.contains(resource(EMAIL), RDF.type, OWL2.DatatypeProperty));
    assertTrue(graphsOutsideTheKnowledgeGraphWithBindings().isEmpty());
  }

  private List<String> graphsOutsideTheKnowledgeGraphWithBindings() {
    try (QueryExecution execution =
        QueryExecutionFactory.create(
            "SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s <" + OM + "boundAsset> ?o } }", diff)) {
      final List<String> graphs = new ArrayList<>();
      execution.execSelect().forEachRemaining(row -> graphs.add(row.getResource("g").getURI()));
      graphs.remove(GRAPH);
      return graphs;
    }
  }

  private void writeBoth(final String uri, final Table table) {
    new RdfEntityWritePlanner(query -> construct(replace, query))
        .write(
            uri,
            translator.toRdf(table),
            RdfEntityWriteStrategy.REPLACE,
            update -> UpdateAction.parseExecute(update, replace));
    new RdfEntityWritePlanner(query -> construct(diff, query))
        .write(
            uri,
            translator.toRdf(table),
            RdfEntityWriteStrategy.DIFFERENCE,
            update -> UpdateAction.parseExecute(update, diff));
  }

  private static Model construct(final Dataset dataset, final String query) {
    try (QueryExecution execution = QueryExecutionFactory.create(query, dataset)) {
      return execution.execConstruct();
    }
  }

  private void assertSameGraph() {
    final Model diffGraph = graph(diff);
    final Model replaceGraph = graph(replace);
    assertTrue(
        diffGraph.isIsomorphicWith(replaceGraph),
        () ->
            "only after the difference: "
                + diffGraph.difference(replaceGraph).listStatements().toList()
                + "\nonly after the replacement: "
                + replaceGraph.difference(diffGraph).listStatements().toList());
  }

  private static Model graph(final Dataset dataset) {
    return dataset.getNamedModel(GRAPH);
  }

  private static Table customers() {
    final Table table = table(TABLE_ID, "warehouse.db.sales.customers", "cust_email");
    final String fqn = table.getFullyQualifiedName();
    return table.withColumns(
        List.of(
            table.getColumns().getFirst(),
            new Column()
                .withName("address")
                .withDataType(ColumnDataType.STRUCT)
                .withFullyQualifiedName(fqn + ".address")
                .withChildren(
                    List.of(
                        new Column()
                            .withName("street")
                            .withDataType(ColumnDataType.STRING)
                            .withFullyQualifiedName(fqn + ".address.street")))));
  }

  private static Table table(final UUID id, final String fqn, final String column) {
    return new Table()
        .withId(id)
        .withName(fqn.substring(fqn.lastIndexOf('.') + 1))
        .withFullyQualifiedName(fqn)
        .withColumns(
            List.of(
                new Column()
                    .withName(column)
                    .withDataType(ColumnDataType.STRING)
                    .withFullyQualifiedName(fqn + "." + column)));
  }

  private static Resource column(final String path) {
    return resource(RdfUtils.columnUri(BASE, "warehouse.db.sales.customers." + path));
  }

  private static Resource resource(final String uri) {
    return ResourceFactory.createResource(uri);
  }

  private static Property boundAsset() {
    return ResourceFactory.createProperty(OM + "boundAsset");
  }

  private static Property boundColumn() {
    return ResourceFactory.createProperty(OM + "boundColumn");
  }
}
