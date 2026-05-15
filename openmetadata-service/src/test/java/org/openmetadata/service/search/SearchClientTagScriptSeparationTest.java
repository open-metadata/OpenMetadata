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
  void tagReseparationScriptSkipsDocsWithoutTagsField() {
    // UPDATE_FQN_PREFIX_SCRIPT is invoked against GLOBAL_SEARCH_ALIAS, which includes
    // tag_search_index. Tag docs have no `tags` field; if the four reseparation writes
    // run unconditionally they pollute the doc with empty tags / null tier /
    // empty classificationTags / empty glossaryTags. Guard the writes inside the
    // containsKey('tags') block.
    String snippet = SearchClient.TAG_RESEPARATION_SCRIPT;
    int guardIndex = snippet.indexOf("if (ctx._source.containsKey('tags')");
    assertTrue(guardIndex >= 0, "snippet must guard on ctx._source.containsKey('tags')");
    String beforeGuard = snippet.substring(0, guardIndex);
    for (String forbidden :
        new String[] {
          "ctx._source.tags =",
          "ctx._source.tier =",
          "ctx._source.classificationTags =",
          "ctx._source.glossaryTags ="
        }) {
      assertTrue(
          !beforeGuard.contains(forbidden),
          () ->
              "Reseparation write '"
                  + forbidden
                  + "' must live inside the containsKey('tags') guard so docs without a"
                  + " tags field (e.g., tag_search_index) are not polluted.");
    }
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

  @Test
  void tagReseparationScriptOnlyOverwritesTierWhenFoundInTagsBag() {
    // TaggableIndex.applyTagFields strips Tier out of tags[] into the dedicated tier field at
    // index time, so a doc touched by any tag-mutating painless almost never carries Tier
    // inside tags[]. If the snippet unconditionally executed `ctx._source.tier = tier` after a
    // loop that didn't see any Tier.* entry, `tier` is null and the assignment wipes the
    // live-indexed dedicated field — caught by GlossaryRenameCascade.spec.ts. The guard
    // `if (tier != null)` around the assignment keeps the existing tier untouched in that
    // case while still allowing the snippet to lift Tier back out of tags[] when a legacy /
    // polluted doc has one stuck in there.
    String snippet = SearchClient.TAG_RESEPARATION_SCRIPT;
    int tierAssignIndex = snippet.indexOf("ctx._source.tier =");
    assertTrue(
        tierAssignIndex >= 0,
        "snippet must contain a `ctx._source.tier = ...` assignment to lift legacy Tier"
            + " entries; if you removed it intentionally update this test.");
    String upToAssignment = snippet.substring(0, tierAssignIndex);
    int lastNullCheck = upToAssignment.lastIndexOf("if (tier != null)");
    assertTrue(
        lastNullCheck >= 0,
        "Reseparation write `ctx._source.tier = tier` must be guarded by `if (tier != null)`"
            + " so docs whose Tier already lives on the dedicated field (the normal post-Phase 4a"
            + " shape) are not wiped to null when no Tier.* is present in tags[].");
  }

  private static void assertEndsWithReseparation(String script, String label) {
    // Suffix match — the snippet must be the LAST thing the script does so subsequent
    // mutations can't re-break the separation. `contains` would let a future patch append
    // additional tag-mutation logic after the reseparation and silently re-introduce drift.
    String trimmedScript = script.trim();
    String trimmedSnippet = SearchClient.TAG_RESEPARATION_SCRIPT.trim();
    assertTrue(
        trimmedScript.endsWith(trimmedSnippet),
        () ->
            "Painless script "
                + label
                + " must END WITH TAG_RESEPARATION_SCRIPT so no later mutation can re-introduce"
                + " separation drift. Append TAG_RESEPARATION_SCRIPT at the very end of the"
                + " script string.");
  }
}
