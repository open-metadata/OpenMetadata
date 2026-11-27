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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.jdbi.v3.core.ConnectionException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.util.ChangePreviewUtils.CyclePreview;
import org.openmetadata.service.governance.workflows.util.ChangePreviewUtils.FieldDiff;

class ChangePreviewUtilsTest {
  private static final GlossaryTerm TERM = new GlossaryTerm().withName("t");

  @Test
  void mcpTaskPreviewMasksConnectionChangesWithoutChangingPendingValues() {
    final ChangeDescription pending =
        new ChangeDescription()
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName("connectionConfig")
                        .withOldValue("old-secret")
                        .withNewValue("new-secret")));
    final String original = JsonUtils.pojoToJson(pending);

    final Object payload =
        ChangePreviewUtils.buildProposedChangesPayload(new McpServer(), null, pending);

    assertFalse(JsonUtils.pojoToJson(payload).contains("-secret"));
    assertEquals(original, JsonUtils.pojoToJson(pending));
  }

  @Test
  void mcpCyclePreviewMasksEachFoldedConnectionChange() {
    final ChangeDescription connectionEdit =
        new ChangeDescription()
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName("connectionConfig")
                        .withOldValue("old-secret")
                        .withNewValue("new-secret")));
    final String original = JsonUtils.pojoToJson(connectionEdit);

    final Object payload =
        ChangePreviewUtils.withCyclePreview(new McpServer(), null, cycle(0.1, connectionEdit));

    assertFalse(JsonUtils.pojoToJson(payload).contains("-secret"));
    assertEquals(original, JsonUtils.pojoToJson(connectionEdit));
  }

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
    assertEquals(
        existing, ChangePreviewUtils.buildProposedChangesPayload(null, existing, tagsAdded("X")));
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

  // ---------------------------------------------------------------------------
  // preservePreviewState
  // ---------------------------------------------------------------------------

  @Test
  void preservePreviewState_nullRequestedPayload_returnsInput() {
    assertNull(ChangePreviewUtils.preservePreviewState(null, Map.of("k", "v")));
  }

  @Test
  void preservePreviewState_requestedCarriesOwnKey_returnsRequestedUnchanged() {
    Map<String, Object> requested =
        Map.of(
            "proposedChanges", Map.of("tags", Map.of("added", List.of("X"), "removed", List.of())));
    Map<String, Object> prior =
        Map.of(
            "proposedChanges", Map.of("tags", Map.of("added", List.of("Y"), "removed", List.of())));
    Object result = ChangePreviewUtils.preservePreviewState(requested, prior);
    assertEquals(requested, result);
  }

  @Test
  void preservePreviewState_requestedMissingKey_copiesFromPrior() {
    Map<String, Object> requested = new LinkedHashMap<>();
    requested.put("feedback", "keep");
    Map<String, Object> prior = new LinkedHashMap<>();
    prior.put(
        "proposedChanges",
        Map.of("tags", Map.of("added", List.of("PII.Sensitive"), "removed", List.of())));

    Object result = ChangePreviewUtils.preservePreviewState(requested, prior);
    assertTrue(result instanceof Map<?, ?>);
    Map<?, ?> resultMap = (Map<?, ?>) result;
    assertEquals("keep", resultMap.get("feedback"));
    Map<String, FieldDiff> proposed = ChangePreviewUtils.extractProposedChanges(result);
    assertEquals(List.of("PII.Sensitive"), proposed.get("tags").added());
  }

  @Test
  void preservePreviewState_priorMissingKey_returnsRequestedUnchanged() {
    Map<String, Object> requested = Map.of("feedback", "keep");
    Map<String, Object> prior = Map.of("other", "irrelevant");
    Object result = ChangePreviewUtils.preservePreviewState(requested, prior);
    assertEquals(requested, result);
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
  void preservePreviewState_carriesTheBaseVersion() {
    Map<String, Object> requested = new LinkedHashMap<>();
    requested.put("feedback", "keep");
    Map<String, Object> prior = new LinkedHashMap<>();
    prior.put(ChangePreviewUtils.PROPOSED_CHANGES_BASE_VERSION_KEY, 0.3);

    Object result = ChangePreviewUtils.preservePreviewState(requested, prior);

    assertEquals(OptionalDouble.of(0.3), ChangePreviewUtils.cycleBaseOf(result));
    assertEquals("keep", ((Map<?, ?>) result).get("feedback"));
  }

  @Test
  void buildProposedChangesPayload_revisionWithoutChanges_returnsInput() {
    EntityInterface<?> entity = new GlossaryTerm().withName("t");
    Map<String, Object> existing = Map.of("k", "v");
    assertEquals(
        existing,
        ChangePreviewUtils.buildProposedChangesPayload(entity, existing, new ChangeDescription()));
  }

  // A change request's revision is cumulative, so it replaces the preview of the revision before.
  @Test
  void buildProposedChangesPayload_revisionReplacesTheCarriedPreview() {
    Map<String, Object> carried = new LinkedHashMap<>();
    carried.put(
        "proposedChanges",
        Map.of("tags", Map.of("added", List.of("PII.Sensitive"), "removed", List.of())));

    Object result =
        ChangePreviewUtils.buildProposedChangesPayload(
            new GlossaryTerm().withName("t"), carried, tagsAdded("PersonalData.Personal"));

    assertEquals(
        Map.of("tags", new FieldDiff(List.of("PersonalData.Personal"), List.of())),
        ChangePreviewUtils.extractProposedChanges(result));
  }

  @Test
  void buildProposedChangesPayload_changeRequestStatusEdit_isKept() {
    EntityInterface<?> entity = new GlossaryTerm().withName("t");
    ChangeDescription pending = new ChangeDescription().withFieldsUpdated(List.of(statusChange()));

    Object result = ChangePreviewUtils.buildProposedChangesPayload(entity, null, pending);
    Map<String, FieldDiff> proposed = ChangePreviewUtils.extractProposedChanges(result);

    assertEquals(List.of("In Review"), proposed.get("entityStatus").added());
    assertEquals(List.of("Draft"), proposed.get("entityStatus").removed());
  }

  // ---------------------------------------------------------------------------
  // foldChanges: the net change of an approval cycle
  // ---------------------------------------------------------------------------

  // The metric report: the edit is one version and the workflow's move to In Review the next.
  @Test
  void foldChanges_statusWriteInItsOwnVersion_keepsTheDescription() {
    Map<String, FieldDiff> folded =
        ChangePreviewUtils.foldChanges(
            TERM, List.of(descriptionEdit("old", "new"), updated(statusChange())));

    assertEquals(Map.of("description", new FieldDiff(List.of("new"), List.of("old"))), folded);
  }

  // Before status writes were stored on their own, the workflow's move joined the user's version.
  @Test
  void foldChanges_consolidatedEditAndStatus_keepsTheEdit() {
    ChangeDescription consolidated =
        updated(statusChange(), descriptionChange("old", "new"))
            .withFieldsAdded(tagsAdded("PII.Sensitive").getFieldsAdded());

    Map<String, FieldDiff> folded = ChangePreviewUtils.foldChanges(TERM, List.of(consolidated));

    assertEquals(
        Map.of(
            "description",
            new FieldDiff(List.of("new"), List.of("old")),
            "tags",
            new FieldDiff(List.of("PII.Sensitive"), List.of())),
        folded);
  }

  @Test
  void foldChanges_descriptionEditedTwice_showsApprovedToLatest() {
    Map<String, FieldDiff> folded =
        ChangePreviewUtils.foldChanges(
            TERM,
            List.of(
                descriptionEdit("approved", "first"),
                updated(statusChange()),
                descriptionEdit("first", "second")));

    assertEquals(
        Map.of("description", new FieldDiff(List.of("second"), List.of("approved"))), folded);
  }

  @Test
  void foldChanges_editTakenBack_removesTheKey() {
    ChangeDescription removed =
        new ChangeDescription()
            .withFieldsDeleted(
                List.of(
                    new FieldChange()
                        .withName("tags")
                        .withOldValue("[{\"tagFQN\":\"PII.Sensitive\"}]")));

    Map<String, FieldDiff> folded =
        ChangePreviewUtils.foldChanges(TERM, List.of(tagsAdded("PII.Sensitive"), removed));

    assertTrue(folded.isEmpty());
  }

  @Test
  void foldChanges_tagsOwnersSynonymsRelatedTermsAndExtensionProperty() {
    ChangeDescription first =
        new ChangeDescription()
            .withFieldsAdded(
                List.of(
                    added("tags", "[{\"tagFQN\":\"PII.Sensitive\"}]"),
                    added("owners", "[{\"displayName\":\"Jane Doe\",\"name\":\"jane\"}]"),
                    added("synonyms", "[\"Alias\"]"),
                    added("relatedTerms", "[{\"fullyQualifiedName\":\"g.related\"}]"),
                    added("extension.steward", "\"Data team\"")));
    ChangeDescription second =
        new ChangeDescription()
            .withFieldsAdded(List.of(added("synonyms", "[\"Other\"]")))
            .withFieldsDeleted(
                List.of(
                    new FieldChange()
                        .withName("owners")
                        .withOldValue("[{\"displayName\":\"Jane Doe\",\"name\":\"jane\"}]")));

    Map<String, FieldDiff> folded = ChangePreviewUtils.foldChanges(TERM, List.of(first, second));

    assertEquals(
        Map.of(
            "tags", new FieldDiff(List.of("PII.Sensitive"), List.of()),
            "synonyms", new FieldDiff(List.of("Alias", "Other"), List.of()),
            "relatedTerms", new FieldDiff(List.of("g.related"), List.of()),
            "extension.steward", new FieldDiff(List.of("Data team"), List.of())),
        folded);
  }

  // ---------------------------------------------------------------------------
  // withCyclePreview
  // ---------------------------------------------------------------------------

  // The issue's first symptom: a preview carried from the open task is replaced, never merged.
  @Test
  void withCyclePreview_replacesAStaleCarriedPreview() {
    Map<String, Object> carried = new LinkedHashMap<>();
    carried.put("feedback", "keep me");
    carried.put(
        "proposedChanges",
        Map.of("entityStatus", Map.of("added", List.of("In Review"), "removed", List.of())));

    Object result =
        ChangePreviewUtils.withCyclePreview(
            TERM, carried, cycle(0.3, descriptionEdit("old", "new")));

    assertEquals("keep me", ((Map<?, ?>) result).get("feedback"));
    assertEquals(
        Map.of("description", new FieldDiff(List.of("new"), List.of("old"))),
        ChangePreviewUtils.extractProposedChanges(result));
  }

  @Test
  void withCyclePreview_writesTheBaseVersion() {
    Object result =
        ChangePreviewUtils.withCyclePreview(TERM, null, cycle(0.3, descriptionEdit("old", "new")));

    assertEquals(OptionalDouble.of(0.3), ChangePreviewUtils.cycleBaseOf(result));
  }

  // A new term's only change in its cycle is the workflow's move to In Review.
  @Test
  void withCyclePreview_statusOnlyCycle_keepsTheBaseAndNoPreview() {
    Map<String, Object> carried = new LinkedHashMap<>();
    carried.put(
        "proposedChanges",
        Map.of("tags", Map.of("added", List.of("PII.Sensitive"), "removed", List.of())));

    Object result =
        ChangePreviewUtils.withCyclePreview(TERM, carried, cycle(0.0, updated(statusChange())));

    assertFalse(((Map<?, ?>) result).containsKey("proposedChanges"));
    assertEquals(OptionalDouble.of(0.0), ChangePreviewUtils.cycleBaseOf(result));
  }

  @ParameterizedTest
  @MethodSource("historyReadFailures")
  void withCyclePreview_aFailedReadKeepsTheCarriedPreviewAndMarksItIncomplete(
      RuntimeException failure) {
    Map<String, Object> carried =
        Map.of(
            "feedback",
            "keep me",
            ChangePreviewUtils.PROPOSED_CHANGES_BASE_VERSION_KEY,
            0.3,
            ChangePreviewUtils.PROPOSED_CHANGES_KEY,
            Map.of(
                "description",
                Map.of("added", List.of("Prior edit"), "removed", List.of("Original"))));

    Object result =
        ChangePreviewUtils.withCyclePreview(
            TERM,
            carried,
            () -> {
              throw failure;
            });

    Map<String, Object> expected = new LinkedHashMap<>(carried);
    expected.put(ChangePreviewUtils.PROPOSED_CHANGES_INCOMPLETE_KEY, true);
    assertEquals(expected, result);
  }

  static Stream<RuntimeException> historyReadFailures() {
    return Stream.of(
        EntityNotFoundException.byId("glossaryTerm"),
        new IllegalArgumentException("Entity class does not declare getEntityStatus"),
        new ConnectionException(new SQLException("connection refused")));
  }

  // Part of the cycle could not be read, so the card must not pass the partial list off as whole.
  @Test
  void withCyclePreview_anIncompleteCycleIsMarked() {
    Object result =
        ChangePreviewUtils.withCyclePreview(
            TERM, null, () -> new CyclePreview(0.3, List.of(descriptionEdit("old", "new")), false));

    assertEquals(
        Map.of("description", new FieldDiff(List.of("new"), List.of("old"))),
        ChangePreviewUtils.extractProposedChanges(result));
    assertEquals(
        Boolean.TRUE, ((Map<?, ?>) result).get(ChangePreviewUtils.PROPOSED_CHANGES_INCOMPLETE_KEY));
  }

  @Test
  void withCyclePreview_aCompleteCycleClearsAnEarlierMark() {
    Map<String, Object> carried = new LinkedHashMap<>();
    carried.put(ChangePreviewUtils.PROPOSED_CHANGES_INCOMPLETE_KEY, true);

    Object result =
        ChangePreviewUtils.withCyclePreview(TERM, carried, cycle(0.3, descriptionEdit("o", "n")));

    assertFalse(
        ((Map<?, ?>) result).containsKey(ChangePreviewUtils.PROPOSED_CHANGES_INCOMPLETE_KEY));
  }

  @Test
  void preservePreviewState_carriesTheIncompleteMark() {
    Map<String, Object> prior = new LinkedHashMap<>();
    prior.put(ChangePreviewUtils.PROPOSED_CHANGES_INCOMPLETE_KEY, true);

    Object result = ChangePreviewUtils.preservePreviewState(Map.of("k", "v"), prior);

    assertEquals(
        Boolean.TRUE, ((Map<?, ?>) result).get(ChangePreviewUtils.PROPOSED_CHANGES_INCOMPLETE_KEY));
  }

  @Test
  void cycleBaseOf_aPayloadWithoutABaseHasNone() {
    assertEquals(OptionalDouble.empty(), ChangePreviewUtils.cycleBaseOf(null));
    assertEquals(OptionalDouble.empty(), ChangePreviewUtils.cycleBaseOf(Map.of("k", "v")));
  }

  private static Supplier<CyclePreview> cycle(double base, ChangeDescription... changes) {
    return () -> new CyclePreview(base, List.of(changes), true);
  }

  private static ChangeDescription tagsAdded(String tagFqn) {
    return new ChangeDescription()
        .withFieldsAdded(
            List.of(
                new FieldChange()
                    .withName("tags")
                    .withNewValue("[{\"tagFQN\":\"%s\"}]".formatted(tagFqn))));
  }

  private static ChangeDescription descriptionEdit(String oldValue, String newValue) {
    return updated(descriptionChange(oldValue, newValue));
  }

  private static FieldChange descriptionChange(String oldValue, String newValue) {
    return new FieldChange().withName("description").withOldValue(oldValue).withNewValue(newValue);
  }

  private static ChangeDescription updated(FieldChange... changes) {
    return new ChangeDescription().withFieldsUpdated(new ArrayList<>(List.of(changes)));
  }

  private static FieldChange added(String field, String newValue) {
    return new FieldChange().withName(field).withNewValue(newValue);
  }

  private static FieldChange statusChange() {
    return new FieldChange()
        .withName("entityStatus")
        .withOldValue("Draft")
        .withNewValue("In Review");
  }
}
