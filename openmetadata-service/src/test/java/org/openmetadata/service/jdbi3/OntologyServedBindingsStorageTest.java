package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import jakarta.ws.rs.ClientErrorException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.OntologyCaptureFixture.Fixture;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BoundAsset;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyConceptBindingService;
import org.openmetadata.service.rdf.RdfLiveWrite;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.rdf.translator.ConceptBindingLookup.ServedBinding;
import org.openmetadata.service.rdf.translator.ConceptBindingLookup.ServedColumn;
import org.openmetadata.service.rdf.translator.DatabaseConceptBindingLookup;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil.Fields;

/** The SQL that decides which bindings the serving graph states, on both databases. */
@Isolated
class OntologyServedBindingsStorageTest {
  private static final UUID TABLE = new UUID(0, 1);
  private static final UUID TOPIC = new UUID(0, 2);
  private static final UUID UNBOUND = new UUID(0, 3);
  private static final String ASSET_TABLE = "rdf_binding_test_asset";

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void onlyCommittedBindingChangesQueueAnAssetRefresh(final ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final OntologyConcept customer = concept(fixture, "Customer");
          final Table table =
              new Table()
                  .withId(UUID.randomUUID())
                  .withFullyQualifiedName("svc.db.sales.customers");
          fixture.handle.execute(
              "CREATE TABLE IF NOT EXISTS "
                  + ASSET_TABLE
                  + " (id VARCHAR(36) PRIMARY KEY, deleted BOOLEAN NOT NULL, json JSON NOT NULL)");
          fixture.handle.execute(
              "INSERT INTO " + ASSET_TABLE + " (id, deleted, json) VALUES (?, FALSE, '{}')",
              table.getId().toString());
          final OntologyConceptBindingStore store =
              new OntologyConceptBindingStore(Entity.getCollectionDAO(), type -> ASSET_TABLE);
          final TableRepository tables = mock(TableRepository.class);
          when(tables.getEntityType()).thenReturn(Entity.TABLE);
          when(tables.getFields(anyString())).thenReturn(new Fields(Set.of()));
          when(tables.get(any(), eq(table.getId()), any(), eq(Include.NON_DELETED), anyBoolean()))
              .thenReturn(table);
          final OntologyConceptBindingService service =
              new OntologyConceptBindingService(
                  store,
                  mock(Authorizer.class),
                  type -> Entity.TABLE.equals(type) ? tables : fixture.concepts);
          final var access = new OntologyConceptBindingService.Access(null, null);
          final UUID conceptId = customer.getId();
          final UUID tableId = table.getId();
          final List<RdfLiveWrite> queued = new ArrayList<>();
          final List<Boolean> rowPresentAtEnqueue = new ArrayList<>();
          final var request =
              new UpdateOntologyConceptBinding()
                  .withExpectedRevision(0L)
                  .withAsset(
                      new OntologyAssetBinding()
                          .withAssetType(OntologyBindingAssetType.TABLE)
                          .withAssetId(tableId));

          assertDoesNotThrow(
              () -> {
                try (final var ignored =
                    RdfUpdater.captureWrites(
                        writes -> {
                          queued.addAll(writes);
                          rowPresentAtEnqueue.add(store.find(conceptId, tableId) != null);
                        })) {
                  request.setExpectedRevision(1L);
                  assertEquals(
                      409,
                      assertThrows(
                              ClientErrorException.class,
                              () -> service.put(access, conceptId, request))
                          .getResponse()
                          .getStatus());
                  assertNull(store.find(conceptId, tableId));

                  request.setExpectedRevision(0L);
                  service.put(access, conceptId, request);
                  assertNotNull(store.find(conceptId, tableId));
                  final var conflict =
                      assertThrows(
                          ClientErrorException.class,
                          () -> service.remove(access, conceptId, Entity.TABLE, tableId, 0L));
                  assertEquals(409, conflict.getResponse().getStatus());
                  assertNotNull(store.find(conceptId, tableId));
                  service.remove(access, conceptId, Entity.TABLE, tableId, 1L);
                  assertNull(store.find(conceptId, tableId));
                }
              });
          final var update = new RdfLiveWrite.EntityUpdate(Entity.TABLE, tableId);
          assertEquals(List.of(update, update), queued);
          assertEquals(List.of(true, false), rowPresentAtEnqueue);
        });
  }

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
      throws Exception {
    final List<RdfLiveWrite> submitted = new ArrayList<>();
    try (final var ignored = RdfUpdater.captureWrites(submitted::addAll)) {
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
