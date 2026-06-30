/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.governance.workflows.util.ChangePreviewUtils.FieldDiff;

class ChangePreviewUtilsTest {

  // ---------------------------------------------------------------------------
  // extractIdentifiers
  // ---------------------------------------------------------------------------

  @Test
  void extractIdentifiers_nullValue_returnsEmpty() {
    assertTrue(ChangePreviewUtils.extractIdentifiers(null).isEmpty());
  }

  @Test
  void extractIdentifiers_plainString_returnsSingleElement() {
    assertEquals(List.of("Draft"), ChangePreviewUtils.extractIdentifiers("Draft"));
  }

  @Test
  void extractIdentifiers_tagFqnObject_returnsTagFqn() {
    String json = "{\"tagFQN\":\"PII.Sensitive\",\"name\":\"Sensitive\"}";
    assertEquals(List.of("PII.Sensitive"), ChangePreviewUtils.extractIdentifiers(json));
  }

  @Test
  void extractIdentifiers_fullyQualifiedNameObject_returnsFqn() {
    String json = "{\"fullyQualifiedName\":\"Marketing.Glossary1\",\"displayName\":\"Glossary 1\"}";
    assertEquals(List.of("Marketing.Glossary1"), ChangePreviewUtils.extractIdentifiers(json));
  }

  @Test
  void extractIdentifiers_displayNameObject_returnsDisplayName() {
    String json = "{\"displayName\":\"Aaron Johnson\",\"name\":\"aaron.johnson\"}";
    assertEquals(List.of("Aaron Johnson"), ChangePreviewUtils.extractIdentifiers(json));
  }

  @Test
  void extractIdentifiers_nameOnlyObject_returnsName() {
    String json = "{\"name\":\"myEntity\"}";
    assertEquals(List.of("myEntity"), ChangePreviewUtils.extractIdentifiers(json));
  }

  @Test
  void extractIdentifiers_arrayOfTagObjects_returnsAllTagFqns() {
    String json = "[{\"tagFQN\":\"PII.Sensitive\"},{\"tagFQN\":\"PersonalData.Personal\"}]";
    assertEquals(
        List.of("PII.Sensitive", "PersonalData.Personal"),
        ChangePreviewUtils.extractIdentifiers(json));
  }

  @Test
  void extractIdentifiers_arrayOfStrings_returnsAll() {
    String json = "[\"one\",\"two\"]";
    assertEquals(List.of("one", "two"), ChangePreviewUtils.extractIdentifiers(json));
  }

  @Test
  void extractIdentifiers_listOfTagMaps_returnsAllTagFqns() {
    List<Map<String, Object>> tags =
        List.of(
            Map.of("tagFQN", "PII.Sensitive", "name", "Sensitive"),
            Map.of("tagFQN", "PersonalData.Personal", "name", "Personal"));

    assertEquals(
        List.of("PII.Sensitive", "PersonalData.Personal"),
        ChangePreviewUtils.extractIdentifiers(tags));
  }

  @Test
  void extractIdentifiers_listOfOwnerMaps_returnsDisplayNames() {
    List<Map<String, Object>> owners =
        List.of(
            Map.of("displayName", "Aaron Johnson", "name", "aaron.johnson"),
            Map.of("displayName", "Jane Doe", "name", "jane.doe"));

    assertEquals(
        List.of("Aaron Johnson", "Jane Doe"), ChangePreviewUtils.extractIdentifiers(owners));
  }

  @Test
  void extractIdentifiers_singleReferenceMap_returnsFullyQualifiedName() {
    Map<String, Object> reference =
        Map.of("fullyQualifiedName", "Marketing.Glossary1", "displayName", "Glossary 1");

    assertEquals(List.of("Marketing.Glossary1"), ChangePreviewUtils.extractIdentifiers(reference));
  }

  @Test
  void extractIdentifiers_singleNameOnlyMap_returnsName() {
    Map<String, Object> reference = Map.of("name", "myEntity");

    assertEquals(List.of("myEntity"), ChangePreviewUtils.extractIdentifiers(reference));
  }

