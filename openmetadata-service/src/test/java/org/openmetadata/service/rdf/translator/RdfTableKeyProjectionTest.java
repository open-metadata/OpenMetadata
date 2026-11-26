package org.openmetadata.service.rdf.translator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableConstraint.ConstraintType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfUtils;

/**
 * A key is one constraint over its member columns in order, and a column is marked unique only
 * when it is unique on its own (ADR:2026-11-13-column-uniqueness-means-the-column-alone-is-unique).
 */
class RdfTableKeyProjectionTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final String FQN = "warehouse.db.sales.order_lines";
  private static final String CUSTOMERS = "warehouse.db.sales.customers";

  private final JsonLdTranslator translator =
      new JsonLdTranslator(
          JsonUtils.getObjectMapper(), BASE, (type, fqns) -> Map.of(), ReferenceScope.ALL);

  enum KeySource {
    TABLE_CONSTRAINT,
    COLUMN_CONSTRAINTS
  }

  record Member(int position, Resource column, Resource referred) {}

  @BeforeAll
  static void registerEntityTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(
        Entity.DASHBOARD_DATA_MODEL.toLowerCase(Locale.ROOT), Entity.DASHBOARD_DATA_MODEL);
  }

  @ParameterizedTest
  @EnumSource(KeySource.class)
  void aTwoColumnPrimaryKeyIsOneConstraintOverItsMembersInOrderAndNeitherIsUnique(
      final KeySource source) {
    final Table table =
        source == KeySource.TABLE_CONSTRAINT
            ? table(column("tenant_id"), column("line_no"))
                .withTableConstraints(
                    List.of(key(ConstraintType.PRIMARY_KEY, "tenant_id", "line_no")))
            : table(
                column("tenant_id").withConstraint(ColumnConstraint.PRIMARY_KEY),
                column("line_no").withConstraint(ColumnConstraint.PRIMARY_KEY));

    final Model model = translator.toRdf(table);

    final Resource key = onlyConstraint(model, "PRIMARY_KEY");
    assertEquals(1, model.listObjectsOfProperty(property("hasConstraint")).toList().size());
    assertEquals(
        List.of(
            new Member(1, columnNode("tenant_id"), null),
            new Member(2, columnNode("line_no"), null)),
        members(model, key));
    assertFalse(model.contains(null, property("isUnique"), (RDFNode) null));
    for (String name : List.of("tenant_id", "line_no")) {
      assertTrue(model.contains(columnNode(name), property("isPrimaryKey"), literal(true)));
      assertTrue(model.contains(columnNode(name), property("isNullable"), literal(false)));
    }
  }

  @Test
  void multiplePrimaryKeyMarkersOnADataModelDoNotStateATableConstraint() {
    final DashboardDataModel dataModel =
        new DashboardDataModel()
            .withId(UUID.randomUUID())
            .withName("order_lines")
            .withFullyQualifiedName(FQN)
            .withColumns(
                List.of(
                    column("tenant_id").withConstraint(ColumnConstraint.PRIMARY_KEY),
                    column("line_no").withConstraint(ColumnConstraint.PRIMARY_KEY)));

    final Model model = translator.toRdf(dataModel);
    final Resource asset =
        model.createResource(
            BASE + "entity/" + Entity.DASHBOARD_DATA_MODEL + "/" + dataModel.getId());

    assertEquals(2, model.listObjectsOfProperty(asset, property("hasColumn")).toList().size());
    assertFalse(model.contains(asset, property("hasConstraint")));
  }

  @Test
  void aColumnLevelPrimaryKeyOnAMemberOfACompositeKeyDoesNotMakeItUnique() {
    final Table table =
        table(column("tenant_id"), column("line_no").withConstraint(ColumnConstraint.PRIMARY_KEY))
            .withTableConstraints(List.of(key(ConstraintType.PRIMARY_KEY, "tenant_id", "line_no")));

    final Model model = translator.toRdf(table);

    onlyConstraint(model, "PRIMARY_KEY");
    assertEquals(1, model.listObjectsOfProperty(property("hasConstraint")).toList().size());
    assertFalse(model.contains(null, property("isUnique"), (RDFNode) null));
  }

  @ParameterizedTest
  @EnumSource(KeySource.class)
  void aSingleColumnKeyStillMarksItsColumnUnique(final KeySource source) {
    final Table table =
        source == KeySource.TABLE_CONSTRAINT
            ? table(column("line_id"), column("sku"))
                .withTableConstraints(
                    List.of(
                        key(ConstraintType.PRIMARY_KEY, "line_id"),
                        key(ConstraintType.UNIQUE, "sku")))
            : table(
                column("line_id").withConstraint(ColumnConstraint.PRIMARY_KEY),
                column("sku").withConstraint(ColumnConstraint.UNIQUE));

    final Model model = translator.toRdf(table);

    assertTrue(model.contains(columnNode("line_id"), property("isUnique"), literal(true)));
    assertTrue(model.contains(columnNode("sku"), property("isUnique"), literal(true)));
    assertTrue(model.contains(columnNode("line_id"), property("isPrimaryKey"), literal(true)));
    assertFalse(model.contains(columnNode("sku"), property("isPrimaryKey")));
    if (source == KeySource.TABLE_CONSTRAINT) {
      assertEquals(
          List.of(new Member(1, columnNode("line_id"), null)),
          members(model, onlyConstraint(model, "PRIMARY_KEY")));
    }
  }

  @Test
  void aCompositeForeignKeyPairsEachColumnWithItsReferredColumnInOrder() {
    final Table table =
        table(column("customer_id"), column("tenant_id"))
            .withTableConstraints(
                List.of(
                    new TableConstraint()
                        .withConstraintType(ConstraintType.FOREIGN_KEY)
                        .withColumns(List.of("tenant_id", "customer_id"))
                        .withReferredColumns(
                            List.of(CUSTOMERS + ".tenant_id", CUSTOMERS + ".id"))));

    final Model model = translator.toRdf(table);

    final Resource tenant = referredNode("tenant_id");
    final Resource customer = referredNode("id");
    assertEquals(
        List.of(
            new Member(1, columnNode("tenant_id"), tenant),
            new Member(2, columnNode("customer_id"), customer)),
        members(model, onlyConstraint(model, "FOREIGN_KEY")));
    assertTrue(model.contains(columnNode("tenant_id"), property("references"), tenant));
    assertTrue(model.contains(columnNode("customer_id"), property("references"), customer));
    assertFalse(model.contains(columnNode("customer_id"), property("references"), tenant));
    assertFalse(model.listStatements(tenant, null, (RDFNode) null).hasNext());
    assertFalse(model.listStatements(customer, null, (RDFNode) null).hasNext());
  }

  @Test
  void aForeignKeyWithUnequalListsKeepsTheColumnsWithoutPairingThem() {
    final Table table =
        table(column("tenant_id"), column("customer_id"))
            .withTableConstraints(
                List.of(
                    new TableConstraint()
                        .withConstraintType(ConstraintType.FOREIGN_KEY)
                        .withColumns(List.of("tenant_id", "customer_id"))
                        .withReferredColumns(List.of("", CUSTOMERS + ".id"))));

    final Model model = translator.toRdf(table);
    final Resource key = onlyConstraint(model, "FOREIGN_KEY");

    assertTrue(model.contains(key, property("hasConstrainedColumn"), columnNode("tenant_id")));
    assertTrue(model.contains(key, property("hasConstrainedColumn"), columnNode("customer_id")));
    assertTrue(model.contains(key, property("hasReferredColumn"), referredNode("id")));
    assertEquals(
        List.of(
            new Member(1, columnNode("tenant_id"), null),
            new Member(2, columnNode("customer_id"), null)),
        members(model, key));
    assertFalse(model.contains(null, property("references"), (RDFNode) null));
  }

  private static List<Member> members(final Model model, final Resource constraint) {
    final List<Member> members = new ArrayList<>();
    model
        .listObjectsOfProperty(constraint, property("hasConstraintMember"))
        .forEachRemaining(
            node -> {
              final Resource member = node.asResource();
              assertTrue(
                  model.contains(member, RDF.type, model.createResource(OM + "ConstraintMember")));
              members.add(
                  new Member(
                      member.getRequiredProperty(property("memberPosition")).getInt(),
                      member.getRequiredProperty(property("memberColumn")).getResource(),
                      member.hasProperty(property("memberReferredColumn"))
                          ? member
                              .getRequiredProperty(property("memberReferredColumn"))
                              .getResource()
                          : null));
            });
    members.sort(Comparator.comparingInt(Member::position));
    return members;
  }

  private static Resource onlyConstraint(final Model model, final String type) {
    final List<Resource> constraints =
        model.listSubjectsWithProperty(property("constraintType"), type).toList();
    assertEquals(1, constraints.size(), () -> type + " constraints: " + constraints);
    return constraints.getFirst();
  }

  private static Table table(final Column... columns) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("order_lines")
        .withFullyQualifiedName(FQN)
        .withColumns(List.of(columns));
  }

  private static TableConstraint key(final ConstraintType type, final String... columns) {
    return new TableConstraint().withConstraintType(type).withColumns(List.of(columns));
  }

  private static Column column(final String name) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.BIGINT)
        .withFullyQualifiedName(FQN + "." + name);
  }

  private static Resource columnNode(final String name) {
    return ResourceFactory.createResource(RdfUtils.columnUri(BASE, FQN + "." + name));
  }

  private static Resource referredNode(final String name) {
    return ResourceFactory.createResource(RdfUtils.columnUri(BASE, CUSTOMERS + "." + name));
  }

  private static Property property(final String localName) {
    return ResourceFactory.createProperty(OM + localName);
  }

  private static RDFNode literal(final boolean value) {
    return ResourceFactory.createTypedLiteral(value);
  }
}
