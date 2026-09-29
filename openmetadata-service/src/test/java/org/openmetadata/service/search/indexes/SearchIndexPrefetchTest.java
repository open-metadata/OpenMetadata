package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

class SearchIndexPrefetchTest {

  private static final String TABLE = "table";
  private static final String DASHBOARD = "dashboard";
  private static final int UPSTREAM_ORDINAL = Relationship.UPSTREAM.ordinal();

  private static MockedStatic<Entity> entityStaticMock;
  private CollectionDAO dao;
  private CollectionDAO.EntityRelationshipDAO relDao;

  @BeforeAll
  static void bootEntity() {
    SearchRepository searchRepo = Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(searchRepo);
  }

  @AfterAll
  static void closeEntityMock() {
    entityStaticMock.close();
  }

  @BeforeEach
  void resetDaoMocks() {
    dao = mock(CollectionDAO.class);
    relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(any(), any(), any()))
        .thenAnswer(invocation -> Collections.emptyList());
    // The lineage-support probe is memoized per JVM; clear it so each test sees the mock the
    // test itself configures rather than a value cached by an earlier test in the same JVM.
    SearchIndex.LINEAGE_PREFETCH_SUPPORT_CACHE.invalidateAll();
  }

  @Test
  void prefetchReturnsEmptyMapForNullInput() {
    Map<UUID, List<EsLineageData>> result = SearchIndex.prefetchUpstreamLineage(null);
    assertTrue(result.isEmpty());
  }

  @Test
  void prefetchReturnsEmptyMapForEmptyInput() {
    Map<UUID, List<EsLineageData>> result =
        SearchIndex.prefetchUpstreamLineage(Collections.emptyList());
    assertTrue(result.isEmpty());
  }

  @Test
  void prefetchReturnsIdKeyedEmptyListsWhenNoRecordsFound() {
    Table t1 = table("svc.db.s.t1");
    Table t2 = table("svc.db.s.t2");
    when(relDao.findFromBatch(any(), eq(UPSTREAM_ORDINAL), eq(Include.ALL)))
        .thenReturn(Collections.emptyList());

    Map<UUID, List<EsLineageData>> result = SearchIndex.prefetchUpstreamLineage(List.of(t1, t2));

    assertEquals(2, result.size());
    assertTrue(result.get(t1.getId()).isEmpty());
    assertTrue(result.get(t2.getId()).isEmpty());
  }

  @Test
  void prefetchClearsResultWhenBatchDbCallThrows() {
    Table t1 = table("svc.db.s.t1");
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class)))
        .thenThrow(new RuntimeException("db unavailable"));

    Map<UUID, List<EsLineageData>> result = SearchIndex.prefetchUpstreamLineage(List.of(t1));

    assertTrue(result.isEmpty());
  }

  @Test
  void prefetchGroupsRecordsByToIdAndResolvesReferencesFromMultipleTypes() {
    Table downstream1 = table("svc.db.s.d1");
    Table downstream2 = table("svc.db.s.d2");
    EntityReference upTable = upstreamRef(TABLE, "svc.db.s.up_table");
    EntityReference upDashboard = upstreamRef(DASHBOARD, "looker.dash");

    CollectionDAO.EntityRelationshipObject edgeA =
        record(upTable.getId(), TABLE, downstream1.getId(), TABLE, "{}");
    CollectionDAO.EntityRelationshipObject edgeB =
        record(upDashboard.getId(), DASHBOARD, downstream1.getId(), TABLE, "{}");
    CollectionDAO.EntityRelationshipObject edgeC =
        record(upTable.getId(), TABLE, downstream2.getId(), TABLE, "{}");
    when(relDao.findFromBatch(any(), eq(UPSTREAM_ORDINAL), eq(Include.ALL)))
        .thenReturn(List.of(edgeA, edgeB, edgeC));
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(eq(TABLE), any(), eq(Include.ALL)))
        .thenReturn(List.of(upTable));
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(eq(DASHBOARD), any(), eq(Include.ALL)))
        .thenReturn(List.of(upDashboard));

    Map<UUID, List<EsLineageData>> result =
        SearchIndex.prefetchUpstreamLineage(List.of(downstream1, downstream2));

    assertEquals(2, result.size());
    assertEquals(2, result.get(downstream1.getId()).size());
    assertEquals(1, result.get(downstream2.getId()).size());
    assertNotNull(result.get(downstream1.getId()).get(0).getFromEntity());
  }

  @Test
  void prefetchSkipsEdgeWhenUpstreamRefMissingButKeepsOtherEdges() {
    Table downstream = table("svc.db.s.d1");
    EntityReference upTable = upstreamRef(TABLE, "svc.db.s.up_table");
    UUID missingId = UUID.randomUUID();

    CollectionDAO.EntityRelationshipObject resolvable =
        record(upTable.getId(), TABLE, downstream.getId(), TABLE, "{}");
    CollectionDAO.EntityRelationshipObject unresolvable =
        record(missingId, TABLE, downstream.getId(), TABLE, "{}");
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class)))
        .thenReturn(List.of(resolvable, unresolvable));
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(eq(TABLE), any(), eq(Include.ALL)))
        .thenReturn(List.of(upTable));

    Map<UUID, List<EsLineageData>> result =
        SearchIndex.prefetchUpstreamLineage(List.of(downstream));

    assertEquals(1, result.get(downstream.getId()).size());
  }

  @Test
  void prefetchSkipsEdgeWithInvalidJsonAndKeepsValidEdges() {
    Table downstream = table("svc.db.s.d1");
    EntityReference upTable = upstreamRef(TABLE, "svc.db.s.up_table");
    EntityReference upTable2 = upstreamRef(TABLE, "svc.db.s.up_table2");

    String validJson = JsonUtils.pojoToJson(new LineageDetails());
    CollectionDAO.EntityRelationshipObject good =
        record(upTable.getId(), TABLE, downstream.getId(), TABLE, validJson);
    CollectionDAO.EntityRelationshipObject bad =
        record(upTable2.getId(), TABLE, downstream.getId(), TABLE, "{not-json");
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class))).thenReturn(List.of(good, bad));
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(eq(TABLE), any(), eq(Include.ALL)))
        .thenReturn(List.of(upTable, upTable2));

    Map<UUID, List<EsLineageData>> result =
        SearchIndex.prefetchUpstreamLineage(List.of(downstream));

    assertEquals(1, result.get(downstream.getId()).size());
  }

  @Test
  void prefetchSkipsRecordWhenToIdNotInInputEntities() {
    Table downstream = table("svc.db.s.d1");
    EntityReference upTable = upstreamRef(TABLE, "svc.db.s.up_table");
    UUID strayDownstream = UUID.randomUUID();

    CollectionDAO.EntityRelationshipObject stray =
        record(upTable.getId(), TABLE, strayDownstream, TABLE, "{}");
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class))).thenReturn(List.of(stray));
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(eq(TABLE), any(), eq(Include.ALL)))
        .thenReturn(List.of(upTable));

    Map<UUID, List<EsLineageData>> result =
        SearchIndex.prefetchUpstreamLineage(List.of(downstream));

    assertEquals(1, result.size());
    assertTrue(result.get(downstream.getId()).isEmpty());
  }

  @Test
  void prefetchContinuesWhenOneUpstreamTypeFetchFails() {
    Table downstream = table("svc.db.s.d1");
    EntityReference upTable = upstreamRef(TABLE, "svc.db.s.up_table");
    UUID upDashboardId = UUID.randomUUID();

    CollectionDAO.EntityRelationshipObject tableEdge =
        record(upTable.getId(), TABLE, downstream.getId(), TABLE, "{}");
    CollectionDAO.EntityRelationshipObject dashEdge =
        record(upDashboardId, DASHBOARD, downstream.getId(), TABLE, "{}");
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class)))
        .thenReturn(List.of(tableEdge, dashEdge));
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(eq(TABLE), any(), eq(Include.ALL)))
        .thenReturn(List.of(upTable));
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(eq(DASHBOARD), any(), eq(Include.ALL)))
        .thenThrow(new RuntimeException("dashboard service down"));

    Map<UUID, List<EsLineageData>> result =
        SearchIndex.prefetchUpstreamLineage(List.of(downstream));

    assertEquals(1, result.get(downstream.getId()).size());
  }

  @Test
  void prefetchWorksForMetricEntitiesAndBuildsLineageEdges() {
    Metric metric = new Metric().withId(UUID.randomUUID()).withFullyQualifiedName("svc.metric");
    EntityReference upTable = upstreamRef(TABLE, "svc.db.s.up_table");

    CollectionDAO.EntityRelationshipObject edge =
        record(upTable.getId(), TABLE, metric.getId(), Entity.METRIC, "{}");
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class))).thenReturn(List.of(edge));
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(eq(TABLE), any(), eq(Include.ALL)))
        .thenReturn(List.of(upTable));

    Map<UUID, List<EsLineageData>> result = SearchIndex.prefetchUpstreamLineage(List.of(metric));

    assertEquals(1, result.get(metric.getId()).size());
    EsLineageData edgeData = result.get(metric.getId()).get(0);
    assertEquals(upTable.getId(), edgeData.getFromEntity().getId());
  }

  @Test
  void prefetchSkipsInputEntitiesWithNullId() {
    Table withId = table("svc.db.s.t1");
    org.openmetadata.schema.EntityInterface nullIdEntity =
        org.mockito.Mockito.mock(org.openmetadata.schema.EntityInterface.class);
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class)))
        .thenReturn(Collections.emptyList());

    Map<UUID, List<EsLineageData>> result =
        SearchIndex.prefetchUpstreamLineage(List.of(withId, nullIdEntity));

    assertEquals(1, result.size());
    assertTrue(result.containsKey(withId.getId()));
  }

  @Test
  void prefetchSkipsRecordsWithMalformedUuids() {
    Table downstream = table("svc.db.s.d1");
    EntityReference upTable = upstreamRef(TABLE, "svc.db.s.up_table");

    CollectionDAO.EntityRelationshipObject good =
        record(upTable.getId(), TABLE, downstream.getId(), TABLE, "{}");
    CollectionDAO.EntityRelationshipObject badFromId =
        CollectionDAO.EntityRelationshipObject.builder()
            .fromId("not-a-uuid")
            .fromEntity(TABLE)
            .toId(downstream.getId().toString())
            .toEntity(TABLE)
            .relation(UPSTREAM_ORDINAL)
            .json("{}")
            .build();
    CollectionDAO.EntityRelationshipObject badToId =
        CollectionDAO.EntityRelationshipObject.builder()
            .fromId(upTable.getId().toString())
            .fromEntity(TABLE)
            .toId("also-not-a-uuid")
            .toEntity(TABLE)
            .relation(UPSTREAM_ORDINAL)
            .json("{}")
            .build();
    CollectionDAO.EntityRelationshipObject missingFromEntity =
        CollectionDAO.EntityRelationshipObject.builder()
            .fromId(UUID.randomUUID().toString())
            .fromEntity(null)
            .toId(downstream.getId().toString())
            .toEntity(TABLE)
            .relation(UPSTREAM_ORDINAL)
            .json("{}")
            .build();
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class)))
        .thenReturn(List.of(good, badFromId, badToId, missingFromEntity));
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(eq(TABLE), any(), eq(Include.ALL)))
        .thenReturn(List.of(upTable));

    Map<UUID, List<EsLineageData>> result =
        SearchIndex.prefetchUpstreamLineage(List.of(downstream));

    assertEquals(1, result.get(downstream.getId()).size());
  }

  @Test
  void prefetchLineageIfSupportedReturnsNullForNullEntities() {
    assertNull(SearchIndex.prefetchLineageIfSupported(TABLE, null));
  }

  @Test
  void prefetchLineageIfSupportedReturnsNullForEmptyEntities() {
    assertNull(SearchIndex.prefetchLineageIfSupported(TABLE, Collections.emptyList()));
  }

  @Test
  void prefetchLineageIfSupportedReturnsNullWhenIndexIsNotLineageIndex() {
    Table downstream = table("svc.db.s.d1");
    entityStaticMock
        .when(() -> Entity.buildSearchIndex(TABLE, null))
        .thenReturn(new BareSearchIndex());

    assertNull(SearchIndex.prefetchLineageIfSupported(TABLE, List.of(downstream)));
  }

  @Test
  void prefetchLineageIfSupportedReturnsNullWhenBuildSearchIndexThrows() {
    Table downstream = table("svc.db.s.d1");
    entityStaticMock
        .when(() -> Entity.buildSearchIndex(TABLE, null))
        .thenThrow(new IllegalStateException("boom"));

    assertNull(SearchIndex.prefetchLineageIfSupported(TABLE, List.of(downstream)));
  }

  @Test
  void supportProbeDoesNotCacheFailuresSoTransientErrorsAreRetried() {
    Table downstream = table("svc.db.s.d1");
    entityStaticMock
        .when(() -> Entity.buildSearchIndex(TABLE, null))
        .thenThrow(new IllegalStateException("transient"))
        .thenReturn(new BareLineageIndex());
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class)))
        .thenReturn(Collections.emptyList());

    // First call: probe throws -> returns null (treated as unsupported), cache stays empty.
    assertNull(SearchIndex.prefetchLineageIfSupported(TABLE, List.of(downstream)));
    // Second call: probe succeeds -> map is populated, proving the failure wasn't cached.
    assertNotNull(SearchIndex.prefetchLineageIfSupported(TABLE, List.of(downstream)));
  }

  @Test
  void prefetchLineageIfSupportedReturnsNullWhenPrefetchMapStaysEmpty() {
    Table downstream = table("svc.db.s.d1");
    entityStaticMock
        .when(() -> Entity.buildSearchIndex(TABLE, null))
        .thenReturn(new BareLineageIndex());
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class)))
        .thenThrow(new RuntimeException("db unavailable"));

    assertNull(SearchIndex.prefetchLineageIfSupported(TABLE, List.of(downstream)));
  }

  @Test
  void prefetchLineageIfSupportedReturnsMapWhenPrefetchYieldsRecords() {
    Table downstream = table("svc.db.s.d1");
    EntityReference upTable = upstreamRef(TABLE, "svc.db.s.up_table");
    entityStaticMock
        .when(() -> Entity.buildSearchIndex(TABLE, null))
        .thenReturn(new BareLineageIndex());
    when(relDao.findFromBatch(any(), anyInt(), any(Include.class)))
        .thenReturn(List.of(record(upTable.getId(), TABLE, downstream.getId(), TABLE, "{}")));
    entityStaticMock
        .when(() -> Entity.getEntityReferencesByIds(eq(TABLE), any(), eq(Include.ALL)))
        .thenReturn(List.of(upTable));

    Map<UUID, List<EsLineageData>> result =
        SearchIndex.prefetchLineageIfSupported(TABLE, List.of(downstream));

    assertNotNull(result);
    assertEquals(1, result.get(downstream.getId()).size());
  }

  @Test
  void prefetchServiceStylesContinuesWhenOneServiceTypeFetchFails() {
    UUID databaseServiceId = UUID.randomUUID();
    UUID dashboardServiceId = UUID.randomUUID();
    Style databaseStyle = new Style().withColor("#123456");
    Table table =
        table("svc.db.s.t1").withService(serviceRef(Entity.DATABASE_SERVICE, databaseServiceId));
    Dashboard dashboard =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("looker.d1")
            .withService(serviceRef(Entity.DASHBOARD_SERVICE, dashboardServiceId));
    DatabaseService databaseService =
        new DatabaseService().withId(databaseServiceId).withStyle(databaseStyle);
    entityStaticMock
        .when(() -> Entity.entityHasField(eq(Entity.DATABASE_SERVICE), eq(Entity.FIELD_STYLE)))
        .thenReturn(true);
    entityStaticMock
        .when(() -> Entity.entityHasField(eq(Entity.DASHBOARD_SERVICE), eq(Entity.FIELD_STYLE)))
        .thenReturn(true);
    entityStaticMock
        .when(() -> Entity.getEntities(any(), eq(Entity.FIELD_STYLE), eq(Include.ALL)))
        .thenAnswer(
            invocation -> {
              List<EntityReference> refs = invocation.getArgument(0);
              if (Entity.DATABASE_SERVICE.equals(refs.get(0).getType())) {
                return List.of(databaseService);
              }
              throw new RuntimeException("dashboard services unavailable");
            });

    Map<UUID, Optional<Style>> result =
        SearchIndex.prefetchServiceStyles(List.of(table, dashboard));

    assertEquals(Optional.of(databaseStyle), result.get(table.getId()));
    assertFalse(result.containsKey(dashboard.getId()));
  }

  @Test
  void getLineageDataFromRefsSkipsRecordWithInvalidJsonAndLogsWarn() {
    EntityReference downstream =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(TABLE)
            .withFullyQualifiedName("svc.db.s.downstream");
    EntityReference goodUp =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(TABLE)
            .withFullyQualifiedName("svc.db.s.up_good");
    EntityReference badUp =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(TABLE)
            .withFullyQualifiedName("svc.db.s.up_bad");
    entityStaticMock
        .when(() -> Entity.getEntityReferenceById(eq(TABLE), eq(goodUp.getId()), eq(Include.ALL)))
        .thenReturn(goodUp);
    entityStaticMock
        .when(() -> Entity.getEntityReferenceById(eq(TABLE), eq(badUp.getId()), eq(Include.ALL)))
        .thenReturn(badUp);

    CollectionDAO.EntityRelationshipRecord good =
        CollectionDAO.EntityRelationshipRecord.builder()
            .id(goodUp.getId())
            .type(TABLE)
            .json("{}")
            .build();
    CollectionDAO.EntityRelationshipRecord bad =
        CollectionDAO.EntityRelationshipRecord.builder()
            .id(badUp.getId())
            .type(TABLE)
            .json("{not-json")
            .build();

    List<EsLineageData> result = SearchIndex.getLineageDataFromRefs(downstream, List.of(good, bad));

    assertEquals(1, result.size());
    assertEquals(goodUp.getId(), result.get(0).getFromEntity().getId());
  }

  private static Table table(String fqn) {
    return new Table().withId(UUID.randomUUID()).withFullyQualifiedName(fqn);
  }

  private static EntityReference upstreamRef(String type, String fqn) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withFullyQualifiedName(fqn);
  }

  private static EntityReference serviceRef(String type, UUID id) {
    return new EntityReference().withId(id).withType(type);
  }

  private static CollectionDAO.EntityRelationshipObject record(
      UUID fromId, String fromEntity, UUID toId, String toEntity, String json) {
    return CollectionDAO.EntityRelationshipObject.builder()
        .fromId(fromId.toString())
        .fromEntity(fromEntity)
        .toId(toId.toString())
        .toEntity(toEntity)
        .relation(UPSTREAM_ORDINAL)
        .json(json)
        .build();
  }

  private static class BareSearchIndex implements SearchIndex {
    @Override
    public Map<String, Object> buildSearchIndexDoc() {
      return Map.of();
    }

    @Override
    public Object getEntity() {
      return Map.of();
    }

    @Override
    public String getEntityTypeName() {
      return "bare";
    }

    @Override
    public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
      return esDoc;
    }
  }

  private static class BareLineageIndex implements LineageIndex {
    @Override
    public Map<String, Object> buildSearchIndexDoc() {
      return Map.of();
    }

    @Override
    public Object getEntity() {
      return Map.of();
    }

    @Override
    public String getEntityTypeName() {
      return "bare-lineage";
    }

    @Override
    public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
      return esDoc;
    }
  }
}