  @Test
  void extractIdentifiers_listOfStrings_returnsAll() {
    assertEquals(
        List.of("one", "two"), ChangePreviewUtils.extractIdentifiers(List.of("one", "two")));
  }

  // ---------------------------------------------------------------------------
  // buildChangeMap
  // ---------------------------------------------------------------------------

  @Test
  void buildChangeMap_fieldsAdded_producesAddedEntry() {
    FieldChange fc = new FieldChange().withName("tags").withNewValue("[{\"tagFQN\":\"PII.None\"}]");
    ChangeDescription cd =
        new ChangeDescription()
            .withFieldsAdded(List.of(fc))
            .withFieldsDeleted(new ArrayList<>())
            .withFieldsUpdated(new ArrayList<>());

    Map<String, FieldDiff> result = ChangePreviewUtils.buildChangeMap(cd);

    assertEquals(List.of("PII.None"), result.get("tags").added());
    assertTrue(result.get("tags").removed().isEmpty());
  }

  @Test
  void buildChangeMap_fieldsDeleted_producesRemovedEntry() {
    FieldChange fc =
        new FieldChange().withName("owners").withOldValue("[{\"displayName\":\"Jane Smith\"}]");
    ChangeDescription cd =
        new ChangeDescription()
            .withFieldsAdded(new ArrayList<>())
            .withFieldsDeleted(List.of(fc))
            .withFieldsUpdated(new ArrayList<>());

    Map<String, FieldDiff> result = ChangePreviewUtils.buildChangeMap(cd);

    assertTrue(result.get("owners").added().isEmpty());
    assertEquals(List.of("Jane Smith"), result.get("owners").removed());
  }

  @Test
  void buildChangeMap_fieldsUpdated_producesBothEntries() {
    FieldChange fc =
        new FieldChange().withName("description").withOldValue("old text").withNewValue("new text");
    ChangeDescription cd =
        new ChangeDescription()
            .withFieldsAdded(new ArrayList<>())
            .withFieldsDeleted(new ArrayList<>())
            .withFieldsUpdated(List.of(fc));

    Map<String, FieldDiff> result = ChangePreviewUtils.buildChangeMap(cd);

    assertEquals(List.of("new text"), result.get("description").added());
    assertEquals(List.of("old text"), result.get("description").removed());
  }

  @Test
  void buildChangeMap_sameFieldInAddedAndDeleted_accumulatesBothSides() {
    FieldChange added =
        new FieldChange().withName("tags").withNewValue("[{\"tagFQN\":\"PII.Sensitive\"}]");
    FieldChange deleted =
        new FieldChange().withName("tags").withOldValue("[{\"tagFQN\":\"PII.None\"}]");
    ChangeDescription cd =
        new ChangeDescription()
            .withFieldsAdded(List.of(added))
            .withFieldsDeleted(List.of(deleted))
            .withFieldsUpdated(new ArrayList<>());

    Map<String, FieldDiff> result = ChangePreviewUtils.buildChangeMap(cd);

    assertEquals(List.of("PII.Sensitive"), result.get("tags").added());
    assertEquals(List.of("PII.None"), result.get("tags").removed());
  }

  // ---------------------------------------------------------------------------
  // mergeChangeMaps — set-cancellation semantics
  // ---------------------------------------------------------------------------

  @Test
  void mergeChangeMaps_disjointFields_mergesAll() {
    Map<String, FieldDiff> oldMap =
        Map.of("tags", new FieldDiff(List.of("PII.Sensitive"), List.of("PII.None")));
    Map<String, FieldDiff> newMap =
        Map.of("description", new FieldDiff(List.of("new text"), List.of("old text")));

    Map<String, FieldDiff> merged = ChangePreviewUtils.mergeChangeMaps(oldMap, newMap);

    assertEquals(2, merged.size());
    assertTrue(merged.containsKey("tags"));
    assertTrue(merged.containsKey("description"));
  }

