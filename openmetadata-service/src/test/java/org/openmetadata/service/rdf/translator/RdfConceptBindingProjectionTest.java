package org.openmetadata.service.rdf.translator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfUtils;
import org.openmetadata.service.rdf.translator.ConceptBindingLookup.ServedBinding;
import org.openmetadata.service.rdf.translator.ConceptBindingLookup.ServedColumn;

class RdfConceptBindingProjectionTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final String CUSTOMER = "https://example.com/onto/Customer";
  private static final String EMAIL = "https://example.com/onto/email";
  private static final String STREET = "https://example.com/onto/street";
  private static final String TABLE_FQN = "warehouse.db.sales.customers";

  private final List<Collection<UUID>> lookups = new ArrayList<>();
  private Map<UUID, List<ServedBinding>> served = Map.of();
  private final JsonLdTranslator translator =
      new JsonLdTranslator(
          JsonUtils.getObjectMapper(),
          BASE,
          (type, fqns) -> Map.of(),
          assetIds -> {
            lookups.add(List.copyOf(assetIds));
            return served;
          },
          ReferenceScope.ALL);

  @BeforeAll
  static void registerEntityTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("topic", "topic");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("databaseservice", "databaseService");
  }

  @Test
  void aBindingLinksTheReleasedConceptToTheAssetTheCatalogProjectionMints() {
    final Table table = customers();
    served = Map.of(table.getId(), List.of(new ServedBinding(CUSTOMER, List.of())));

    final Model model = translator.toRdf(table);

    final Resource asset = model.createResource(BASE + "entity/table/" + table.getId());
    assertTrue(model.contains(model.createResource(CUSTOMER), boundAsset(model), asset));
    assertEquals(1, model.listStatements(null, boundAsset(model), (RDFNode) null).toList().size());
  }

  @Test
  void aColumnAssignmentLinksThePropertyToTheColumnTheTableProjectionMints() {
    final Table table = customers();
    served =
        Map.of(
            table.getId(),
            List.of(
                new ServedBinding(
                    CUSTOMER,
                    List.of(
                        new ServedColumn(EMAIL, List.of("cust_email")),
                        new ServedColumn(STREET, List.of("address", "street"))))));

    final Model model = translator.toRdf(table);

    final Resource email = model.createResource(columnUri("cust_email"));
    final Resource street = model.createResource(columnUri("address.street"));
    assertTrue(model.contains(model.createResource(EMAIL), boundColumn(model), email));
    assertTrue(model.contains(model.createResource(STREET), boundColumn(model), street));
    assertTrue(
        model.contains(
            model.createResource(BASE + "entity/table/" + table.getId()),
            model.createProperty(OM + "hasColumn"),
            email),
        "the edge must meet the column node the table projection links");
    assertTrue(
        model.contains(
            model.createResource(columnUri("address")),
            model.createProperty(OM + "hasChildColumn"),
            street));
  }

  @Test
  void anAssignmentWhoseColumnIsGoneProjectsNoEdge() {
    final Table table = customers();
    served =
        Map.of(
            table.getId(),
            List.of(
                new ServedBinding(
                    CUSTOMER,
                    List.of(
                        new ServedColumn(EMAIL, List.of("email_address")),
                        new ServedColumn(STREET, List.of("address", "missing"))))));

    final Model model = translator.toRdf(table);

    assertFalse(model.contains(null, boundColumn(model), (RDFNode) null));
    assertTrue(model.contains(model.createResource(CUSTOMER), boundAsset(model)));
  }

  @Test
  void anAssetTypeThatCannotBeBoundIsNeverLookedUp() {
    final DatabaseService service =
        new DatabaseService()
            .withId(UUID.randomUUID())
            .withName("warehouse")
            .withFullyQualifiedName("warehouse");

    translator.toRdf(service);

    assertTrue(lookups.isEmpty());
  }

  @Test
  void aReindexPageResolvesTheBindingsOfItsAssetsWithOneLookup() {
    final Table table = customers();
    final Topic topic =
        new Topic().withId(UUID.randomUUID()).withName("signups").withFullyQualifiedName("k.s");
    served =
        Map.of(
            table.getId(), List.of(new ServedBinding(CUSTOMER, List.of())),
            topic.getId(), List.of(new ServedBinding(CUSTOMER, List.of())));

    final JsonLdTranslator.Page page = translator.page(List.of(table, topic));
    final Model tableModel = page.toRdf(table);
    final Model topicModel = page.toRdf(topic);

    assertEquals(List.of(List.of(table.getId(), topic.getId())), lookups);
    assertTrue(
        tableModel.contains(
            tableModel.createResource(CUSTOMER),
            boundAsset(tableModel),
            tableModel.createResource(BASE + "entity/table/" + table.getId())));
    assertTrue(
        topicModel.contains(
            topicModel.createResource(CUSTOMER),
            boundAsset(topicModel),
            topicModel.createResource(BASE + "entity/topic/" + topic.getId())));
  }

  @Test
  void theDefaultTranslatorProjectsNoBindings() {
    final Table table = customers();
    served = Map.of(table.getId(), List.of(new ServedBinding(CUSTOMER, List.of())));

    final Model model =
        new JsonLdTranslator(
                JsonUtils.getObjectMapper(), BASE, (type, fqns) -> Map.of(), ReferenceScope.ALL)
            .toRdf(table);

    assertFalse(model.contains(null, boundAsset(model), (RDFNode) null));
  }

  private static Table customers() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("customers")
        .withFullyQualifiedName(TABLE_FQN)
        .withColumns(
            List.of(
                column("cust_email", "cust_email"),
                column("address", "address")
                    .withDataType(ColumnDataType.STRUCT)
                    .withChildren(List.of(column("street", "address.street")))));
  }

  private static Column column(final String name, final String path) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.STRING)
        .withFullyQualifiedName(TABLE_FQN + "." + path);
  }

  private static String columnUri(final String path) {
    return RdfUtils.columnUri(BASE, TABLE_FQN + "." + path);
  }

  private static Property boundAsset(final Model model) {
    return model.createProperty(OM + "boundAsset");
  }

  private static Property boundColumn(final Model model) {
    return model.createProperty(OM + "boundColumn");
  }
}
