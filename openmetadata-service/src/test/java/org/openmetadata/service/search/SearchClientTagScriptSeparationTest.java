/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * Locks in the contract that every painless script which mutates {@code ctx._source.tags} also
 * ends with the {@link SearchClient#TAG_RESEPARATION_SCRIPT} re-derivation snippet. Live-indexing
 * updates use these scripts; the SearchIndexApp reindex path uses
 * {@link org.openmetadata.service.search.indexes.TaggableIndex#applyTagFields} (which calls
 * {@link ParseTags}). Both paths must produce the same separation — Tier lifted to
 * {@code tier}, classification FQNs on {@code classificationTags}, glossary FQNs on
 * {@code glossaryTags} — or queries that filter via the dedicated fields diverge between the
 * two paths.
 */
class SearchClientTagScriptSeparationTest {

  @Test
  void removeTagsChildrenScriptReseparatesAfterMutation() {
    assertEndsWithReseparation(SearchClient.REMOVE_TAGS_CHILDREN_SCRIPT, "REMOVE_TAGS_CHILDREN");
  }

  @Test
  void updateGlossaryTermTagFqnByPrefixScriptReseparatesAfterMutation() {
    assertEndsWithReseparation(
        SearchClient.UPDATE_GLOSSARY_TERM_TAG_FQN_BY_PREFIX_SCRIPT,
        "UPDATE_GLOSSARY_TERM_TAG_FQN_BY_PREFIX");
  }

  @Test
  void updateClassificationTagFqnByPrefixScriptReseparatesAfterMutation() {
    assertEndsWithReseparation(
        SearchClient.UPDATE_CLASSIFICATION_TAG_FQN_BY_PREFIX_SCRIPT,
        "UPDATE_CLASSIFICATION_TAG_FQN_BY_PREFIX");
  }

  @Test
  void updateFqnPrefixScriptReseparatesAfterMutation() {
    assertEndsWithReseparation(SearchClient.UPDATE_FQN_PREFIX_SCRIPT, "UPDATE_FQN_PREFIX");
  }

  @Test
  void updateAddedDeleteGlossaryTagsReseparatesAfterMutation() {
    assertEndsWithReseparation(
        SearchClient.UPDATE_ADDED_DELETE_GLOSSARY_TAGS, "UPDATE_ADDED_DELETE_GLOSSARY_TAGS");
  }

  @Test
  void tagReseparationScriptLiftsTierAndPopulatesDenormalizations() {
    String snippet = SearchClient.TAG_RESEPARATION_SCRIPT;
    assertTrue(
        snippet.contains("ctx._source.tier"),
        "snippet must assign ctx._source.tier (the lifted Tier TagLabel)");
    assertTrue(
        snippet.contains("ctx._source.classificationTags"),
        "snippet must assign ctx._source.classificationTags (denormalised FQN list)");
    assertTrue(
        snippet.contains("ctx._source.glossaryTags"),
        "snippet must assign ctx._source.glossaryTags (denormalised FQN list)");
    assertTrue(
        snippet.contains("startsWith('Tier.')"),
        "snippet must filter Tier.* tags out of tags[] so they don't leak into the bag");
  }

  private static void assertEndsWithReseparation(String script, String label) {
    assertTrue(
        script.contains(SearchClient.TAG_RESEPARATION_SCRIPT),
        () ->
            "Painless script "
                + label
                + " mutates tags[] but does not include TAG_RESEPARATION_SCRIPT;"
                + " live-indexing will leave tier/classificationTags/glossaryTags stale"
                + " while reindex produces the correct separation. Append"
                + " TAG_RESEPARATION_SCRIPT to the script.");
  }
}
