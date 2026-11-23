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

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.FieldChange;

/**
 * Unit tests for {@link FieldChangeValueExtractor}: rules match the new value of a field change,
 * and only a removed value (no new value) falls back to the old one.
 */
class FieldChangeValueExtractorTest {

  // ---------------------------------------------------------------------------
  // extractFieldValueForMatching — new-value is the primary source
  // ---------------------------------------------------------------------------

  @Test
  void extractFieldValueForMatching_plainStringNewValue_returnsThatString() {
    FieldChange fc = new FieldChange().withName("description").withNewValue("hello world");
    assertEquals("hello world", FieldChangeValueExtractor.extractFieldValueForMatching(fc));
  }

  @Test
  void extractFieldValueForMatching_nonJsonStringStartingWithBrace_returnsRawString() {
    // Malformed JSON that starts with '{' is not valid JSON, so the extractor returns it as-is
    // (it must NOT fall back to the old value just because the string begins with a brace).
    FieldChange fc =
        new FieldChange().withName("description").withNewValue("{not json").withOldValue("old");
    assertEquals("{not json", FieldChangeValueExtractor.extractFieldValueForMatching(fc));
  }

  @Test
  void extractFieldValueForMatching_populatedRefNewValue_returnsFqnFromNewValue() {
    String personaId = UUID.randomUUID().toString();
    String newValue =
        "{\"id\":\"%s\",\"type\":\"persona\",\"fullyQualifiedName\":\"Engineering\"}"
            .formatted(personaId);
    FieldChange fc = new FieldChange().withName("defaultPersona").withNewValue(newValue);
    assertEquals("Engineering", FieldChangeValueExtractor.extractFieldValueForMatching(fc));
  }

  @Test
  void extractFieldValueForMatching_tagFqnNewValue_returnsTagFqn() {
    FieldChange fc =
        new FieldChange().withName("tags").withNewValue("{\"tagFQN\":\"PII.Sensitive\"}");
    assertEquals("PII.Sensitive", FieldChangeValueExtractor.extractFieldValueForMatching(fc));
  }

  @Test
  void extractFieldValueForMatching_populatedListNewValue_returnsAllFqns() {
    String newValue = "[{\"fullyQualifiedName\":\"a.b\"},{\"fullyQualifiedName\":\"c.d\"}]";
    FieldChange fc = new FieldChange().withName("reviewers").withNewValue(newValue);
    assertEquals("a.b,c.d", FieldChangeValueExtractor.extractFieldValueForMatching(fc));
  }

  // ---------------------------------------------------------------------------
  // extractFieldValueForMatching — old-value fallback when newValue is null
  // (fieldsDeleted) — existing behavior, regression guard
  // ---------------------------------------------------------------------------

  @Test
  void extractFieldValueForMatching_nullNewValuePopulatedOldValue_returnsOldFqn() {
    String oldValue =
        "{\"id\":\"%s\",\"type\":\"persona\",\"fullyQualifiedName\":\"QA\"}"
            .formatted(UUID.randomUUID());
    FieldChange fc = new FieldChange().withName("defaultPersona").withOldValue(oldValue);
    assertEquals("QA", FieldChangeValueExtractor.extractFieldValueForMatching(fc));
  }

  @Test
  void extractFieldValueForMatching_bothNull_returnsNull() {
    FieldChange fc = new FieldChange().withName("description");
    assertNull(FieldChangeValueExtractor.extractFieldValueForMatching(fc));
  }

  // ---------------------------------------------------------------------------
  // extractFieldValueForMatching — sparse new value: no matchable identifier
  // ---------------------------------------------------------------------------

  @Test
  void extractFieldValueForMatching_bothSparse_returnsNull() {
    // If both sides are sparse (e.g. an earlier change recorded a sparse reference and a later
    // change sees it as the old value), the extractor cannot recover an FQN from either side.
    String personaId = UUID.randomUUID().toString();
    String sparse =
        "{\"id\":\"%s\",\"type\":\"persona\",\"name\":\"Engineering\"}".formatted(personaId);
    FieldChange fc =
        new FieldChange().withName("defaultPersona").withNewValue(sparse).withOldValue(sparse);
    assertNull(FieldChangeValueExtractor.extractFieldValueForMatching(fc));
  }

  // ---------------------------------------------------------------------------
  // extractFieldValueForMatching — mixed lists: populated entries win, sparse
  // entries are dropped; the new value is still used when it has any FQN
  // ---------------------------------------------------------------------------

  @Test
  void extractFieldValueForMatching_mixedListNewValue_returnsOnlyPopulatedFqns() {
    String userId = UUID.randomUUID().toString();
    String newValue =
        "[{\"id\":\"%s\",\"type\":\"user\",\"name\":\"john\"},{\"fullyQualifiedName\":\"jane\"}]"
            .formatted(userId);
    FieldChange fc = new FieldChange().withName("reviewers").withNewValue(newValue);
    assertEquals("jane", FieldChangeValueExtractor.extractFieldValueForMatching(fc));
  }

  @Test
  void extractFieldValueForMatching_populatedNewValueTakesPrecedenceOverOldValue() {
    // When the new value yields a matchable FQN, the old value is never consulted. This pins the
    // semantic that rules match the *new* value when one is extractable.
    String newValue =
        "{\"id\":\"%s\",\"type\":\"persona\",\"fullyQualifiedName\":\"DataScience\"}"
            .formatted(UUID.randomUUID());
    String oldValue =
        "{\"id\":\"%s\",\"type\":\"persona\",\"fullyQualifiedName\":\"Engineering\"}"
            .formatted(UUID.randomUUID());
    FieldChange fc =
        new FieldChange().withName("defaultPersona").withNewValue(newValue).withOldValue(oldValue);
    assertEquals("DataScience", FieldChangeValueExtractor.extractFieldValueForMatching(fc));
  }