  @Test
  void mergeChangeMaps_newAddedCancelsOldRemoved() {
    Map<String, FieldDiff> edit1 =
        Map.of("tags", new FieldDiff(List.of("PII.Sensitive"), List.of("PII.None")));
    Map<String, FieldDiff> edit2 = Map.of("tags", new FieldDiff(List.of("PII.None"), List.of()));

    Map<String, FieldDiff> merged = ChangePreviewUtils.mergeChangeMaps(edit1, edit2);

    assertEquals(List.of("PII.Sensitive"), merged.get("tags").added());
    assertTrue(merged.get("tags").removed().isEmpty());
  }

  @Test
  void mergeChangeMaps_newRemovedCancelsOldAdded() {
    Map<String, FieldDiff> edit1 =
        Map.of("tags", new FieldDiff(List.of("PII.Sensitive"), List.of()));
    Map<String, FieldDiff> edit2 =
        Map.of("tags", new FieldDiff(List.of(), List.of("PII.Sensitive")));

    Map<String, FieldDiff> merged = ChangePreviewUtils.mergeChangeMaps(edit1, edit2);

    assertNull(merged.get("tags"));
  }

  @Test
  void mergeChangeMaps_threeEdits_accumulatesCorrectly() {
    Map<String, FieldDiff> edit1 =
        Map.of("tags", new FieldDiff(List.of("PII.Sensitive"), List.of("PII.None")));
    Map<String, FieldDiff> edit2 =
        Map.of("tags", new FieldDiff(List.of("PersonalData.Personal"), List.of()));
    Map<String, FieldDiff> edit3 =
        Map.of("tags", new FieldDiff(List.of(), List.of("PII.Sensitive")));

    Map<String, FieldDiff> after12 = ChangePreviewUtils.mergeChangeMaps(edit1, edit2);
    Map<String, FieldDiff> after123 = ChangePreviewUtils.mergeChangeMaps(after12, edit3);

    assertEquals(List.of("PersonalData.Personal"), after123.get("tags").added());
    assertEquals(List.of("PII.None"), after123.get("tags").removed());
  }

  // ---------------------------------------------------------------------------
  // parseChangeMap
  // ---------------------------------------------------------------------------

  @Test
  void parseChangeMap_nullMessage_returnsEmptyMap() {
    assertTrue(ChangePreviewUtils.parseChangeMap(null).isEmpty());
  }

  @Test
  void parseChangeMap_nonJsonMessage_returnsEmptyMap() {
    assertTrue(ChangePreviewUtils.parseChangeMap("- some markdown").isEmpty());
  }

  @Test
  void parseChangeMap_validJson_roundTrips() {
    String json = "{\"tags\":{\"added\":[\"PII.Sensitive\"],\"removed\":[\"PII.None\"]}}";
    Map<String, FieldDiff> parsed = ChangePreviewUtils.parseChangeMap(json);

    assertEquals(List.of("PII.Sensitive"), parsed.get("tags").added());
    assertEquals(List.of("PII.None"), parsed.get("tags").removed());
  }

  @Test
  void parseChangeMap_missingRemovedField_defaultsToEmpty() {
    String json = "{\"tags\":{\"added\":[\"PII.Sensitive\"]}}";
    Map<String, FieldDiff> parsed = ChangePreviewUtils.parseChangeMap(json);

    assertEquals(List.of("PII.Sensitive"), parsed.get("tags").added());
    assertTrue(parsed.get("tags").removed().isEmpty());
  }

  @Test
  void parseChangeMap_missingAddedField_defaultsToEmpty() {
    String json = "{\"tags\":{\"removed\":[\"PII.None\"]}}";
    Map<String, FieldDiff> parsed = ChangePreviewUtils.parseChangeMap(json);

    assertTrue(parsed.get("tags").added().isEmpty());
    assertEquals(List.of("PII.None"), parsed.get("tags").removed());
  }

  @Test
  void fieldDiff_nullComponentsInConstructor_defaultToEmpty() {
    FieldDiff diff = new FieldDiff(null, null);
    assertTrue(diff.added().isEmpty());
    assertTrue(diff.removed().isEmpty());
    assertTrue(diff.isEmpty());
  }

  // ---------------------------------------------------------------------------
  // hasNoChanges
  // ---------------------------------------------------------------------------

