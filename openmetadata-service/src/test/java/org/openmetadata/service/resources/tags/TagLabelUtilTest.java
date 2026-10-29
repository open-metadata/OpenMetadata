package org.openmetadata.service.resources.tags;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.configuration.GlossarySettings;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.FullyQualifiedName;

class TagLabelUtilTest {

  @Test
  void disabledGlossaryPropagationReadsSkipLookupsAndRemoveStaleDerivedLabels() {
    TagLabel term = new TagLabel().withTagFQN("Glossary.Customer").withSource(TagSource.GLOSSARY);
    TagLabel direct = new TagLabel().withTagFQN("Classification.Direct");
    TagLabel derived =
        new TagLabel().withTagFQN("PII.Sensitive").withLabelType(TagLabel.LabelType.DERIVED);
    List<TagLabel> tags = List.of(direct, term, derived);
    try (MockedStatic<SettingsCache> settings =
            mockStatic(SettingsCache.class, CALLS_REAL_METHODS);
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      settings
          .when(
              () ->
                  SettingsCache.getSettingOrDefault(
                      eq(SettingsType.GLOSSARY_SETTINGS),
                      any(GlossarySettings.class),
                      eq(GlossarySettings.class)))
          .thenReturn(new GlossarySettings().withEnableTagPropagation(false));
      entity
          .when(Entity::getCollectionDAO)
          .thenThrow(new AssertionError("Disabled propagation must not fetch glossary tags"));

      assertEquals(Map.of(), TagLabelUtil.batchFetchDerivedTags(tags));
      assertEquals(List.of(direct, term), TagLabelUtil.addDerivedTagsGracefully(tags));
      assertEquals(
          List.of(direct, term),
          TagLabelUtil.addDerivedTagsWithPreFetched(
              tags, TagLabelUtil.batchFetchDerivedTags(tags)));
    }
  }

