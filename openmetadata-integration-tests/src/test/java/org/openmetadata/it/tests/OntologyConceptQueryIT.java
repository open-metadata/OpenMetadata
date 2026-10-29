package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.OntologyBindingFixtures.admin;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bind;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindings;
import static org.openmetadata.it.tests.OntologyBindingFixtures.ownerReader;
import static org.openmetadata.it.tests.OntologyBindingFixtures.readerReference;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.OntologyConceptQuery;
import org.openmetadata.schema.api.data.OntologyConceptQueryDialect;
import org.openmetadata.schema.api.data.OntologyConceptQueryHop;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@ExtendWith(TestNamespaceExtension.class)
class OntologyConceptQueryIT extends BaseOntologyApprovalIT {
  private static final URI TRANSFER = URI.create("urn:payments:FundsTransfer");
  private static final URI CUSTOMER = URI.create("urn:payments:Customer");
  private static final URI ACCOUNT = URI.create("urn:payments:Account");
  private static final URI XSD_STRING = URI.create("http://www.w3.org/2001/XMLSchema#string");

  private record Payments(
      Ontology ontology,
      DatabaseSchema schema,
      DatabaseService service,
      OntologyConcept transfer,
      OntologyConcept customer,
      OntologyConcept account,
      OntologyProperty partOf,
      OntologyProperty holds) {}

  @Test
  void theSqlSelectsTheBoundColumnsAndJoinsEachHopOnForeignKeys(final TestNamespace ns) {
    final Payments payments =
        payments(ns, "fkPayments", DatabaseServiceTestFactory.createPostgres(ns));
    final Table customers = table(payments, "customers", List.of("customer_id", "name"));
    final Table transfers =
        table(
            payments,
            "transfers",
            List.of("transfer_id", "amount_usd", "customer_id"),
            foreignKey("customer_id", customers, "customer_id"));
    final Table accounts =
        table(
            payments,
            "accounts",
            List.of("account_id", "owner_id"),
            foreignKey("owner_id", customers, "customer_id"));
    bindData(payments.transfer(), transfers, payments.ontology(), "transfer_id", "amount_usd");
    bindData(payments.customer(), customers, payments.ontology(), "name");
    bindData(payments.account(), accounts, payments.ontology(), "account_id");

    final OntologyConceptQuery root = query(admin(), payments.transfer());
    final OntologyConceptQuery twoHops =
        query(
            admin(),
            payments.transfer(),
            hop(payments.partOf(), payments.customer()),
            hop(payments.holds(), payments.account()));

    final String schema = payments.schema().getName();
    assertEquals(
        "SELECT transfer_id, amount_usd\nFROM " + schema + ".transfers\nLIMIT 50", root.getSql());
    assertEquals(OntologyConceptQueryDialect.ANSI, root.getDialect());
    assertEquals(payments.service().getName(), root.getService());
    assertEquals("Postgres", root.getServiceType());
    assertEquals(List.of(transfers.getFullyQualifiedName()), root.getTables());
    assertEquals(
        String.join(
            "\n",
            "SELECT t2.account_id",
            "FROM " + schema + ".transfers t0",
            "JOIN " + schema + ".customers t1 ON t0.customer_id = t1.customer_id -- part of",
            "JOIN " + schema + ".accounts t2 ON t1.customer_id = t2.owner_id -- holds",
            "LIMIT 50"),
        twoHops.getSql());
    assertEquals(
        List.of("part of", "holds"),
        twoHops.getHops().stream().map(OntologyConceptQueryHop::getLabel).toList());
  }

