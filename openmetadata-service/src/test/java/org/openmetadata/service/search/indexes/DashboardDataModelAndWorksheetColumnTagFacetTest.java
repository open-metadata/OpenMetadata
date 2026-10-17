package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DashboardDataModelRepository;
import org.openmetadata.service.jdbi3.WorksheetRepository;
import org.openmetadata.service.search.SearchRepository;

/**
 * End-to-end regression test for the reported bug: a DashboardDataModel or Worksheet tagged only
 * at the column level was present in the Explore {@code tags.tagFQN} facet (because {@link
 * TaggableIndex#mergeChildTags} folded column tags into {@code tags[]}) but missing from the
 * dedicated {@code classificationTags} / {@code glossaryTags} facets (because {@link
 * TaggableIndex#applyTagFields} derived them from {@link Entity#getEntityTags}, which for these
 * two entities returned only entity-level tags).
 *
 * <p>The fix overrides {@code getAllTags} in both repositories to aggregate column tags. These
 * tests exercise the real repository's {@code getAllTags} through the full {@code
 * buildSearchIndexDoc()} pipeline (no mock on {@code getEntityTags} — it is delegated to the real
 * override) and assert the column tag FQNs land in the dedicated facet fields.
 *
 * <p>The real repositories are constructed in {@link #setUp()} <em>before</em> the {@link
 * MockedStatic} on {@link Entity} is activated, so that {@link Entity#getEntityFields} reads the
 * real {@code @JsonPropertyOrder} annotations (so {@code WorksheetRepository}'s {@code "columns"}
 * patch field validates). Once the mock is active, {@code getEntityTags} is delegated to the real
 * {@code getAllTags} of the pre-built repositories.
 */
class DashboardDataModelAndWorksheetColumnTagFacetTest {

  private static MockedStatic<Entity> entityStaticMock;
  private static DashboardDataModelRepository dashboardDataModelRepository;
  private static WorksheetRepository worksheetRepository;

  @BeforeAll
  static void setUp() {
    // Phase 1: construct the real repositories with the *real* Entity statics, mirroring the
    // repo-level fixture, so getEntityFields resolves @JsonPropertyOrder and patch-field
    // validation passes (WorksheetRepository validates "columns").
    CollectionDAO realDao = mock(CollectionDAO.class);
    CollectionDAO.DataModelDAO dataModelDao = mock(CollectionDAO.DataModelDAO.class);
    CollectionDAO.WorksheetDAO worksheetDao = mock(CollectionDAO.WorksheetDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDao =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(realDao.dashboardDataModelDAO()).thenReturn(dataModelDao);
    when(realDao.worksheetDAO()).thenReturn(worksheetDao);
    when(realDao.relationshipDAO()).thenReturn(relationshipDao);
    Entity.setCollectionDAO(realDao);
    dashboardDataModelRepository = new DashboardDataModelRepository();
    worksheetRepository = new WorksheetRepository();

    // Phase 2: activate the MockedStatic used by the search-index pipeline. getEntityTags is
    // delegated per-test to the real repository's getAllTags (the fix under test).
    SearchRepository mockSearchRepo =
        Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
    Entity.cleanup();
  }

  private CollectionDAO lineageCollectionDao() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    when(relDao.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    return dao;
  }

  private void wireEntityTagsToRealRepo(String entityType, Object repository) {
    // Build the lineage DAO mock before starting any static-mock stub so Mockito doesn't see
    // nested stubbing (creating the mock stubs relationshipDAO/findFrom on a fresh mock).
    CollectionDAO dao = lineageCollectionDao();
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);
    entityStaticMock
        .when(() -> Entity.getEntityTags(eq(entityType), any()))
        .thenAnswer(
            inv -> {
              EntityInterface<?> entity = (EntityInterface<?>) inv.getArgument(1);
              if (repository instanceof DashboardDataModelRepository ddm) {
                return ddm.getAllTags(entity);
              }
              return ((WorksheetRepository) repository).getAllTags(entity);
            });
  }

  // ==================== DashboardDataModel ====================

