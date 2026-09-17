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
package org.openmetadata.service.search.projection;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.indexes.TaggableIndex;

/**
 * The {@code tags} → {@code tier} / {@code classificationTags} / {@code glossaryTags} rule, declared
 * once.
 *
 * <p>{@link #applyJava} routes through {@link ParseTags}, the same class the rebuild path uses, so the
 * Java rendering cannot drift from the rebuild by construction. {@link #painlessPostlude} returns the
 * existing {@code TAG_RESEPARATION_SCRIPT} verbatim rather than a copy — a second copy of a script
 * whose whole problem is being copied would be an odd way to fix it.
 */
public final class TagDocInvariant implements DocInvariant {

  public static final TagDocInvariant INSTANCE = new TagDocInvariant();

  private static final Set<String> DEPENDS_ON = Set.of("tags");
  private static final Set<String> PRODUCES =
      Set.of("tags", "tier", "classificationTags", "glossaryTags");

  /**
   * The painless rendering of this invariant, and its canonical home.
   *
   * <p>It lives here rather than on {@code SearchClient} so that {@link PainlessComposer} can compose
   * {@code SearchClient}'s own script constants. While the text lived there, composing them meant
   * {@code SearchClient} initialising against itself — the constant would be read back through this
   * class before its own initialiser had run. {@code SearchClient.TAG_RESEPARATION_SCRIPT} now
   * delegates here, so the dependency runs one way only.
   *
   * <p>Note the conditional {@code tier} assignment. Live indexing lifts Tier out of {@code tags[]}
   * into the dedicated {@code tier} field, so a document touched by a tag-mutating script almost never
   * carries Tier in {@code tags[]}; assigning {@code tier = null} whenever no Tier was seen would wipe
   * the live-indexed value. That was found by {@code GlossaryRenameCascade.spec.ts} after the fact,
   * which is the whole argument for this rule having one home.
   */
  public static final String PAINLESS_POSTLUDE =
      """
      def newTags = new ArrayList();
      def tier = null;
      def classTags = new ArrayList();
      def glossTags = new ArrayList();
      if (ctx._source.containsKey('tags') && ctx._source.tags != null) {
        for (def t : ctx._source.tags) {
          if (t == null || !t.containsKey('tagFQN') || t.tagFQN == null) { continue; }
          if (t.tagFQN.startsWith('Tier.')) {
            tier = t;
          } else {
            newTags.add(t);
          }
          if (t.containsKey('source')) {
            if (t.source == 'Classification') { classTags.add(t.tagFQN); }
            else if (t.source == 'Glossary') { glossTags.add(t.tagFQN); }
          }
        }
        ctx._source.tags = newTags;
        if (tier != null) {
          ctx._source.tier = tier;
        }
        ctx._source.classificationTags = classTags;
        ctx._source.glossaryTags = glossTags;
      }
      """;

  private TagDocInvariant() {}

  @Override
  public Set<String> dependsOn() {
    return DEPENDS_ON;
  }

  @Override
  public Set<String> produces() {
    return PRODUCES;
  }

  @Override
  @SuppressWarnings("unchecked")
  public void applyJava(Map<String, Object> doc) {
    Object rawTags = doc.get("tags");
    if (!(rawTags instanceof List<?> tagList)) {
      return;
    }
    // The document carries tags as maps once it has been serialised, so round-trip them back into
    // TagLabels rather than re-deriving the separation here — ParseTags stays the only
    // implementation.
    List<TagLabel> labels = new ArrayList<>(tagList.size());
    for (Object element : tagList) {
      if (element instanceof TagLabel label) {
        labels.add(label);
      } else if (element instanceof Map<?, ?> map) {
        labels.add(JsonUtils.convertValue(map, TagLabel.class));
      }
    }
    ParseTags parsed = new ParseTags(labels);
    // Strip appliedAt through TaggableIndex's helper, not a copy of it: the value is
    // database-assigned
    // so a live write cannot reproduce it, and the two paths must drop it identically.
    doc.put("tags", TaggableIndex.withoutAppliedAt(parsed.getTags()));
    doc.put("tier", TaggableIndex.withoutAppliedAt(parsed.getTierTag()));
    doc.put("classificationTags", parsed.getClassificationTags());
    doc.put("glossaryTags", parsed.getGlossaryTags());
  }

  @Override
  public String painlessPostlude() {
    return PAINLESS_POSTLUDE;
  }
}