  @Test
  void aHopWithoutAConstraintJoinsAnObjectPropertyBindingToTheTargetIdentifier(
      final TestNamespace ns) {
    final Payments payments =
        payments(ns, "bindingPayments", DatabaseServiceTestFactory.createPostgres(ns));
    final Table customers = table(payments, "customers", List.of("customer_id", "name"));
    final Table transfers = table(payments, "transfers", List.of("transfer_id", "payer_id"));
    final OntologyProperty transferId =
        dataProperty(payments.ontology(), "transferId", payments.transfer(), false);
    final OntologyProperty customerId =
        dataProperty(payments.ontology(), "customerId", payments.customer(), true);
    bind(
        payments.transfer(),
        transfers,
        List.of(column(transferId, "transfer_id"), column(payments.partOf(), "payer_id")),
        0L);
    bind(payments.customer(), customers, List.of(column(customerId, "customer_id")), 0L);

    final OntologyConceptQuery joined =
        query(admin(), payments.transfer(), hop(payments.partOf(), payments.customer()));

    assertEquals(
        "SELECT t1.customer_id\nFROM "
            + payments.schema().getName()
            + ".transfers t0\nJOIN "
            + payments.schema().getName()
            + ".customers t1 ON t0.payer_id = t1.customer_id -- part of\nLIMIT 50",
        joined.getSql());
  }

  @Test
  void snowflakeIdentifiersAreQuotedOnlyWhenTheyNeedIt(final TestNamespace ns) {
    final Payments payments =
        payments(ns, "snowflakePayments", DatabaseServiceTestFactory.createSnowflake(ns));
    final Table transfers = table(payments, "transfers", List.of("transfer_id", "Amount USD"));
    bindData(payments.transfer(), transfers, payments.ontology(), "transfer_id", "Amount USD");

    final OntologyConceptQuery snowflake = query(admin(), payments.transfer());

    assertEquals(OntologyConceptQueryDialect.SNOWFLAKE, snowflake.getDialect());
    assertEquals(
        "SELECT transfer_id, \"Amount USD\"\nFROM "
            + payments.schema().getName()
            + ".transfers\nLIMIT 50",
        snowflake.getSql());
  }

  @Test
  void missingBindingsAndJoinsAreNamedBadRequests(final TestNamespace ns) {
    final Payments payments =
        payments(ns, "unboundPayments", DatabaseServiceTestFactory.createPostgres(ns));
    final Table transfers = table(payments, "transfers", List.of("transfer_id"));
    final Table customers = table(payments, "customers", List.of("customer_id"));

    assertBadRequest(
        "Concept FundsTransfer has no bound table you can view among its first 100 table bindings",
        () -> query(admin(), payments.transfer()));
    bindData(payments.transfer(), transfers, payments.ontology(), "transfer_id");
    assertBadRequest(
        "Hop 1 (part of) reaches concept Customer, which has no bound table you can view"
            + " among its first 100 table bindings",
        () -> query(admin(), payments.transfer(), hop(payments.partOf(), payments.customer())));
    bindData(payments.customer(), customers, payments.ontology(), "customer_id");
    assertBadRequest(
        "Hop 1 (part of): no foreign key or object-property binding joins "
            + transfers.getFullyQualifiedName()
            + " to a table bound to Customer",
        () -> query(admin(), payments.transfer(), hop(payments.partOf(), payments.customer())));
    final OntologyProperty dataProperty =
        dataProperty(payments.ontology(), "reference", payments.transfer(), false);
    assertBadRequest(
        "Search-around property reference is not an object property of this ontology",
        () -> query(admin(), payments.transfer(), hop(dataProperty, payments.customer())));
  }

  @Test
  void aTableTheReaderMayNotViewIsUnboundAndItsColumnsStayHidden(final TestNamespace ns) {
    final Payments payments =
        payments(ns, "hiddenPayments", DatabaseServiceTestFactory.createPostgres(ns));
    final Table transfers = table(payments, "transfers", List.of("secret_amount"));
    bindData(payments.transfer(), transfers, payments.ontology(), "secret_amount");
    try (var fixtures = new RdfAccessFixtures("conceptQuery" + ns.shortPrefix())) {
      final OpenMetadataClient reader = ownerReader(fixtures, Entity.TABLE);

      final OpenMetadataException hidden =
          assertThrows(OpenMetadataException.class, () -> query(reader, payments.transfer()));

      assertEquals(400, hidden.getStatusCode());
      assertTrue(hidden.getMessage().contains("has no bound table you can view"));
      assertFalse(hidden.getMessage().contains("secret_amount"));
      assertFalse(hidden.getMessage().contains("transfers"));
      assertTrue(query(admin(), payments.transfer()).getSql().contains("secret_amount"));
    }
  }

