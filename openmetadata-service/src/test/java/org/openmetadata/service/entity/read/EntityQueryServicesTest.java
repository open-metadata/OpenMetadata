package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.schema.utils.EntityInterfaceUtil.quoteName;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.metadata.DerivedTagLoader;
import org.openmetadata.service.entity.metadata.EntityCertificationService;
import org.openmetadata.service.entity.metadata.EntityExtensionService;
import org.openmetadata.service.entity.metadata.EntityTagReader;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;

class EntityQueryServicesTest {
  private static final Set<String> FIELDS = Set.of("description");
  private static final Fields SELECTED = new Fields(FIELDS, "description");

  @AfterEach
  void clearRequestState() {
    RequestEntityCache.clear();
    ReadBundleContext.clear();
  }

  @Test
  void assembledDetailReadsShareRequestAliasesWithIndependentResults() {
    final Fixture fixture = new Fixture();
    final Container first = fixture.services.reads().byId(fixture.id, fixture.query());
    final Container byName = fixture.services.reads().byName(fixture.name, fixture.query());
    assertEquals("stored:detail:inherit:clear", first.getDescription());
    assertEquals(first.getId(), byName.getId());
    assertEquals(first.getDescription(), byName.getDescription());
    assertNotSame(first, byName);
    byName.setDescription("caller change");
    assertEquals(
        first.getDescription(),
        fixture.services.reads().byId(fixture.id, fixture.query()).getDescription());
    assertEquals(1, fixture.rowReads.get());
    assertNull(first.getExtension());
    assertNull(ReadBundleContext.getCurrent());
  }

  @Test
  void namePolicyRemainsDynamicAfterStartupComposition() {
    final Fixture fixture = new Fixture();
    fixture.quoteNames = true;
    final Container entity = fixture.services.reads().byName(fixture.name, fixture.query());
    assertEquals(quoteName(fixture.name), fixture.lastName);
    assertEquals(
        entity.getDescription(),
        fixture.services.reads().byId(fixture.id, fixture.query()).getDescription());
    assertEquals(1, fixture.rowReads.get());
  }

  @Test
  void collectionCsvAndFilteredQueriesKeepTheirDistinctHydrationPolicies() {
    final Fixture fixture = new Fixture();
    fixture
        .services
        .fields()
        .register(
            "description",
            (entities, fields) -> entities.forEach(entity -> append(entity, ":registered")));
    final var collection =
        fixture
            .services
            .collections()
            .byNames(
                List.of(fixture.name),
                new EntityCollectionReader.Projection(null, SELECTED, NON_DELETED));
    assertEquals("stored:bulk", collection.getFirst().getDescription());
    assertEquals(
        "stored:filtered",
        fixture
            .services
            .collections()
            .all(SELECTED, new ListFilter(NON_DELETED))
            .getFirst()
            .getDescription());
    final Container csv = fixture.services.collections().forCsv(SELECTED, "parent").getFirst();
    assertEquals("stored:registered:csv:clear", csv.getDescription());
    assertNull(csv.getExtension());
  }

  @Test
  void failedBulkPagesUseTheSameDetailInheritanceAndClearPolicies() {
    final Fixture fixture = new Fixture();
    fixture.failFiltered = true;
    final var projection =
        new EntityPageReader.Projection(null, SELECTED, new ListFilter(NON_DELETED));
    final var result =
        fixture
            .services
            .pages()
            .keyset(new EntityPageReader.KeysetPage(projection, 2, null, 1, true));
    assertEquals(1, result.getData().size());
    assertEquals("stored:detail:inherit:clear", result.getData().getFirst().getDescription());
    assertNull(result.getData().getFirst().getExtension());
  }

  @Test
  void parentPoliciesAreUsedForSingleAndBatchInheritance() {
    final Fixture fixture = new Fixture();
    final Container single = fixture.row();
    fixture.services.inheritance().load(single, SELECTED);
    assertEquals("parent", single.getDisplayName());
    final Container batch = fixture.row();
    fixture.services.inheritance().load(List.of(batch), SELECTED, Map.of());
    assertEquals("parent", batch.getDisplayName());
    assertEquals(0, fixture.rowReads.get());
  }

  private static void append(final Container entity, final String suffix) {
    entity.setDescription(entity.getDescription() + suffix);
  }

  private static final class Fixture {
    private final UUID id = UUID.randomUUID();
    private final String name = "container.name." + id;
    private final Container parent = new Container().withId(UUID.randomUUID()).withName("parent");
    private final AtomicInteger rowReads = new AtomicInteger();
    private final EntityDAO<Container> rows;
    private final CollectionDAO daos =
        mock(
            CollectionDAO.class,
            call -> {
              throw new AssertionError("Unexpected metadata SQL: " + call.getMethod().getName());
            });
    private final EntityQueryServices<Container> services;
    private boolean quoteNames;
    private boolean failFiltered;
    private String lastName;