  @Test
  void prefetchedTagsUseTheFetchedPreferenceSnapshot() {
    TagLabel customer =
        new TagLabel().withTagFQN("Glossary.Customer").withSource(TagSource.GLOSSARY);
    TagLabel account = new TagLabel().withTagFQN("Glossary.Account").withSource(TagSource.GLOSSARY);
    TagLabel derived =
        new TagLabel().withTagFQN("PII.Sensitive").withLabelType(TagLabel.LabelType.DERIVED);
    try (MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class)) {
      settings
          .when(SettingsCache::isGlossaryTagPropagationEnabled)
          .thenThrow(new AssertionError("Merging a prefetched batch must not reload settings"));
      List<TagLabel> tags = List.of(customer, account, derived);
      assertEquals(
          List.of(account, customer, derived),
          TagLabelUtil.addDerivedTagsWithPreFetched(
              tags,
              Map.of(
                  FullyQualifiedName.buildHash(customer.getTagFQN()), List.of(derived),
                  FullyQualifiedName.buildHash(account.getTagFQN()), List.of(derived))));
      assertEquals(
          List.of(account, customer), TagLabelUtil.addDerivedTagsWithPreFetched(tags, Map.of()));
    }
  }

  @Test
  void disabledPropagationStillRejectsConflictingWrites() {
    TagLabel term = new TagLabel().withTagFQN("Glossary.Customer").withSource(TagSource.GLOSSARY);
    TagLabel direct = new TagLabel().withTagFQN("PII.NonSensitive");
    TagLabel derived = new TagLabel().withTagFQN("PII.Sensitive");
    CollectionDAO collection = mock(CollectionDAO.class);
    CollectionDAO.TagUsageDAO tags = mock(CollectionDAO.TagUsageDAO.class);
    when(collection.tagUsageDAO()).thenReturn(tags);
    when(tags.getTags(term.getTagFQN())).thenReturn(List.of(derived));
    try (MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class);
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      settings.when(SettingsCache::isGlossaryTagPropagationEnabled).thenReturn(false);
      entity.when(Entity::getCollectionDAO).thenReturn(collection);
      entity
          .when(() -> Entity.getEntityByName(Entity.CLASSIFICATION, "PII", "", Include.NON_DELETED))
          .thenReturn(new Classification().withMutuallyExclusive(true));

      assertThrows(
          IllegalArgumentException.class, () -> TagLabelUtil.addDerivedTags(List.of(term, direct)));
      assertEquals(List.of(term), TagLabelUtil.addDerivedTags(List.of(term)));
    }
  }

  @Test
  void enabledGlossaryPropagationPreservesDirectAssignments() {
    TagLabel term = new TagLabel().withTagFQN("Glossary.Customer").withSource(TagSource.GLOSSARY);
    TagLabel direct = new TagLabel().withTagFQN("PII.Sensitive");
    TagLabel derived =
        new TagLabel().withTagFQN("PII.Sensitive").withLabelType(TagLabel.LabelType.DERIVED);
    try (MockedStatic<SettingsCache> settings =
        mockStatic(SettingsCache.class, CALLS_REAL_METHODS)) {
      settings
          .when(
              () ->
                  SettingsCache.getSettingOrDefault(
                      eq(SettingsType.GLOSSARY_SETTINGS),
                      any(GlossarySettings.class),
                      eq(GlossarySettings.class)))
          .thenReturn(new GlossarySettings());
      assertEquals(
          List.of(term, direct),
          TagLabelUtil.addDerivedTagsWithPreFetched(
              List.of(term, direct),
              Map.of(FullyQualifiedName.buildHash(term.getTagFQN()), List.of(derived))));
      assertEquals(
          List.of(term, derived),
          TagLabelUtil.addDerivedTagsWithPreFetched(
              List.of(term),
              Map.of(FullyQualifiedName.buildHash(term.getTagFQN()), List.of(derived))));
    }
  }

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

  /**
   * A field reads back its parent's glossary terms as DERIVED, so a plain GET/PUT round trip sends a
   * column back carrying both its own term and the inherited one. Both hang off the same glossary,
   * so an unfiltered check pairs them up and rejects the write with a mutual-exclusivity 400 for a
   * label the user never applied and cannot remove.
   */
  @Test
  void mutuallyExclusiveCheckIgnoresInheritedTerms() {
    List<TagLabel> roundTrippedColumnTags =
        List.of(
            glossaryLabel("Finance.Revenue", TagLabel.LabelType.MANUAL),
            glossaryLabel("Finance.Cost", TagLabel.LabelType.DERIVED));

    try (MockedStatic<Entity> entityMock = derivedTagsInTagUsage(Map.of());
        MockedStatic<TagLabelUtil> utilMock =
            mockStatic(TagLabelUtil.class, Mockito.CALLS_REAL_METHODS)) {
      utilMock.when(() -> TagLabelUtil.mutuallyExclusive(any(TagLabel.class))).thenReturn(true);

      assertDoesNotThrow(
          () -> TagLabelUtil.checkMutuallyExclusiveForUserAppliedTags(roundTrippedColumnTags));
    }
  }

  /**
   * A label propagated along lineage is stored for the asset like one applied by hand, so it is
   * checked: a column carrying a propagated {@code Finance.Cost} cannot also take {@code
   * Finance.Revenue}.
   */
  @Test
  void mutuallyExclusiveCheckCoversLineagePropagatedLabels() {
    List<TagLabel> columnTags =
        List.of(
            glossaryLabel("Finance.Revenue", TagLabel.LabelType.MANUAL),
            glossaryLabel("Finance.Cost", TagLabel.LabelType.PROPAGATED));

    try (MockedStatic<Entity> entityMock = derivedTagsInTagUsage(Map.of());
        MockedStatic<TagLabelUtil> utilMock =
            mockStatic(TagLabelUtil.class, Mockito.CALLS_REAL_METHODS)) {
      utilMock.when(() -> TagLabelUtil.mutuallyExclusive(any(TagLabel.class))).thenReturn(true);

      assertThrows(
          IllegalArgumentException.class,
          () -> TagLabelUtil.checkMutuallyExclusiveForUserAppliedTags(columnTags));
    }
  }

  @Test
  void mutuallyExclusiveCheckStillPairsUpTwoUserAppliedLabels() {
    List<TagLabel> userApplied =
        List.of(
            glossaryLabel("Finance.Revenue", TagLabel.LabelType.MANUAL),
            glossaryLabel("Finance.Cost", TagLabel.LabelType.MANUAL));

    try (MockedStatic<Entity> entityMock = derivedTagsInTagUsage(Map.of());
        MockedStatic<TagLabelUtil> utilMock =
            mockStatic(TagLabelUtil.class, Mockito.CALLS_REAL_METHODS)) {
      utilMock.when(() -> TagLabelUtil.mutuallyExclusive(any(TagLabel.class))).thenReturn(true);

      assertThrows(
          IllegalArgumentException.class,
          () -> TagLabelUtil.checkMutuallyExclusiveForUserAppliedTags(userApplied));
    }
  }

  /**
   * The classification tags a field's own glossary term implies are still checked: a term carrying
   * {@code PII.Sensitive} next to a manual {@code PII.NonSensitive} is rejected, as it was before
   * inherited labels were exempted.
   */
  @Test
  void derivedTagOfTheFieldsOwnTermStillConflictsWithAManualTag() {
    List<TagLabel> columnTags =
        List.of(
            glossaryLabel("Finance.Revenue", TagLabel.LabelType.MANUAL),
            classificationLabel("PII.NonSensitive", TagLabel.LabelType.MANUAL));
    Map<String, List<TagLabel>> revenueImpliesSensitive =
        Map.of(
            "Finance.Revenue",
            List.of(classificationLabel("PII.Sensitive", TagLabel.LabelType.DERIVED)));

    try (MockedStatic<Entity> entityMock = derivedTagsInTagUsage(revenueImpliesSensitive);
        MockedStatic<TagLabelUtil> utilMock =
            mockStatic(TagLabelUtil.class, Mockito.CALLS_REAL_METHODS)) {
      utilMock.when(() -> TagLabelUtil.mutuallyExclusive(any(TagLabel.class))).thenReturn(true);

      assertThrows(
          IllegalArgumentException.class,
          () -> TagLabelUtil.checkMutuallyExclusiveForUserAppliedTags(columnTags));
    }
  }

  /**
   * A term inherited from the parent and the classification tag it implies are both DERIVED. A GET →
   * PUT round trip carries them back next to the column's own {@code PII.NonSensitive}, and neither
   * may block the write.
   */
  @Test
  void derivedTagOfAnInheritedTermDoesNotConflictWithAManualTag() {
    List<TagLabel> roundTrippedColumnTags =
        List.of(
            classificationLabel("PII.NonSensitive", TagLabel.LabelType.MANUAL),
            glossaryLabel("Finance.Revenue", TagLabel.LabelType.DERIVED),
            classificationLabel("PII.Sensitive", TagLabel.LabelType.DERIVED));

    try (MockedStatic<TagLabelUtil> utilMock =
        mockStatic(TagLabelUtil.class, Mockito.CALLS_REAL_METHODS)) {
      utilMock.when(() -> TagLabelUtil.mutuallyExclusive(any(TagLabel.class))).thenReturn(true);

      assertDoesNotThrow(
          () -> TagLabelUtil.checkMutuallyExclusiveForUserAppliedTags(roundTrippedColumnTags));
    }
  }

  /**
   * With glossary tag propagation off the implied tags are not returned, but they are still
   * validated: a write accepted now must not become an invalid combination when it is turned back
   * on.
   */
  @Test
  void derivedTagOfTheFieldsOwnTermConflictsEvenWithGlossaryPropagationOff() {
    List<TagLabel> columnTags =
        List.of(
            glossaryLabel("Finance.Revenue", TagLabel.LabelType.MANUAL),
            classificationLabel("PII.NonSensitive", TagLabel.LabelType.MANUAL));
    Map<String, List<TagLabel>> revenueImpliesSensitive =
        Map.of(
            "Finance.Revenue",
            List.of(classificationLabel("PII.Sensitive", TagLabel.LabelType.DERIVED)));

    try (MockedStatic<Entity> entityMock = derivedTagsInTagUsage(revenueImpliesSensitive);
        MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class);
        MockedStatic<TagLabelUtil> utilMock =
            mockStatic(TagLabelUtil.class, Mockito.CALLS_REAL_METHODS)) {
      settings.when(SettingsCache::isGlossaryTagPropagationEnabled).thenReturn(false);
      utilMock.when(() -> TagLabelUtil.mutuallyExclusive(any(TagLabel.class))).thenReturn(true);

      assertThrows(
          IllegalArgumentException.class,
          () -> TagLabelUtil.checkMutuallyExclusiveForUserAppliedTags(columnTags));
    }
  }

  /**
   * Bulk-adding a term to a column whose table already carries it: the column reads the term back as
   * DERIVED, and that copy must not shadow the one being added, or nothing would be stored.
   */
  @Test
  void ownTagsWithDropsDerivedLabelsSoTheAddedTermIsStored() {
    List<TagLabel> columnTags =
        List.of(
            glossaryLabel("Finance.Revenue", TagLabel.LabelType.DERIVED),
            classificationLabel("PII.Sensitive", TagLabel.LabelType.DERIVED),
            glossaryLabel("Finance.Cost", TagLabel.LabelType.MANUAL));

    List<TagLabel> stored =
        TagLabelUtil.ownTagsWith(
            columnTags, glossaryLabel("Finance.Revenue", TagLabel.LabelType.MANUAL));

    assertEquals(
        List.of("Finance.Cost:MANUAL", "Finance.Revenue:MANUAL"),
        stored.stream().map(tag -> tag.getTagFQN() + ":" + tag.getLabelType().name()).toList());
  }

  /** Stands in for tag_usage: the classification tags each glossary term carries. */
  private static MockedStatic<Entity> derivedTagsInTagUsage(
      Map<String, List<TagLabel>> derivedTagsByTermFqn) {
    Map<String, List<TagLabel>> derivedTagsByTermHash = new HashMap<>();
    derivedTagsByTermFqn.forEach(
        (termFqn, derivedTags) ->
            derivedTagsByTermHash.put(FullyQualifiedName.buildHash(termFqn), derivedTags));
    CollectionDAO.TagUsageDAO tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);
    when(tagUsageDAO.getDerivedTagsBatch(anyList())).thenReturn(derivedTagsByTermHash);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.tagUsageDAO()).thenReturn(tagUsageDAO);
    MockedStatic<Entity> entityMock = mockStatic(Entity.class);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    return entityMock;
  }

  private static TagLabel glossaryLabel(String fqn, TagLabel.LabelType labelType) {
    return new TagLabel().withTagFQN(fqn).withSource(TagSource.GLOSSARY).withLabelType(labelType);
  }

  private static TagLabel classificationLabel(String fqn, TagLabel.LabelType labelType) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagSource.CLASSIFICATION)
        .withLabelType(labelType);
  }
}