  @Test
  void aReaderWhoMayViewOnlyTheTwelfthBoundTableGetsSqlOverIt(final TestNamespace ns) {
    final Payments payments =
        payments(ns, "twelfthPayments", DatabaseServiceTestFactory.createPostgres(ns));
    final List<Table> tables =
        IntStream.range(0, 12)
            .mapToObj(index -> table(payments, "transfers_" + index, List.of("amount_" + index)))
            .sorted(Comparator.comparing(table -> table.getId().toString()))
            .toList();
    final Table twelfth = tables.getLast();
    try (var fixtures = new RdfAccessFixtures("conceptQuery12" + ns.shortPrefix())) {
      final OpenMetadataClient reader = ownerReader(fixtures, Entity.TABLE);
      final var current = admin().tables().get(twelfth.getId().toString(), "owners");
      admin()
          .tables()
          .update(twelfth.getId().toString(), current.withOwners(List.of(readerReference(reader))));
      for (final Table table : tables) {
        bindData(
            payments.transfer(),
            table,
            payments.ontology(),
            table.getColumns().getFirst().getName());
      }

      final OntologyConceptQuery visible = query(reader, payments.transfer());

      assertEquals(
          "SELECT "
              + twelfth.getColumns().getFirst().getName()
              + "\nFROM "
              + payments.schema().getName()
              + "."
              + twelfth.getName()
              + "\nLIMIT 50",
          visible.getSql());
      assertEquals(List.of(twelfth.getFullyQualifiedName()), visible.getTables());
      assertEquals(
          tables.getFirst().getFullyQualifiedName(),
          query(admin(), payments.transfer()).getTables().getFirst());
    }
  }

  @Test
  void generatingSqlWritesNothing(final TestNamespace ns) {
    final Payments payments =
        payments(ns, "readOnlyPayments", DatabaseServiceTestFactory.createPostgres(ns));
    final Table customers = table(payments, "customers", List.of("customer_id"));
    final Table transfers =
        table(
            payments,
            "transfers",
            List.of("transfer_id", "customer_id"),
            foreignKey("customer_id", customers, "customer_id"));
    bindData(payments.transfer(), transfers, payments.ontology(), "transfer_id");
    bindData(payments.customer(), customers, payments.ontology(), "customer_id");
    final List<Object> before = observedState(payments, transfers);

    for (int call = 0; call < 10; call++) {
      query(admin(), payments.transfer(), hop(payments.partOf(), payments.customer()));
    }

    assertEquals(before, observedState(payments, transfers));
  }

  private static List<Object> observedState(final Payments payments, final Table transfers) {
    final String ontology = encoded(payments.ontology().getFullyQualifiedName());
    return List.of(
        total(
            "/v1/tables?limit=1&include=all&databaseSchema="
                + encoded(payments.schema().getFullyQualifiedName())),
        total("/v1/ontologyConcepts?limit=1&include=all&ontology=" + ontology),
        total("/v1/ontologyProperties?limit=1&include=all&ontology=" + ontology),
        total("/v1/ontologyAxioms?limit=1&include=all&ontologyId=" + payments.ontology().getId()),
        bindings(payments.transfer(), "").getRevision(),
        bindings(payments.customer(), "").getRevision(),
        admin().ontologyConcepts().get(payments.transfer().getId().toString()).getVersion(),
        admin().tables().get(transfers.getId().toString()).getVersion());
  }