  // ---------------------------------------------------------------------------
  // extractFqnFromValue — direct value-level extraction
  // ---------------------------------------------------------------------------

  @Test
  void extractFqnFromValue_null_returnsNull() {
    assertNull(FieldChangeValueExtractor.extractFqnFromValue(null));
  }

  @Test
  void extractFqnFromValue_plainString_returnsAsIs() {
    assertEquals("Draft", FieldChangeValueExtractor.extractFqnFromValue("Draft"));
  }

  @Test
  void extractFqnFromValue_jsonObjectString_returnsFullyQualifiedName() {
    assertEquals(
        "Marketing.Glossary1",
        FieldChangeValueExtractor.extractFqnFromValue(
            "{\"fullyQualifiedName\":\"Marketing.Glossary1\"}"));
  }

  @Test
  void extractFqnFromValue_jsonObjectString_returnsTagFqn() {
    assertEquals(
        "PII.Sensitive",
        FieldChangeValueExtractor.extractFqnFromValue("{\"tagFQN\":\"PII.Sensitive\"}"));
  }

  @Test
  void extractFqnFromValue_sparseRefString_returnsNull() {
    String sparse = "{\"id\":\"%s\",\"type\":\"persona\"}".formatted(UUID.randomUUID());
    assertNull(FieldChangeValueExtractor.extractFqnFromValue(sparse));
  }

  @Test
  void extractFqnFromValue_populatedMap_returnsFullyQualifiedName() {
    Map<String, Object> ref =
        Map.of("fullyQualifiedName", "Marketing.Glossary1", "displayName", "Glossary 1");
    assertEquals("Marketing.Glossary1", FieldChangeValueExtractor.extractFqnFromValue(ref));
  }

  @Test
  void extractFqnFromValue_sparseMap_returnsNull() {
    String personaId = UUID.randomUUID().toString();
    Map<String, Object> ref = Map.of("id", personaId, "type", "persona", "name", "Engineering");
    assertNull(FieldChangeValueExtractor.extractFqnFromValue(ref));
  }

  @Test
  void extractFqnFromValue_tagFqnMap_returnsTagFqn() {
    Map<String, Object> tag = Map.of("tagFQN", "PII.Sensitive", "name", "Sensitive");
    assertEquals("PII.Sensitive", FieldChangeValueExtractor.extractFqnFromValue(tag));
  }

  @Test
  void extractFqnFromValue_emptyList_returnsNull() {
    assertNull(FieldChangeValueExtractor.extractFqnFromValue(List.of()));
  }

  @Test
  void extractFqnFromValue_populatedListOfMaps_returnsAllFqns() {
    List<Map<String, Object>> refs =
        List.of(Map.of("fullyQualifiedName", "a.b"), Map.of("fullyQualifiedName", "c.d"));
    assertEquals("a.b,c.d", FieldChangeValueExtractor.extractFqnFromValue(refs));
  }

  @Test
  void extractFqnFromValue_listOfTagFqnMaps_returnsAllTagFqns() {
    List<Map<String, Object>> tags =
        List.of(Map.of("tagFQN", "PII.Sensitive"), Map.of("tagFQN", "PersonalData.Personal"));
    assertEquals(
        "PII.Sensitive,PersonalData.Personal", FieldChangeValueExtractor.extractFqnFromValue(tags));
  }

  @Test
  void extractFqnFromValue_sparseListOfMaps_returnsNull() {
    String userId = UUID.randomUUID().toString();
    List<Map<String, Object>> refs = List.of(Map.of("id", userId, "type", "user"));
    assertNull(FieldChangeValueExtractor.extractFqnFromValue(refs));
  }

  @Test
  void extractFqnFromValue_mixedListOfMaps_returnsOnlyPopulatedFqns() {
    String userId = UUID.randomUUID().toString();
    List<Map<String, Object>> refs =
        List.of(Map.of("id", userId, "type", "user"), Map.of("fullyQualifiedName", "jane"));
    assertEquals("jane", FieldChangeValueExtractor.extractFqnFromValue(refs));
  }

  @Test
  void extractFqnFromValue_listOfPlainStrings_returnsAll() {
    assertEquals("one,two", FieldChangeValueExtractor.extractFqnFromValue(List.of("one", "two")));
  }

  @Test
  void extractFqnFromValue_invalidJsonString_returnsStringAsIs() {
    assertEquals("{not json", FieldChangeValueExtractor.extractFqnFromValue("{not json"));
  }

  @Test
  void extractFqnFromValue_jsonArrayOfStrings_returnsAll() {
    assertEquals("one,two", FieldChangeValueExtractor.extractFqnFromValue("[\"one\",\"two\"]"));
  }

  @Test
  void extractFqnFromValue_jsonArrayOfTagFqnObjects_returnsAllTagFqns() {
    assertEquals(
        "PII.Sensitive,PersonalData.Personal",
        FieldChangeValueExtractor.extractFqnFromValue(
            "[{\"tagFQN\":\"PII.Sensitive\"},{\"tagFQN\":\"PersonalData.Personal\"}]"));
  }
}
