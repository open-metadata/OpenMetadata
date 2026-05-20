package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Validates that buildSearchIndexDoc() produces all the common fields required by ES index
 * mappings. This is the safety net to ensure the refactoring doesn't drop fields that the mappings
 * expect.
 *
 * <p>Common fields that ALL EntityInterface-based index mappings define and that
 * populateCommonFields + mixins must produce.
 */
class SearchDocFieldValidationTest {

  private static MockedStatic<Entity> entityStaticMock;

  /** Fields that populateCommonFields must set for every EntityInterface entity. */
  private static final Set<String> COMMON_FIELDS =
      Set.of(
          "displayName",
          "entityType",
          "owners",
          "ownerDisplayName",
          "ownerName",
          "domains",
          "fqnParts",
          "deleted",
          "totalVotes",
          "descriptionStatus");

  /** Fields that TaggableIndex.applyTagFields must set. */
  private static final Set<String> TAG_FIELDS =
      Set.of("tags", "tier", "classificationTags", "glossaryTags");

  /** Fields that ServiceBackedIndex.applyServiceFields must set (when service is non-null). */
  private static final Set<String> SERVICE_FIELDS = Set.of("service");

  /** Fields that LineageIndex.applyLineageFields must set. */
  private static final Set<String> LINEAGE_FIELDS = Set.of("upstreamLineage");

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo = mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    SearchClient mockSearchClient = mock(SearchClient.class);
    when(mockSearchRepo.getSearchClient()).thenReturn(mockSearchClient);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any()))
        .thenReturn(Collections.emptyList());

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    when(relDao.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  private void assertHasFields(Map<String, Object> doc, Set<String> fields, String entityName) {
    for (String field : fields) {
      assertTrue(doc.containsKey(field), entityName + " missing required field: " + field);
    }
  }

  // ==================== DataAssetIndex entities (common + tags + service + lineage) ===========

  @Test
  void testTableIndex_hasAllRequiredFields() {
    EntityReference svc =
        new EntityReference().withId(UUID.randomUUID()).withType("databaseService").withName("svc");
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("t")
            .withFullyQualifiedName("svc.db.sc.t")
            .withService(svc);

    Map<String, Object> doc = new TableIndex(table).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "Table");
    assertHasFields(doc, TAG_FIELDS, "Table");
    assertHasFields(doc, SERVICE_FIELDS, "Table");
    assertHasFields(doc, LINEAGE_FIELDS, "Table");
  }

  @Test
  void testDashboardIndex_hasAllRequiredFields() {
    EntityReference svc =
        new EntityReference().withId(UUID.randomUUID()).withType("dashboardService").withName("s");
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withService(svc);

    Map<String, Object> doc = new DashboardIndex(d).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "Dashboard");
    assertHasFields(doc, TAG_FIELDS, "Dashboard");
    assertHasFields(doc, SERVICE_FIELDS, "Dashboard");
    assertHasFields(doc, LINEAGE_FIELDS, "Dashboard");
  }

  @Test
  void testTopicIndex_hasAllRequiredFields() {
    EntityReference svc =
        new EntityReference().withId(UUID.randomUUID()).withType("messagingService").withName("s");
    Topic t =
        new Topic()
            .withId(UUID.randomUUID())
            .withName("t")
            .withFullyQualifiedName("s.t")
            .withService(svc);

    Map<String, Object> doc = new TopicIndex(t).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "Topic");
    assertHasFields(doc, TAG_FIELDS, "Topic");
    assertHasFields(doc, SERVICE_FIELDS, "Topic");
    assertHasFields(doc, LINEAGE_FIELDS, "Topic");
  }

  @Test
  void testPipelineIndex_hasAllRequiredFields() {
    EntityReference svc =
        new EntityReference().withId(UUID.randomUUID()).withType("pipelineService").withName("s");
    Pipeline p =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("p")
            .withFullyQualifiedName("s.p")
            .withService(svc);

    Map<String, Object> doc = new PipelineIndex(p).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "Pipeline");
    assertHasFields(doc, TAG_FIELDS, "Pipeline");
    assertHasFields(doc, SERVICE_FIELDS, "Pipeline");
    assertHasFields(doc, LINEAGE_FIELDS, "Pipeline");
  }

  @Test
  void testMlModelIndex_hasAllRequiredFields() {
    EntityReference svc =
        new EntityReference().withId(UUID.randomUUID()).withType("mlmodelService").withName("s");
    MlModel m =
        new MlModel()
            .withId(UUID.randomUUID())
            .withName("m")
            .withFullyQualifiedName("s.m")
            .withService(svc);

    Map<String, Object> doc = new MlModelIndex(m).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "MlModel");
    assertHasFields(doc, TAG_FIELDS, "MlModel");
    assertHasFields(doc, SERVICE_FIELDS, "MlModel");
    assertHasFields(doc, LINEAGE_FIELDS, "MlModel");
  }

  // ==================== TaggableIndex + LineageIndex entities (common + tags + lineage) ========

  @Test
  void testDomainIndex_hasCommonAndTagAndLineageFields() {
    Domain d = new Domain().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("d");

    Map<String, Object> doc = new DomainIndex(d).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "Domain");
    assertHasFields(doc, TAG_FIELDS, "Domain");
    assertHasFields(doc, LINEAGE_FIELDS, "Domain");
  }

  // ==================== TaggableIndex + LineageIndex service entities ==========================

  @Test
  void testDatabaseServiceIndex_hasCommonAndTagAndLineageFields() {
    DatabaseService s =
        new DatabaseService().withId(UUID.randomUUID()).withName("s").withFullyQualifiedName("s");

    Map<String, Object> doc = new DatabaseServiceIndex(s).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "DatabaseService");
    assertHasFields(doc, TAG_FIELDS, "DatabaseService");
    assertHasFields(doc, LINEAGE_FIELDS, "DatabaseService");
  }

  // ==================== TaggableIndex only (common + tags, no lineage) ==========================

  @Test
  void testTestCaseIndex_hasCommonAndTagFields() {
    UUID testDefId = UUID.randomUUID();
    EntityReference testDefRef =
        new EntityReference().withId(testDefId).withType(Entity.TEST_DEFINITION);
    entityStaticMock
        .when(() -> Entity.getEntity(eq(Entity.TEST_DEFINITION), eq(testDefId), anyString(), any()))
        .thenThrow(new org.openmetadata.service.exception.EntityNotFoundException("not found"));

    TestCase tc =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName("tc")
            .withFullyQualifiedName("svc.db.sc.t.tc")
            .withEntityLink("<#E::table::svc.db.sc.t>")
            .withTestDefinition(testDefRef);

    Map<String, Object> doc = new TestCaseIndex(tc).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "TestCase");
    assertHasFields(doc, TAG_FIELDS, "TestCase");
    assertTrue(doc.containsKey("originEntityFQN"), "TestCase missing originEntityFQN");
  }

  @Test
  void testTestSuiteIndex_hasCommonAndTagFields() {
    TestSuite ts =
        new TestSuite().withId(UUID.randomUUID()).withName("ts").withFullyQualifiedName("ts");

    Map<String, Object> doc = new TestSuiteIndex(ts).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "TestSuite");
    assertHasFields(doc, TAG_FIELDS, "TestSuite");
    assertTrue(doc.containsKey("lastResultTimestamp"), "TestSuite missing lastResultTimestamp");
  }

  // ==================== TaggableIndex entities with no lineage ================================

  @Test
  void testDatabaseIndex_hasCommonAndTagFields() {
    Database db =
        new Database().withId(UUID.randomUUID()).withName("db").withFullyQualifiedName("svc.db");

    Map<String, Object> doc = new DatabaseIndex(db).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "Database");
    assertHasFields(doc, TAG_FIELDS, "Database");
  }

  @Test
  void testDatabaseSchemaIndex_hasCommonAndTagFields() {
    DatabaseSchema ds =
        new DatabaseSchema()
            .withId(UUID.randomUUID())
            .withName("sc")
            .withFullyQualifiedName("svc.db.sc");

    Map<String, Object> doc = new DatabaseSchemaIndex(ds).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "DatabaseSchema");
    assertHasFields(doc, TAG_FIELDS, "DatabaseSchema");
  }

  @Test
  void testGlossaryIndex_hasCommonAndTagFields() {
    Glossary g = new Glossary().withId(UUID.randomUUID()).withName("g").withFullyQualifiedName("g");

    Map<String, Object> doc = new GlossaryIndex(g).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "Glossary");
    assertHasFields(doc, TAG_FIELDS, "Glossary");
  }

  @Test
  void testGlossaryTermIndex_hasCommonAndTagFields() {
    GlossaryTerm gt =
        new GlossaryTerm().withId(UUID.randomUUID()).withName("gt").withFullyQualifiedName("g.gt");

    Map<String, Object> doc = new GlossaryTermIndex(gt).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "GlossaryTerm");
    assertHasFields(doc, TAG_FIELDS, "GlossaryTerm");
  }

  @Test
  void testDataProductIndex_hasCommonAndTagAndLineageFields() {
    DataProduct dp =
        new DataProduct().withId(UUID.randomUUID()).withName("dp").withFullyQualifiedName("eng.dp");

    Map<String, Object> doc = new DataProductIndex(dp).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "DataProduct");
    assertHasFields(doc, TAG_FIELDS, "DataProduct");
    assertHasFields(doc, LINEAGE_FIELDS, "DataProduct");
  }

  // ==================== Missing EntityInterface indexes that implement mixins ==================

  @Test
  void testIngestionPipelineIndex_hasCommonTagAndServiceFields() {
    EntityReference svc =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("pipelineService")
            .withName("airflow");
    IngestionPipeline ip =
        new IngestionPipeline()
            .withId(UUID.randomUUID())
            .withName("ingest")
            .withFullyQualifiedName("airflow.ingest")
            .withService(svc)
            .withSourceConfig(
                new org.openmetadata.schema.metadataIngestion.SourceConfig()
                    .withConfig(new java.util.HashMap<>()));

    Map<String, Object> doc = new IngestionPipelineIndex(ip).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "IngestionPipeline");
    assertHasFields(doc, TAG_FIELDS, "IngestionPipeline");
    assertHasFields(doc, SERVICE_FIELDS, "IngestionPipeline");
  }

  @Test
  void testDriveServiceIndex_hasAllMixinFields() {
    DriveService ds =
        new DriveService()
            .withId(UUID.randomUUID())
            .withName("gdrive")
            .withFullyQualifiedName("gdrive");

    Map<String, Object> doc = new DriveServiceIndex(ds).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "DriveService");
    assertHasFields(doc, TAG_FIELDS, "DriveService");
    assertHasFields(doc, LINEAGE_FIELDS, "DriveService");
  }

  @Test
  void testSecurityServiceIndex_hasAllMixinFields() {
    SecurityService ss =
        new SecurityService()
            .withId(UUID.randomUUID())
            .withName("sec")
            .withFullyQualifiedName("sec");

    Map<String, Object> doc = new SecurityServiceIndex(ss).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "SecurityService");
    assertHasFields(doc, TAG_FIELDS, "SecurityService");
    assertHasFields(doc, LINEAGE_FIELDS, "SecurityService");
  }

  @Test
  void testAPIServiceIndex_hasCommonTagAndLineageFields() {
    ApiService as =
        new ApiService().withId(UUID.randomUUID()).withName("api").withFullyQualifiedName("api");

    Map<String, Object> doc = new APIServiceIndex(as).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "APIService");
    assertHasFields(doc, TAG_FIELDS, "APIService");
    assertHasFields(doc, LINEAGE_FIELDS, "APIService");
  }

  @Test
  void testContainerIndex_hasAllDataAssetFields() {
    EntityReference svc =
        new EntityReference().withId(UUID.randomUUID()).withType("storageService").withName("s3");
    Container c =
        new Container()
            .withId(UUID.randomUUID())
            .withName("bucket")
            .withFullyQualifiedName("s3.bucket")
            .withService(svc);

    Map<String, Object> doc = new ContainerIndex(c).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "Container");
    assertHasFields(doc, TAG_FIELDS, "Container");
    assertHasFields(doc, SERVICE_FIELDS, "Container");
    assertHasFields(doc, LINEAGE_FIELDS, "Container");
  }

  @Test
  void testStoredProcedureIndex_hasAllDataAssetFields() {
    StoredProcedure sp =
        new StoredProcedure()
            .withId(UUID.randomUUID())
            .withName("sp")
            .withFullyQualifiedName("svc.db.sc.sp");

    Map<String, Object> doc = new StoredProcedureIndex(sp).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "StoredProcedure");
    assertHasFields(doc, TAG_FIELDS, "StoredProcedure");
    assertHasFields(doc, LINEAGE_FIELDS, "StoredProcedure");
  }

  // ==================== Additional service indexes ============================================

  @Test
  void testDashboardServiceIndex_hasFields() {
    DashboardService ds =
        new DashboardService()
            .withId(UUID.randomUUID())
            .withName("ds")
            .withFullyQualifiedName("ds");

    Map<String, Object> doc = new DashboardServiceIndex(ds).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "DashboardService");
    assertHasFields(doc, TAG_FIELDS, "DashboardService");
    assertHasFields(doc, LINEAGE_FIELDS, "DashboardService");
  }

  @Test
  void testPipelineServiceIndex_hasFields() {
    PipelineService ps =
        new PipelineService().withId(UUID.randomUUID()).withName("ps").withFullyQualifiedName("ps");

    Map<String, Object> doc = new PipelineServiceIndex(ps).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "PipelineService");
    assertHasFields(doc, TAG_FIELDS, "PipelineService");
    assertHasFields(doc, LINEAGE_FIELDS, "PipelineService");
  }

  @Test
  void testMessagingServiceIndex_hasFields() {
    MessagingService ms =
        new MessagingService()
            .withId(UUID.randomUUID())
            .withName("ms")
            .withFullyQualifiedName("ms");

    Map<String, Object> doc = new MessagingServiceIndex(ms).buildSearchIndexDoc();

    assertHasFields(doc, COMMON_FIELDS, "MessagingService");
    assertHasFields(doc, TAG_FIELDS, "MessagingService");
    assertHasFields(doc, LINEAGE_FIELDS, "MessagingService");
  }
}
