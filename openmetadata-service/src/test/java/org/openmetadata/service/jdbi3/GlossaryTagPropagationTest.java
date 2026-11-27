package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.PropagationDescriptor;

class GlossaryTagPropagationTest {
  @AfterEach
  void cleanup() {
    Entity.cleanup();
  }

  @Test
  void preferenceOnlyDisablesTagSearchPropagation() {
    Entity.setCollectionDAO(mock(CollectionDAO.class));
    GlossaryTermRepository repository = new GlossaryTermRepository(false);
    try (MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class)) {
      settings.when(SettingsCache::isGlossaryTagPropagationEnabled).thenReturn(true);
      List<PropagationDescriptor> enabled = repository.getSearchPropagationDescriptors();

      settings.when(SettingsCache::isGlossaryTagPropagationEnabled).thenReturn(false);
      List<PropagationDescriptor> disabled = repository.getSearchPropagationDescriptors();

      assertEquals(1, enabled.size() - disabled.size());
      assertEquals(
          enabled.stream().filter(field -> !Entity.FIELD_TAGS.equals(field.fieldName())).toList(),
          disabled);
    }
  }

  @Test
  void mergeOwnTagsPreservesTermManualLabelWhenGlossaryHasDerivedCopy() {
    TagLabel termDirect =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(LabelType.MANUAL)
            .withAppliedBy("term-owner");
    TagLabel glossaryTermTag =
        new TagLabel()
            .withTagFQN("OtherGlossary.HelperTerm")
            .withSource(TagSource.GLOSSARY)
            .withLabelType(LabelType.MANUAL)
            .withAppliedBy("glossary-owner");
    TagLabel glossaryDerivedCopy =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(LabelType.DERIVED);

    List<TagLabel> merged =
        GlossaryTermRepository.mergeOwnTags(
            List.of(termDirect), List.of(glossaryTermTag, glossaryDerivedCopy));

    assertEquals(2, merged.size());
    TagLabel keptDirect =
        merged.stream()
            .filter(t -> "PII.Sensitive".equals(t.getTagFQN()))
            .findFirst()
            .orElseThrow();
    assertEquals(LabelType.MANUAL, keptDirect.getLabelType());
    assertEquals("term-owner", keptDirect.getAppliedBy());
    assertEquals(
        1, merged.stream().filter(t -> "OtherGlossary.HelperTerm".equals(t.getTagFQN())).count());
  }

  @Test
  void mergeOwnTagsHandlesNullListsAndPreservesTermAttributesOverGlossary() {
    TagLabel termTag =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(LabelType.MANUAL)
            .withAppliedBy("alice");
    TagLabel glossaryTag =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(LabelType.MANUAL)
            .withAppliedBy("bob");

    List<TagLabel> merged =
        GlossaryTermRepository.mergeOwnTags(List.of(termTag), List.of(glossaryTag));
    assertEquals(1, merged.size());
    assertEquals("alice", merged.getFirst().getAppliedBy());

    List<TagLabel> fromNullTerm = GlossaryTermRepository.mergeOwnTags(null, List.of(glossaryTag));
    assertEquals(1, fromNullTerm.size());
    assertEquals("PII.Sensitive", fromNullTerm.getFirst().getTagFQN());
  }
}
