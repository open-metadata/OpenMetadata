package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.OntologyCaptureFixture.Fixture;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BoundAsset;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.rdf.RdfLiveWrite;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.rdf.translator.ConceptBindingLookup.ServedBinding;
import org.openmetadata.service.rdf.translator.ConceptBindingLookup.ServedColumn;
import org.openmetadata.service.rdf.translator.DatabaseConceptBindingLookup;

/** The SQL that decides which bindings the serving graph states, on both databases. */
class OntologyServedBindingsStorageTest {
  private static final UUID TABLE = new UUID(0, 1);
  private static final UUID TOPIC = new UUID(0, 2);
  private static final UUID UNBOUND = new UUID(0, 3);

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void onlyConceptsAndPropertiesOfALiveOntologysActiveReleaseAreServed(
      final ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final OntologyConcept customer = concept(fixture, "Customer");
          final OntologyProperty email = property(fixture, "email");
          fixture.activate(fixture.capture(ignored -> {}), 0);
          final OntologyConcept prospect = concept(fixture, "Prospect");
          final OntologyProperty phone = property(fixture, "phone");
          bind(
              customer,
              TABLE,
              OntologyBindingAssetType.TABLE,
              List.of(assignment(email, "cust_email"), assignment(phone, "cust_phone")));
          bind(prospect, TABLE, OntologyBindingAssetType.TABLE, List.of());
          bind(customer, TOPIC, OntologyBindingAssetType.TOPIC, List.of());
          final var lookup = new DatabaseConceptBindingLookup(Entity.getCollectionDAO());

          assertEquals(
              Map.of(
                  TABLE,
                  List.of(
                      new ServedBinding(
                          customer.getIri().toString(),
                          List.of(
                              new ServedColumn(email.getIri().toString(), List.of("cust_email"))))),
                  TOPIC,
                  List.of(new ServedBinding(customer.getIri().toString(), List.of()))),
              lookup.servedBindings(List.of(TABLE, TOPIC, UNBOUND)));

          fixture.ontologies.delete("admin", fixture.ontology.getId(), true, false);
          assertEquals(Map.of(), lookup.servedBindings(List.of(TABLE, TOPIC)));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void theAssetsBoundToAnOntologysConceptsArePagedOnceEachInIdOrder(final ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final OntologyConcept customer = concept(fixture, "Customer");
          final OntologyConcept order = concept(fixture, "Order");
          bind(customer, new UUID(0, 3), OntologyBindingAssetType.TABLE, List.of());
          bind(customer, new UUID(0, 1), OntologyBindingAssetType.TOPIC, List.of());
          bind(customer, new UUID(0, 2), OntologyBindingAssetType.TABLE, List.of());
          bind(order, new UUID(0, 2), OntologyBindingAssetType.TABLE, List.of());
          bind(order, new UUID(0, 4), OntologyBindingAssetType.DASHBOARD, List.of());
          final var dao = Entity.getCollectionDAO().ontologyConceptBindingDAO();
          final String ontology = fixture.ontology.getId().toString();

          final List<BoundAsset> first = dao.listBoundAssets(ontology, "", 2);
          final List<BoundAsset> rest = dao.listBoundAssets(ontology, first.getLast().assetId(), 2);

          assertEquals(
              List.of(
                  new BoundAsset("topic", new UUID(0, 1).toString()),
                  new BoundAsset("table", new UUID(0, 2).toString())),
              first);
          assertEquals(
              List.of(
                  new BoundAsset("table", new UUID(0, 3).toString()),
                  new BoundAsset("dashboard", new UUID(0, 4).toString())),
              rest);
          assertEquals(List.of(), dao.listBoundAssets(UUID.randomUUID().toString(), "", 2));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void theHardDeleteCleanupOfAConceptReprojectsTheAssetsItWasBoundTo(final ConnectionType dialect)
      throws ReflectiveOperationException {
    final List<RdfLiveWrite> submitted = new ArrayList<>();
    final Field queue = RdfUpdater.class.getDeclaredField("writeQueue");
    queue.setAccessible(true);
    final Object original = queue.get(null);
    queue.set(null, (Consumer<List<RdfLiveWrite>>) submitted::addAll);
    try {
      withCapture(
          dialect,
          fixture -> {
            final OntologyConcept customer = concept(fixture, "Customer");
            bind(customer, TABLE, OntologyBindingAssetType.TABLE, List.of());
            bind(customer, TOPIC, OntologyBindingAssetType.TOPIC, List.of());
            submitted.clear();

            fixture.concepts.entitySpecificCleanup(customer);

            assertEquals(
                List.of(
                    new RdfLiveWrite.EntityUpdate(Entity.TABLE, TABLE),
                    new RdfLiveWrite.EntityUpdate(Entity.TOPIC, TOPIC)),
                submitted.stream().filter(RdfLiveWrite.EntityUpdate.class::isInstance).toList());
            assertEquals(
                List.of(),
                Entity.getCollectionDAO()
                    .ontologyConceptBindingDAO()
                    .listForAssets(List.of(TABLE.toString(), TOPIC.toString())));
          });
    } finally {
      queue.set(null, original);
    }
  }

  private static OntologyConcept concept(final Fixture fixture, final String name) {
    return fixture.concepts.create(
        null,
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName(name)
            .withOntology(fixture.ontology.getEntityReference())
            .withConceptType(OntologyConceptType.OWL_CLASS)
            .withVersion(0.1)
            .withUpdatedAt(1L)
            .withUpdatedBy("admin"));
  }

  private static OntologyProperty property(final Fixture fixture, final String name) {
    return new OntologyPropertyRepository()
        .create(
            null,
            new OntologyProperty()
                .withId(UUID.randomUUID())
                .withName(name)
                .withOntology(fixture.ontology.getEntityReference())
                .withKind(OntologyPropertyKind.DATA)
                .withVersion(0.1)
                .withUpdatedAt(1L)
                .withUpdatedBy("admin"));
  }

  private static OntologyColumnBinding assignment(
      final OntologyProperty property, final String column) {
    return new OntologyColumnBinding()
        .withPropertyId(property.getId())
        .withColumnPath(List.of(column));
  }

  private static void bind(
      final OntologyConcept concept,
      final UUID asset,
      final OntologyBindingAssetType type,
      final List<OntologyColumnBinding> columns) {
    Entity.getCollectionDAO()
        .ontologyConceptBindingDAO()
        .upsert(
            concept.getId(), asset, type.value(), "hash" + asset, JsonUtils.pojoToJson(columns));
  }
}