    @SuppressWarnings("unchecked")
    private Fixture() {
      rows = mock(EntityDAO.class);
      when(rows.findEntityById(any(), any()))
          .thenAnswer(
              call -> {
                rowReads.incrementAndGet();
                return row();
              });
      when(rows.findEntityByName(anyString(), any()))
          .thenAnswer(
              call -> {
                rowReads.incrementAndGet();
                lastName = call.getArgument(0);
                return row();
              });
      when(rows.findEntityByNames(any(), any())).thenAnswer(call -> List.of(row()));
      when(rows.listAfter(any(), anyInt(), anyString(), anyString()))
          .thenAnswer(call -> List.of(JsonUtils.pojoToJson(row())));
      when(rows.listAll(anyString(), anyString(), any()))
          .thenAnswer(call -> List.of(JsonUtils.pojoToJson(row())));
      final var schema = new EntityReadFactory.Schema<>("container", Container.class, rows);
      services =
          new EntityQueryServices<>(
              new EntityQueryServices.Schema<>(
                  schema, EntityReadFactory.lookup(schema, () -> quoteNames), FIELDS),
              new EntityQueryServices.Dependencies(
                  daos, new EntityRelationshipRepository(daos), null),
              values(),
              policies());
    }

    private EntityQueryServices.Values<Container> values() {
      final var certifications =
          new EntityCertificationService<Container>(
              daos::tagUsageDAO, () -> null, false, tag -> {});
      final var tags =
          new EntityTagReader<Container>(
              daos::tagUsageDAO,
              () -> null,
              certifications,
              new EntityTagReader.Hydration<>(
                  labels -> Map.of(),
                  new DerivedTagLoader(
                      labels -> Map.of(), (labels, derived) -> labels, labels -> labels),
                  certifications::read),
              new EntityTagReader.Options("container", false, reason -> {}));
      final var extensions =
          new EntityExtensionService(
              daos::entityExtensionDAO,
              new EntityExtensionService.Properties(
                  "container", field -> field, field -> field, field -> "string"),
              false);
      final var metadata =
          new EntityMetadataReads<Container>(
              new EntityMetadataReads.Schema("container", FIELDS, daos),
              new EntityMetadataReads.Hooks<>(
                  (entity, include) -> List.of(),
                  (entity, include) -> List.of(),
                  new EntityMetadataHydrator.EntityFields<>(
                      (entity, fields, include) -> append(entity, ":detail"),
                      (entity, fields) -> append(entity, ":clear"))),
              new EntityMetadataReads.Values<>(tags::read, certifications::read, extensions::read),
              (field, reason) -> {});
      return new EntityQueryServices.Values<>(metadata, tags, extensions);
    }

    private EntityQueryServices.Policies<Container> policies() {
      return new EntityQueryServices.Policies<>(
          new EntityQueryServices.Detail<>(
              () -> quoteNames,
              (builder, entity, fields, include) -> {},
              (entity, plan, bundle) -> {},
              (entity, fields) -> append(entity, ":inherit"),
              (uri, entity) -> entity),
          new EntityQueryServices.Bulk<>(
              (fields, entities) -> entities.forEach(entity -> append(entity, ":bulk")),
              (fields, entities, filter) -> {
                if (failFiltered) {
                  throw new IllegalStateException("Bulk projection unavailable");
                }
                entities.forEach(entity -> append(entity, ":filtered"));
              },
              (entities, fields) -> entities.forEach(entity -> append(entity, ":csv")),
              (entities, fields) -> {},
              () -> DerivedTagLoader.FailureMode.PROPAGATE),
          inheritance(),
          new EntityQueryServices.Paging<>(Container::getName, EntityPagePolicy.standard()));
    }

    private EntityQueryServices.Inheritance<Container> inheritance() {
      final EntityReference reference =
          new EntityReference().withId(parent.getId()).withType("container");
      return new EntityQueryServices.Inheritance<>(
          new EntityInheritanceLoader.Policy<>(
              (entity, fields) -> true,
              entity -> reference,
              type -> "description",
              (entity, fields, ancestor) -> entity.setDisplayName(ancestor.getName())),
          new EntityInheritanceLoader.Parents<>(
              (entity, fields) -> parent, (references, fields) -> List.of(parent)),
          (entity, fields) -> append(entity, ":fallback"),
          new EntityInheritanceReader.Policy<>(
              (entity, fields) -> false, () -> "description", (entity, fields, ancestor) -> {}));
    }

    private EntityReadService.Query query() {
      return new EntityReadService.Query(
          null, SELECTED, RelationIncludes.fromInclude(NON_DELETED), false);
    }

    private Container row() {
      return new Container()
          .withId(id)
          .withName(name)
          .withFullyQualifiedName(quoteNames ? quoteName(name) : name)
          .withDescription("stored")
          .withExtension(Map.of("excluded", true));
    }
  }
}
