package org.openmetadata.service.resources.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

class TagLabelUtilTest {

  @Test
  void populateTagLabel_preservesAppliedByAndAppliedAt() {
    Date appliedAt = new Date();
    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash usage =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    usage.setTargetFQNHash("targetHash");
    usage.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    usage.setTagFQN("PersonalData.Personal");
    usage.setLabelType(TagLabel.LabelType.MANUAL.ordinal());
    usage.setState(TagLabel.State.CONFIRMED.ordinal());
    usage.setReason("test");
    usage.setAppliedBy("admin");
    usage.setAppliedAt(appliedAt);

    Map<String, List<TagLabel>> result = TagLabelUtil.populateTagLabel(List.of(usage));

    assertNotNull(result.get("targetHash"));
    assertEquals(1, result.get("targetHash").size());
    TagLabel tagLabel = result.get("targetHash").get(0);
    assertEquals("admin", tagLabel.getAppliedBy());
    assertEquals(appliedAt, tagLabel.getAppliedAt());
  }

  @Test
  void applyTagCommonFieldsBatchDoesNothingForEmptyList() {
    TagLabelUtil.applyTagCommonFieldsBatch(null);
    TagLabelUtil.applyTagCommonFieldsBatch(new ArrayList<>());
  }

  @Test
  void applyTagCommonFieldsBatchEnrichesClassificationTags() {
    Tag tag = new Tag();
    tag.setName("Sensitive");
    tag.setDisplayName("Sensitive Data");
    tag.setDescription("Contains sensitive information");
    tag.setFullyQualifiedName("PII.Sensitive");

    TagLabel label =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagSource.CLASSIFICATION);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityByNames(
                      eq(Entity.TAG), any(List.class), eq(""), eq(Include.NON_DELETED)))
          .thenReturn(List.of(tag));

      TagLabelUtil.applyTagCommonFieldsBatch(List.of(label));

      assertEquals("Sensitive", label.getName());
      assertEquals("Sensitive Data", label.getDisplayName());
      assertEquals("Contains sensitive information", label.getDescription());
    }
  }

  @Test
  void applyTagCommonFieldsBatchEnrichesGlossaryTerms() {
    GlossaryTerm term = new GlossaryTerm();
    term.setName("CustomerID");
    term.setDisplayName("Customer Identifier");
    term.setDescription("Unique customer identifier");
    term.setFullyQualifiedName("Glossary.CustomerID");

    TagLabel label =
        new TagLabel().withTagFQN("Glossary.CustomerID").withSource(TagSource.GLOSSARY);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityByNames(
                      eq(Entity.GLOSSARY_TERM), any(List.class), eq(""), eq(Include.NON_DELETED)))
          .thenReturn(List.of(term));

      TagLabelUtil.applyTagCommonFieldsBatch(List.of(label));

      assertEquals("CustomerID", label.getName());
      assertEquals("Customer Identifier", label.getDisplayName());
      assertEquals("Unique customer identifier", label.getDescription());
    }
  }

  @Test
  void applyTagCommonFieldsBatchEnrichesMixedTagsAndGlossaryTerms() {
    Tag tag = new Tag();
    tag.setName("Sensitive");
    tag.setDisplayName("Sensitive Data");
    tag.setDescription("Sensitive info");
    tag.setFullyQualifiedName("PII.Sensitive");

    GlossaryTerm term = new GlossaryTerm();
    term.setName("Revenue");
    term.setDisplayName("Revenue Metric");
    term.setDescription("Revenue description");
    term.setFullyQualifiedName("Finance.Revenue");

    TagLabel classificationLabel =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagSource.CLASSIFICATION);
    TagLabel glossaryLabel =
        new TagLabel().withTagFQN("Finance.Revenue").withSource(TagSource.GLOSSARY);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityByNames(
                      eq(Entity.TAG), any(List.class), eq(""), eq(Include.NON_DELETED)))
          .thenReturn(List.of(tag));
      entityMock
          .when(
              () ->
                  Entity.getEntityByNames(
                      eq(Entity.GLOSSARY_TERM), any(List.class), eq(""), eq(Include.NON_DELETED)))
          .thenReturn(List.of(term));

      TagLabelUtil.applyTagCommonFieldsBatch(List.of(classificationLabel, glossaryLabel));

      assertEquals("Sensitive", classificationLabel.getName());
      assertEquals("Sensitive Data", classificationLabel.getDisplayName());
      assertEquals("Revenue", glossaryLabel.getName());
      assertEquals("Revenue Metric", glossaryLabel.getDisplayName());
    }
  }

  @Test
  void applyTagCommonFieldsBatchSkipsLabelsWithNullTagFQN() {
    TagLabel labelWithNull = new TagLabel().withSource(TagSource.CLASSIFICATION);
    TagLabel labelWithFQN =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagSource.CLASSIFICATION);

    Tag tag = new Tag();
    tag.setName("Sensitive");
    tag.setDisplayName("Sensitive Data");
    tag.setDescription("Sensitive info");
    tag.setFullyQualifiedName("PII.Sensitive");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityByNames(
                      eq(Entity.TAG), any(List.class), eq(""), eq(Include.NON_DELETED)))
          .thenReturn(List.of(tag));

      List<TagLabel> labels = new ArrayList<>();
      labels.add(labelWithNull);
      labels.add(labelWithFQN);

      TagLabelUtil.applyTagCommonFieldsBatch(labels);

      assertNull(labelWithNull.getName());
      assertEquals("Sensitive", labelWithFQN.getName());
    }
  }

  @Test
  void applyTagCommonFieldsBatchHandlesExceptionFromGetTags() {
    TagLabel label =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagSource.CLASSIFICATION);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityByNames(
                      eq(Entity.TAG), any(List.class), eq(""), eq(Include.NON_DELETED)))
          .thenThrow(new RuntimeException("DB connection failed"));

      TagLabelUtil.applyTagCommonFieldsBatch(List.of(label));

      assertNull(label.getName());
    }
  }

  @Test
  void applyTagCommonFieldsBatchHandlesExceptionFromGetGlossaryTerms() {
    TagLabel label = new TagLabel().withTagFQN("Glossary.Term").withSource(TagSource.GLOSSARY);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityByNames(
                      eq(Entity.GLOSSARY_TERM), any(List.class), eq(""), eq(Include.NON_DELETED)))
          .thenThrow(new RuntimeException("DB connection failed"));

      TagLabelUtil.applyTagCommonFieldsBatch(List.of(label));

      assertNull(label.getName());
    }
  }

  @Test
  void applyTagCommonFieldsBatchLeavesUnmatchedLabelsUnenriched() {
    TagLabel label = new TagLabel().withTagFQN("PII.Missing").withSource(TagSource.CLASSIFICATION);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityByNames(
                      eq(Entity.TAG), any(List.class), eq(""), eq(Include.NON_DELETED)))
          .thenReturn(Collections.emptyList());

      TagLabelUtil.applyTagCommonFieldsBatch(List.of(label));

      assertNull(label.getName());
    }
  }
}
