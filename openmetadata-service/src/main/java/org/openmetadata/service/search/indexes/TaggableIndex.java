package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

/**
 * Mixin interface for search indexes of entities that have tags. Centralizes the tag parsing logic
 * (tags, tier, classificationTags, glossaryTags) that was previously duplicated across 15+ index
 * classes.
 *
 * <p>For entities whose children also carry tags (e.g., Table columns, Topic schema fields),
 * call {@link #mergeChildTags(Map, Set)} from {@code buildSearchIndexDocInternal} to merge
 * child tag sets with entity-level tags.
 *
 * <p>This method is called automatically by {@link SearchIndex#buildSearchIndexDoc()}. Individual
 * index classes should NOT call it directly.
 */
public interface TaggableIndex extends SearchIndex {

  /**
   * Applies tag-related fields to the search index document. Called automatically by {@link
   * SearchIndex#buildSearchIndexDoc()} and shared by both the live-indexing path
   * ({@link org.openmetadata.service.search.SearchRepository#updateEntityIndex}) and the
   * SearchIndexApp reindex path ({@code BulkSink.addEntity}) — both converge on this method.
   *
   * <p>The doc has a deliberate separation: {@code tags[]} carries only classification and
   * glossary tags; {@code tier} is the lifted Tier TagLabel; {@code certification} (set by
   * {@code populateCommonFields}) is the structured {@code AssetCertification} object. Consumers
   * filter through dedicated fields — UI queries should use {@code tier.tagFQN},
   * {@code certification.tagLabel.tagFQN}, {@code classificationTags}, {@code glossaryTags} —
   * rather than treating {@code tags[]} as an all-encompassing bag. Child tags (columns, schema
   * fields) are merged later via {@link #mergeChildTags(Map, Set)} from within
   * {@code buildSearchIndexDocInternal}, so child structure flattening only happens once.
   */
  default void applyTagFields(Map<String, Object> doc) {
    Object entity = getEntity();
    if (!(entity instanceof EntityInterface ei)) {
      return;
    }
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(getEntityTypeName(), ei));
    doc.put("tags", withoutAppliedAt(parseTags.getTags()));
    doc.put("tier", withoutAppliedAt(parseTags.getTierTag()));
    doc.put("classificationTags", parseTags.getClassificationTags());
    doc.put("glossaryTags", parseTags.getGlossaryTags());
  }

  /**
   * Drops {@code appliedAt} from a label destined for the search document.
   *
   * <p>The column is assigned by the database — the {@code tag_usage} insert does not supply it —
   * so a live write, whose labels come from the request payload, structurally cannot know the
   * value while a reindex, whose labels are read back from {@code tag_usage}, always has it. Since
   * {@code tier} and {@code tags} are replaced wholesale on every write, the two paths were
   * overwriting each other's shape on every reindex and every subsequent tag edit.
   *
   * <p>Dropping it rather than reproducing it is safe because nothing consumes it: {@code appliedAt}
   * appears in no index mapping and in no query or sort. The authoritative value remains in
   * {@code tag_usage}.
   */
  private static TagLabel withoutAppliedAt(TagLabel label) {
    if (label == null || label.getAppliedAt() == null) {
      return label;
    }
    // Copy first — the label belongs to the entity, which is still in use by the caller.
    return JsonUtils.deepCopy(label, TagLabel.class).withAppliedAt(null);
  }

  private static List<TagLabel> withoutAppliedAt(List<TagLabel> labels) {
    if (labels == null || labels.stream().noneMatch(label -> label.getAppliedAt() != null)) {
      return labels;
    }
    return labels.stream().map(TaggableIndex::withoutAppliedAt).toList();
  }

  /**
   * Merges child element tags (columns, schema fields) into the existing "tags" field. Call this
   * from {@code buildSearchIndexDocInternal} after flattening child structures, so the flattening
   * only happens once per index build.
   */
  @SuppressWarnings("unchecked")
  default void mergeChildTags(Map<String, Object> doc, Set<List<TagLabel>> childTagSets) {
    if (childTagSets == null || childTagSets.isEmpty()) {
      return;
    }
    List<TagLabel> entityTags = (List<TagLabel>) doc.getOrDefault("tags", List.of());
    // Entity-level tags first for deterministic ordering, then child tags
    LinkedHashMap<String, TagLabel> deduped = new LinkedHashMap<>();
    entityTags.forEach(tag -> deduped.putIfAbsent(tag.getTagFQN(), tag));
    childTagSets.stream()
        .flatMap(List::stream)
        .forEach(tag -> deduped.putIfAbsent(tag.getTagFQN(), tag));
    doc.put("tags", new ArrayList<>(deduped.values()));
  }
}
