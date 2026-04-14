package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.tags.TagLabelUtil;

/**
 * Tests for dbt AUTOMATED tag cleanup behavior introduced in TableRepository.addDataModel.
 *
 * <p>These tests mirror the tag-merging logic used in addDataModel, focusing on how
 * AUTOMATED tags applied by the ingestion-bot are removed when no longer present in the
 * incoming dbt data model, while preserving other tags.
 */
class TableRepositoryDataModelTagTest {

  private static final TableRepository tableRepository;

  static {
    tableRepository = Mockito.mock(TableRepository.class);
    Mockito
        .when(
            tableRepository.removeStaleDbtAutomatedTags(
                Mockito.anyList(), Mockito.anyList()))
        .thenCallRealMethod();
  }

  private List<TagLabel> applyDbtTableTagUpdate(
      List<TagLabel> existingTableTags, DataModel dataModel) {
    List<TagLabel> mergedTableTags =
        TagLabelUtil.mergeTagsWithIncomingPrecedence(existingTableTags, dataModel.getTags());
    if (DataModel.ModelType.DBT.equals(dataModel.getModelType())) {
      mergedTableTags =
          tableRepository.removeStaleDbtAutomatedTags(mergedTableTags, dataModel.getTags());
    }
    return mergedTableTags;
  }

  private List<TagLabel> applyDbtColumnTagUpdate(
      List<TagLabel> storedColumnTags, DataModel dataModel, List<TagLabel> modelColumnTags) {
    List<TagLabel> mergedColumnTags =
        TagLabelUtil.mergeTagsWithIncomingPrecedence(storedColumnTags, modelColumnTags);
    if (DataModel.ModelType.DBT.equals(dataModel.getModelType())) {
      mergedColumnTags =
          tableRepository.removeStaleDbtAutomatedTags(mergedColumnTags, modelColumnTags);
    }
    return mergedColumnTags;
  }

  private TagLabel automatedDbtTag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.AUTOMATED)
        .withAppliedBy(Entity.INGESTION_BOT_NAME);
  }

  private TagLabel automatedOtherBotTag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.AUTOMATED)
        .withAppliedBy("other-bot");
  }

  private TagLabel manualTag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withAppliedBy("some-user");
  }

  private boolean containsTagFqn(List<TagLabel> tags, String fqn) {
    return tags.stream().anyMatch(t -> fqn.equals(t.getTagFQN()));
  }

  @Test
  void dbtTableTags_staleAutomatedTagsFromIngestionBotAreRemoved() {
    TagLabel staleAutomated = automatedDbtTag("Classification.Stale");
    TagLabel keptAutomated = automatedDbtTag("Classification.Kept");
    TagLabel manual = manualTag("Classification.Manual");
    TagLabel otherBotAutomated = automatedOtherBotTag("Classification.OtherBot");

    List<TagLabel> existing = List.of(staleAutomated, keptAutomated, manual, otherBotAutomated);

    DataModel dataModel = new DataModel().withModelType(DataModel.ModelType.DBT);
    dataModel.setTags(List.of(keptAutomated, manual, otherBotAutomated));

    List<TagLabel> result = applyDbtTableTagUpdate(existing, dataModel);

    assertEquals(3, result.size());
    assertTrue(containsTagFqn(result, "Classification.Kept"));
    assertTrue(containsTagFqn(result, "Classification.Manual"));
    assertTrue(containsTagFqn(result, "Classification.OtherBot"));
    assertTrue(!containsTagFqn(result, "Classification.Stale"));
  }

  @Test
  void ddlTableTags_automatedTagsAreNotRemoved() {
    TagLabel staleAutomated = automatedDbtTag("Classification.Stale");
    TagLabel keptAutomated = automatedDbtTag("Classification.Kept");
    TagLabel manual = manualTag("Classification.Manual");
    TagLabel otherBotAutomated = automatedOtherBotTag("Classification.OtherBot");

    List<TagLabel> existing = List.of(staleAutomated, keptAutomated, manual, otherBotAutomated);

    DataModel dataModel = new DataModel().withModelType(DataModel.ModelType.DDL);
    dataModel.setTags(List.of(keptAutomated, manual, otherBotAutomated));

    List<TagLabel> result = applyDbtTableTagUpdate(existing, dataModel);

    assertEquals(4, result.size());
    assertTrue(containsTagFqn(result, "Classification.Stale"));
    assertTrue(containsTagFqn(result, "Classification.Kept"));
    assertTrue(containsTagFqn(result, "Classification.Manual"));
    assertTrue(containsTagFqn(result, "Classification.OtherBot"));
  }

  @Test
  void dbtColumnTags_staleAutomatedTagsFromIngestionBotAreRemoved() {
    TagLabel staleAutomated = automatedDbtTag("Classification.Stale");
    TagLabel keptAutomated = automatedDbtTag("Classification.Kept");
    TagLabel manual = manualTag("Classification.Manual");

    List<TagLabel> storedColumnTags = List.of(staleAutomated, keptAutomated, manual);
    List<TagLabel> modelColumnTags = List.of(keptAutomated, manual);

    DataModel dataModel = new DataModel().withModelType(DataModel.ModelType.DBT);

    List<TagLabel> result = applyDbtColumnTagUpdate(storedColumnTags, dataModel, modelColumnTags);

    assertEquals(2, result.size());
    assertTrue(containsTagFqn(result, "Classification.Kept"));
    assertTrue(containsTagFqn(result, "Classification.Manual"));
    assertTrue(!containsTagFqn(result, "Classification.Stale"));
  }

  @Test
  void removeStaleDbtAutomatedTags_removesAllDbtAutomatedWhenIncomingNullOrEmpty() {
    TagLabel staleAutomated1 = automatedDbtTag("Classification.Stale1");
    TagLabel staleAutomated2 = automatedDbtTag("Classification.Stale2");
    TagLabel manual = manualTag("Classification.Manual");

    List<TagLabel> existing = List.of(staleAutomated1, staleAutomated2, manual);

    DataModel dataModel = new DataModel().withModelType(DataModel.ModelType.DBT);

    List<TagLabel> resultNull =
        tableRepository.removeStaleDbtAutomatedTags(existing, dataModel.getTags());
    assertEquals(1, resultNull.size());
    assertTrue(containsTagFqn(resultNull, "Classification.Manual"));

    dataModel.setTags(List.of());
    List<TagLabel> resultEmpty =
        tableRepository.removeStaleDbtAutomatedTags(existing, dataModel.getTags());
    assertEquals(1, resultEmpty.size());
    assertTrue(containsTagFqn(resultEmpty, "Classification.Manual"));
  }
}
