package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;

class VersionFieldChangeUtilTest {

  @Test
  void extractsExactFieldKeysFromChangeDescription() {
    ChangeDescription changeDescription =
        new ChangeDescription()
            .withFieldsUpdated(
                java.util.List.of(
                    new FieldChange().withName("columns.tags.tagFQN"),
                    new FieldChange().withName("description")));

    Set<String> fieldChangeKeys = VersionFieldChangeUtil.extractFieldChangeKeys(changeDescription);

    assertTrue(fieldChangeKeys.contains("columns.tags.tagFQN"));
    assertTrue(fieldChangeKeys.contains("description"));
    assertEquals(2, fieldChangeKeys.size());
  }

  @Test
  void serializesUniqueFieldChangeKeysExactlyOnce() {
    ChangeDescription changeDescription =
        new ChangeDescription()
            .withFieldsAdded(
                java.util.List.of(new FieldChange().withName("columns.name.description")))
            .withFieldsUpdated(
                java.util.List.of(new FieldChange().withName("columns.name.description")));

    var keys =
        JsonUtils.readObjects(
            VersionFieldChangeUtil.getChangedFieldKeysJson(changeDescription), String.class);

    assertEquals(1, keys.size());
    assertTrue(keys.contains("columns.name.description"));
  }

  @Test
  void matchesExactFieldNamesButNotNestedPathsOrSubstrings() {
    ChangeDescription changeDescription =
        new ChangeDescription()
            .withFieldsUpdated(
                java.util.List.of(new FieldChange().withName("columns.name.description")));

    assertTrue(
        VersionFieldChangeUtil.matchesFieldChanged(changeDescription, "columns.name.description"));
    assertFalse(VersionFieldChangeUtil.matchesFieldChanged(changeDescription, "description"));
    assertFalse(
        VersionFieldChangeUtil.matchesFieldChanged(changeDescription, "columns.description"));
    assertFalse(VersionFieldChangeUtil.matchesFieldChanged(changeDescription, "script"));
  }

  @Test
  void matchesFieldChangedFromSerializedEntityJson() {
    String entityJson =
        JsonUtils.pojoToJson(
            java.util.Map.of(
                "changeDescription",
                new ChangeDescription()
                    .withFieldsUpdated(
                        java.util.List.of(
                            new FieldChange().withName("columns.name.description")))));

    assertTrue(VersionFieldChangeUtil.matchesFieldChanged(entityJson, "columns.name.description"));
    assertFalse(VersionFieldChangeUtil.matchesFieldChanged(entityJson, "description"));
    assertFalse(VersionFieldChangeUtil.matchesFieldChanged(entityJson, "columns.description"));
    assertFalse(VersionFieldChangeUtil.matchesFieldChanged(entityJson, "owners"));
  }
}