  @Test
  void buildChangeMap_nullFieldLists_doesNotThrow() {
    ChangeDescription cd = new ChangeDescription();
    Map<String, FieldDiff> result = ChangePreviewUtils.buildChangeMap(cd);
    assertTrue(result.isEmpty());
  }

  @Test
  void hasNoChanges_nullChangeDescription_returnsTrue() {
    assertTrue(ChangePreviewUtils.hasNoChanges(null));
  }

  @Test
  void hasNoChanges_emptyLists_returnsTrue() {
    ChangeDescription cd =
        new ChangeDescription()
            .withFieldsAdded(new ArrayList<>())
            .withFieldsDeleted(new ArrayList<>())
            .withFieldsUpdated(new ArrayList<>());
    assertTrue(ChangePreviewUtils.hasNoChanges(cd));
  }

  @Test
  void hasNoChanges_withChanges_returnsFalse() {
    FieldChange fc = new FieldChange().withName("tags").withNewValue("x");
    ChangeDescription cd =
        new ChangeDescription()
            .withFieldsAdded(List.of(fc))
            .withFieldsDeleted(new ArrayList<>())
            .withFieldsUpdated(new ArrayList<>());
    assertTrue(!ChangePreviewUtils.hasNoChanges(cd));
  }

  // ---------------------------------------------------------------------------
  // extractProposedChanges
  // ---------------------------------------------------------------------------

  @Test
  void extractProposedChanges_nullPayload_returnsEmpty() {
    assertTrue(ChangePreviewUtils.extractProposedChanges(null).isEmpty());
  }

  @Test
  void extractProposedChanges_payloadWithoutKey_returnsEmpty() {
    Map<String, Object> payload = Map.of("feedback", "x");
    assertTrue(ChangePreviewUtils.extractProposedChanges(payload).isEmpty());
  }

  @Test
  void extractProposedChanges_payloadWithKey_returnsMap() {
    Map<String, Object> payload =
        Map.of(
            "proposedChanges",
            Map.of("tags", Map.of("added", List.of("PII.Sensitive"), "removed", List.of())));
    Map<String, FieldDiff> result = ChangePreviewUtils.extractProposedChanges(payload);
    assertEquals(List.of("PII.Sensitive"), result.get("tags").added());
  }

  // ---------------------------------------------------------------------------
  // buildProposedChangesPayload
  // ---------------------------------------------------------------------------

  @Test
  void buildProposedChangesPayload_nullEntity_returnsInput() {
    Map<String, Object> existing = Map.of("k", "v");
    assertEquals(existing, ChangePreviewUtils.buildProposedChangesPayload(null, existing));
  }

  @Test
  void extractProposedChanges_jsonRoundTripShape_recoversMap() {
    Map<String, Object> persisted =
        Map.of(
            "proposedChanges",
            Map.of(
                "tags", Map.of("added", List.of("PII.Sensitive"), "removed", List.of("PII.None"))));

    Map<String, FieldDiff> recovered = ChangePreviewUtils.extractProposedChanges(persisted);

    assertEquals(List.of("PII.Sensitive"), recovered.get("tags").added());
    assertEquals(List.of("PII.None"), recovered.get("tags").removed());
  }

  @Test
  void extractProposedChanges_jsonRoundTripMissingRemovedKey_defaultsToEmpty() {
    Map<String, Object> persisted =
        Map.of("proposedChanges", Map.of("tags", Map.of("added", List.of("PII.Sensitive"))));

    Map<String, FieldDiff> recovered = ChangePreviewUtils.extractProposedChanges(persisted);

    assertEquals(List.of("PII.Sensitive"), recovered.get("tags").added());
    assertTrue(recovered.get("tags").removed().isEmpty());
  }

  @Test
  void buildProposedChangesPayload_entityWithoutChanges_returnsInput() {
    EntityInterface entity = new GlossaryTerm().withName("t");
    Map<String, Object> existing = Map.of("k", "v");
    assertEquals(existing, ChangePreviewUtils.buildProposedChangesPayload(entity, existing));
  }

