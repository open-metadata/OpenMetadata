package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/**
 * Verifies that {@link DashboardDataModelRepository#getAllTags} and {@link
 * WorksheetRepository#getAllTags} aggregate column-level tags into the returned list (mirroring
 * {@link TableRepository#getAllTags}), so that {@link Entity#getEntityTags} — used by search
 * indexing, security policy evaluation, and insights — sees the full tag population, not just
 * entity-level tags.
 */
class DashboardDataModelAndWorksheetGetAllTagsTest {

  // ==================== DashboardDataModel ====================

  @Test
  void dashboardDataModel_aggregatesEntityAndColumnClassificationTags() {
    TagLabel entityTag = tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION);
    TagLabel colTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    DashboardDataModel model =
        model("salesModel", List.of(entityTag), List.of(column("email", colTag)));

    try (DashboardDataModelFixture f = dashboardDataModelFixture()) {
      List<TagLabel> all = f.repository().getAllTags(model);

      assertEquals(2, all.size());
      assertTrue(containsFqn(all, "PII.Sensitive"));
      assertTrue(containsFqn(all, "PII.Email"));
    }
  }

  @Test
  void dashboardDataModel_aggregatesColumnTagsEvenWithoutEntityTags() {
    // The reported bug: a DashboardDataModel tagged only at the column level was invisible to
    // the classification/glossary search facets because getAllTags returned only entity.getTags().
    TagLabel colClassification = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    TagLabel colGlossary = tag("Glossary.Revenue", TagLabel.TagSource.GLOSSARY);
    DashboardDataModel model =
        model("onlyColumnTags", null, List.of(column("email", colClassification, colGlossary)));

    try (DashboardDataModelFixture f = dashboardDataModelFixture()) {
      List<TagLabel> all = f.repository().getAllTags(model);

      assertFalse(all.isEmpty(), "column-only tags must be aggregated even with no entity tags");
      assertTrue(containsFqn(all, "PII.Email"));
      assertTrue(containsFqn(all, "Glossary.Revenue"));
    }
  }

  @Test
  void dashboardDataModel_aggregatesClassificationGlossaryAndTierColumnTags() {
    TagLabel classification = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    TagLabel glossary = tag("Glossary.Revenue", TagLabel.TagSource.GLOSSARY);
    TagLabel tier = tag("Tier.Tier1", TagLabel.TagSource.CLASSIFICATION);
    DashboardDataModel model =
        model("allSources", null, List.of(column("col", classification, glossary, tier)));

    try (DashboardDataModelFixture f = dashboardDataModelFixture()) {
      List<TagLabel> all = f.repository().getAllTags(model);

      assertEquals(3, all.size());
      assertTrue(containsFqn(all, "PII.Email"));
      assertTrue(containsFqn(all, "Glossary.Revenue"));
      assertTrue(containsFqn(all, "Tier.Tier1"));
    }
  }

  @Test
  void dashboardDataModel_deduplicatesEntityAndColumnTagsWithSameFqnAndSource() {
    TagLabel entityTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    TagLabel colTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    DashboardDataModel model = model("dup", List.of(entityTag), List.of(column("email", colTag)));

    try (DashboardDataModelFixture f = dashboardDataModelFixture()) {
      List<TagLabel> all = f.repository().getAllTags(model);

      assertEquals(1, all.size(), "a tag present on both the entity and a column is merged once");
    }
  }

  @Test
  void dashboardDataModel_aggregatesTagsFromMultipleColumns() {
    DashboardDataModel model =
        model(
            "multi",
            null,
            List.of(
                column("a", tag("PII.Email", TagLabel.TagSource.CLASSIFICATION)),
                column("b", tag("PII.Phone", TagLabel.TagSource.CLASSIFICATION))));

    try (DashboardDataModelFixture f = dashboardDataModelFixture()) {
      List<TagLabel> all = f.repository().getAllTags(model);

      assertTrue(containsFqn(all, "PII.Email"));
      assertTrue(containsFqn(all, "PII.Phone"));
      assertEquals(2, all.size());
    }
  }

  @Test
  void dashboardDataModel_returnsEntityTagsWhenColumnsAbsent() {
    TagLabel entityTag = tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION);
    DashboardDataModel model = model("noCols", List.of(entityTag), null);

    try (DashboardDataModelFixture f = dashboardDataModelFixture()) {
      List<TagLabel> all = f.repository().getAllTags(model);

      assertEquals(1, all.size());
      assertTrue(containsFqn(all, "PII.Sensitive"));
    }
  }

  @Test
  void dashboardDataModel_returnsEmptyWhenNoTagsAndNoColumns() {
    DashboardDataModel model = model("empty", null, null);

    try (DashboardDataModelFixture f = dashboardDataModelFixture()) {
      List<TagLabel> all = f.repository().getAllTags(model);

      assertTrue(all.isEmpty());
    }
  }

  @Test
  void dashboardDataModel_skipsColumnsWithoutTags() {
    TagLabel colTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    DashboardDataModel model =
        model("mixed", null, List.of(column("noTags"), column("withTags", colTag)));

    try (DashboardDataModelFixture f = dashboardDataModelFixture()) {
      List<TagLabel> all = f.repository().getAllTags(model);

      assertEquals(1, all.size());
      assertTrue(containsFqn(all, "PII.Email"));
    }
  }

  // ==================== Worksheet ====================

  @Test
  void worksheet_aggregatesEntityAndColumnClassificationTags() {
    TagLabel entityTag = tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION);
    TagLabel colTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    Worksheet ws = worksheet("sheet1", List.of(entityTag), List.of(column("email", colTag)));

    try (WorksheetFixture f = worksheetFixture()) {
      List<TagLabel> all = f.repository().getAllTags(ws);

      assertEquals(2, all.size());
      assertTrue(containsFqn(all, "PII.Sensitive"));
      assertTrue(containsFqn(all, "PII.Email"));
    }
  }

  @Test
  void worksheet_aggregatesColumnTagsEvenWithoutEntityTags() {
    TagLabel colClassification = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    TagLabel colGlossary = tag("Glossary.Revenue", TagLabel.TagSource.GLOSSARY);
    Worksheet ws =
        worksheet("onlyColumnTags", null, List.of(column("email", colClassification, colGlossary)));

    try (WorksheetFixture f = worksheetFixture()) {
      List<TagLabel> all = f.repository().getAllTags(ws);

      assertFalse(all.isEmpty());
      assertTrue(containsFqn(all, "PII.Email"));
      assertTrue(containsFqn(all, "Glossary.Revenue"));
    }
  }

  @Test
  void worksheet_deduplicatesEntityAndColumnTagsWithSameFqnAndSource() {
    TagLabel entityTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    TagLabel colTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    Worksheet ws = worksheet("dup", List.of(entityTag), List.of(column("email", colTag)));

    try (WorksheetFixture f = worksheetFixture()) {
      List<TagLabel> all = f.repository().getAllTags(ws);

      assertEquals(1, all.size());
    }
  }

  @Test
  void worksheet_returnsEntityTagsWhenColumnsAbsent() {
    TagLabel entityTag = tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION);
    Worksheet ws = worksheet("noCols", List.of(entityTag), null);

    try (WorksheetFixture f = worksheetFixture()) {
      List<TagLabel> all = f.repository().getAllTags(ws);

      assertEquals(1, all.size());
      assertTrue(containsFqn(all, "PII.Sensitive"));
    }
  }

  @Test
  void worksheet_returnsBaseBehaviorForUnsupportedType() {
    // Sanity-check the base EntityRepository.getAllTags contract that was the *cause* of the bug:
    // it returns only entity-level tags. The DashboardDataModel/Worksheet overrides must NOT
    // regress to this for column tags.
    TagLabel entityTag = tag("PII.Sensitive", TagLabel.TagSource.CLASSIFICATION);
    TagLabel colTag = tag("PII.Email", TagLabel.TagSource.CLASSIFICATION);
    Worksheet ws = worksheet("base", List.of(entityTag), List.of(column("email", colTag)));

    try (WorksheetFixture f = worksheetFixture()) {
      List<TagLabel> all = f.repository().getAllTags(ws);

      // The override must include the column tag — the base impl would have omitted it.
      assertTrue(
          containsFqn(all, "PII.Email"),
          "WorksheetRepository.getAllTags must aggregate column tags (override in place)");
    }
  }

  // ==================== fixtures & helpers ====================

  private DashboardDataModelFixture dashboardDataModelFixture() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.DataModelDAO dataModelDAO = mock(CollectionDAO.DataModelDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.dashboardDataModelDAO()).thenReturn(dataModelDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    Entity.setCollectionDAO(collectionDAO);
    return new DashboardDataModelFixture(new DashboardDataModelRepository());
  }

  private WorksheetFixture worksheetFixture() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.WorksheetDAO worksheetDAO = mock(CollectionDAO.WorksheetDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.worksheetDAO()).thenReturn(worksheetDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    Entity.setCollectionDAO(collectionDAO);
    return new WorksheetFixture(new WorksheetRepository());
  }

  private DashboardDataModel model(String name, List<TagLabel> tags, List<Column> columns) {
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
    return tags.stream().anyMatch(t -> fqn.equals(t.getTagFQN()));
  }

  private record DashboardDataModelFixture(DashboardDataModelRepository repository)
      implements AutoCloseable {
    @Override
    public void close() {
      Entity.cleanup();
    }
  }

  private record WorksheetFixture(WorksheetRepository repository) implements AutoCloseable {
    @Override
    public void close() {
      Entity.cleanup();
    }
  }
}