  @Test
  void dashboardDataModel_columnClassificationTag_appearsInClassificationTagsFacet() {
    TagLabel colTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    DashboardDataModel model =
        dataModel("onlyColumnClassification", null, List.of(column("email", colTag)));

    wireEntityTagsToRealRepo(Entity.DASHBOARD_DATA_MODEL, dashboardDataModelRepository);

    Map<String, Object> result = new DashboardDataModelIndex(model).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertNotNull(tags);
    assertTrue(containsFqn(tags, "PII.Email"), "column classification tag must be in tags[]");

    @SuppressWarnings("unchecked")
    List<String> classificationTags = (List<String>) result.get("classificationTags");
    assertTrue(
        classificationTags.contains("PII.Email"),
        "column classification FQN must appear in classificationTags facet field");
    @SuppressWarnings("unchecked")
    List<String> glossaryTags = (List<String>) result.get("glossaryTags");
    assertFalse(glossaryTags.contains("PII.Email"));
  }

  @Test
  void dashboardDataModel_columnGlossaryTag_appearsInGlossaryTagsFacet() {
    TagLabel colTag = tag("Glossary.Revenue", TagLabel.TagSource.GLOSSARY);
    DashboardDataModel model =
        dataModel("onlyColumnGlossary", null, List.of(column("revenue", colTag)));

    wireEntityTagsToRealRepo(Entity.DASHBOARD_DATA_MODEL, dashboardDataModelRepository);

    Map<String, Object> result = new DashboardDataModelIndex(model).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<String> glossaryTags = (List<String>) result.get("glossaryTags");
    assertTrue(
        glossaryTags.contains("Glossary.Revenue"),
        "column glossary FQN must appear in glossaryTags facet field");
  }

  @Test
  void dashboardDataModel_entityAndColumnClassificationTags_bothInClassificationTagsFacet() {
    TagLabel entityTag = tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION);
    TagLabel colTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    DashboardDataModel model =
        dataModel("entityAndColumn", List.of(entityTag), List.of(column("email", colTag)));

    wireEntityTagsToRealRepo(Entity.DASHBOARD_DATA_MODEL, dashboardDataModelRepository);

    Map<String, Object> result = new DashboardDataModelIndex(model).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<String> classificationTags = (List<String>) result.get("classificationTags");
    assertTrue(classificationTags.contains("PII.Sensitive"));
    assertTrue(classificationTags.contains("PII.Email"));
  }

  // ==================== Worksheet ====================

  @Test
  void worksheet_columnClassificationAndGlossaryTags_appearInDedicatedFacets() {
    TagLabel classification = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    TagLabel glossary = tag("Glossary.Revenue", TagLabel.TagSource.GLOSSARY);
    Worksheet ws =
        worksheet("mixedColumnTags", null, List.of(column("c", classification, glossary)));

    wireEntityTagsToRealRepo(Entity.WORKSHEET, worksheetRepository);

    Map<String, Object> result = new WorksheetIndex(ws).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<String> classificationTags = (List<String>) result.get("classificationTags");
    assertTrue(classificationTags.contains("PII.Email"));
    @SuppressWarnings("unchecked")
    List<String> glossaryTags = (List<String>) result.get("glossaryTags");
    assertTrue(glossaryTags.contains("Glossary.Revenue"));

    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) result.get("tags");
    assertTrue(containsFqn(tags, "PII.Email"));
    assertTrue(containsFqn(tags, "Glossary.Revenue"));
  }

  @Test
  void worksheet_columnClassificationTagOnly_appearsInClassificationTagsFacet() {
    TagLabel colTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    Worksheet ws = worksheet("onlyColumnClassification", null, List.of(column("email", colTag)));

    wireEntityTagsToRealRepo(Entity.WORKSHEET, worksheetRepository);

    Map<String, Object> result = new WorksheetIndex(ws).buildSearchIndexDoc();

    @SuppressWarnings("unchecked")
    List<String> classificationTags = (List<String>) result.get("classificationTags");
    assertTrue(classificationTags.contains("PII.Email"));
  }

  // ==================== helpers ====================

  private DashboardDataModel dataModel(String name, List<TagLabel> tags, List<Column> columns) {
    return new DashboardDataModel()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("svc." + name)
        .withTags(tags)
        .withColumns(columns);
  }

  private Worksheet worksheet(String name, List<TagLabel> tags, List<Column> columns) {
    return new Worksheet()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("svc." + name)
        .withTags(tags)
        .withColumns(columns);
  }

  private Column column(String name, TagLabel... tags) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.VARCHAR)
        .withTags(tags == null || tags.length == 0 ? null : List.of(tags));
  }

  private TagLabel tag(String fqn, TagLabel.TagSource source) {
    return new TagLabel().withTagFQN(fqn).withSource(source);
  }

  private static boolean containsFqn(List<TagLabel> tags, String fqn) {
    return tags != null && tags.stream().anyMatch(t -> fqn.equals(t.getTagFQN()));
  }
}