  @Test
  void buildProposedChangesPayload_prefersIncrementalOverCumulative() {
    // Simulates the in-session-edit scenario: cumulative changeDescription reports a tag
    // removal that the prior task payload already cancelled, while the latest hop only
    // touches a different field. Without incremental preference, the cumulative removal
    // double-counts and re-introduces the cancelled tag on the removed side.
    EntityInterface entity =
        new GlossaryTerm()
            .withName("t")
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsDeleted(
                        List.of(
                            new FieldChange()
                                .withName("tags")
                                .withOldValue("[{\"tagFQN\":\"PII.None\"}]"))))
            .withIncrementalChangeDescription(
                new ChangeDescription()
                    .withFieldsDeleted(
                        List.of(
                            new FieldChange()
                                .withName("tags")
                                .withOldValue("[{\"tagFQN\":\"KnowledgeCenter.Article\"}]"))));

    Map<String, Object> priorPayload = new LinkedHashMap<>();
    priorPayload.put(
        "proposedChanges",
        Map.of("tags", Map.of("added", List.of("KnowledgeCenter.Article"), "removed", List.of())));

    Object result = ChangePreviewUtils.buildProposedChangesPayload(entity, priorPayload);
    Map<String, FieldDiff> proposed = ChangePreviewUtils.extractProposedChanges(result);

    assertNull(proposed.get("tags"));
  }

  @Test
  void buildProposedChangesPayload_freshChanges_writesKey() {
    EntityInterface entity =
        new GlossaryTerm()
            .withName("t")
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsAdded(
                        List.of(
                            new FieldChange()
                                .withName("tags")
                                .withNewValue("[{\"tagFQN\":\"PII.Sensitive\"}]"))));

    Object result = ChangePreviewUtils.buildProposedChangesPayload(entity, null);

    assertTrue(result instanceof Map);
    Map<String, FieldDiff> proposed = ChangePreviewUtils.extractProposedChanges(result);
    assertEquals(List.of("PII.Sensitive"), proposed.get("tags").added());
  }

  @Test
  void buildProposedChangesPayload_mergesWithExistingProposedChanges() {
    Map<String, Object> existingPayload = new LinkedHashMap<>();
    existingPayload.put("feedback", "keep me");
    existingPayload.put(
        "proposedChanges",
        Map.of("tags", Map.of("added", List.of("PII.Sensitive"), "removed", List.of("PII.None"))));

    EntityInterface entity =
        new GlossaryTerm()
            .withName("t")
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsAdded(
                        List.of(
                            new FieldChange()
                                .withName("tags")
                                .withNewValue("[{\"tagFQN\":\"PersonalData.Personal\"}]"))));

    Object result = ChangePreviewUtils.buildProposedChangesPayload(entity, existingPayload);

    assertTrue(result instanceof Map<?, ?>);
    Map<?, ?> resultMap = (Map<?, ?>) result;
    assertEquals("keep me", resultMap.get("feedback"));
    Map<String, FieldDiff> proposed = ChangePreviewUtils.extractProposedChanges(result);
    assertEquals(List.of("PII.Sensitive", "PersonalData.Personal"), proposed.get("tags").added());
    assertEquals(List.of("PII.None"), proposed.get("tags").removed());
  }

  @Test
  void buildProposedChangesPayload_cancelsToEmpty_removesKey() {
    Map<String, Object> existingPayload = new LinkedHashMap<>();
    existingPayload.put(
        "proposedChanges",
        Map.of("tags", Map.of("added", List.of("PII.Sensitive"), "removed", List.of())));

    EntityInterface entity =
        new GlossaryTerm()
            .withName("t")
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsDeleted(
                        List.of(
                            new FieldChange()
                                .withName("tags")
                                .withOldValue("[{\"tagFQN\":\"PII.Sensitive\"}]"))));

    Object result = ChangePreviewUtils.buildProposedChangesPayload(entity, existingPayload);

    assertTrue(result instanceof Map<?, ?>);
    assertTrue(!((Map<?, ?>) result).containsKey("proposedChanges"));
  }
}