  private static String encoded(final String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  private static int total(final String path) {
    final String body = admin().getHttpClient().executeForString(HttpMethod.GET, path, null);
    return JsonUtils.readTree(body).get("paging").get("total").asInt();
  }

  private Payments payments(
      final TestNamespace ns, final String name, final DatabaseService service) {
    final Ontology ontology = createOntology(ns, name);
    final String schemaName =
        "payments_" + UUID.randomUUID().toString().substring(0, 8).toLowerCase(Locale.ROOT);
    final var database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    final var schema =
        DatabaseSchemaTestFactory.create(database.getFullyQualifiedName(), schemaName);
    final OntologyConcept transfer = declareClass(ontology, "FundsTransfer", TRANSFER);
    final OntologyConcept customer = declareClass(ontology, "Customer", CUSTOMER);
    final OntologyConcept account = declareClass(ontology, "Account", ACCOUNT);
    return new Payments(
        ontology,
        schema,
        service,
        transfer,
        customer,
        account,
        objectProperty(ontology, "partOf", TRANSFER, CUSTOMER),
        objectProperty(ontology, "holds", CUSTOMER, ACCOUNT));
  }

  private static Table table(
      final Payments payments,
      final String name,
      final List<String> columns,
      final TableConstraint... constraints) {
    return admin()
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(payments.schema().getFullyQualifiedName())
                .withColumns(
                    columns.stream()
                        .map(
                            column ->
                                new Column().withName(column).withDataType(ColumnDataType.STRING))
                        .toList())
                .withTableConstraints(List.of(constraints)));
  }

  private static TableConstraint foreignKey(
      final String column, final Table referred, final String referredColumn) {
    return new TableConstraint()
        .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
        .withColumns(List.of(column))
        .withReferredColumns(List.of(referred.getFullyQualifiedName() + "." + referredColumn));
  }

  private static void bindData(
      final OntologyConcept concept,
      final Table table,
      final Ontology ontology,
      final String... columns) {
    bind(
        concept,
        table,
        List.of(columns).stream()
            .map(
                name ->
                    column(
                        dataProperty(
                            ontology,
                            "p" + UUID.randomUUID().toString().substring(0, 8),
                            concept,
                            false),
                        name))
            .toList(),
        0L);
  }

  private static OntologyColumnBinding column(final OntologyProperty property, final String name) {
    return new OntologyColumnBinding()
        .withPropertyId(property.getId())
        .withColumnPath(List.of(name));
  }

  private static OntologyProperty dataProperty(
      final Ontology ontology,
      final String name,
      final OntologyConcept domain,
      final boolean isIdentifier) {
    return admin()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName(name)
                .withOntology(ontology.getFullyQualifiedName())
                .withKind(OntologyPropertyKind.DATA)
                .withIri(URI.create("urn:payments:" + name))
                .withIsIdentifier(isIdentifier)
                .withDomain(List.of(domain.getIri()))
                .withRange(List.of(XSD_STRING)));
  }

  private static OntologyProperty objectProperty(
      final Ontology ontology, final String name, final URI domain, final URI range) {
    return admin()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName(name)
                .withOntology(ontology.getFullyQualifiedName())
                .withKind(OntologyPropertyKind.OBJECT)
                .withIri(URI.create("urn:payments:" + name))
                .withDomain(List.of(domain))
                .withRange(List.of(range)));
  }

  private static OntologyConceptQueryHop hop(
      final OntologyProperty property, final OntologyConcept target) {
    return new OntologyConceptQueryHop().withProperty(property.getId()).withTarget(target.getId());
  }

  private static OntologyConceptQuery query(
      final OpenMetadataClient client,
      final OntologyConcept concept,
      final OntologyConceptQueryHop... hops) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/ontologyConcepts/" + concept.getId() + "/query",
            new OntologyConceptQuery().withHops(List.of(hops)),
            OntologyConceptQuery.class);
  }

  private static void assertBadRequest(final String message, final Runnable request) {
    final OpenMetadataException failure = assertThrows(OpenMetadataException.class, request::run);
    assertEquals(400, failure.getStatusCode());
    assertTrue(
        failure.getMessage().contains(message),
        () -> "expected '" + message + "' in " + failure.getMessage());
  }
}
