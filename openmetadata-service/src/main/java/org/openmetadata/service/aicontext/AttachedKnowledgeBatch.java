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
package org.openmetadata.service.aicontext;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Batch lookup of the knowledge attached to a set of assets: glossary terms from asset and column
 * tags, metrics via {@code metric --APPLIED_TO--> asset}, and articles via {@code asset --HAS-->
 * page}. Deliberately cheap — no profile, no lineage, no budgeting, no vector excerpts — so a
 * search layer can annotate every candidate in a result page with its linked knowledge in one
 * round-trip. Relationship reads are batched across all assets ({@code findToBatch} /
 * {@code findFromBatch}); knowledge entities are bulk-loaded once and shared. Each item is
 * returned only if the caller's per-item check accepts it: viewing an asset does not imply access
 * to every term, metric or article attached to it.
 */
@Slf4j
public final class AttachedKnowledgeBatch {
  public static final int MAX_ASSETS = 50;
  static final int MAX_ITEMS_PER_ASSET = 10;
  static final int MAX_CONTENT_CHARS = 500;
  private static final String TABLE_FIELDS = "tags,columns";
  private static final String DEFAULT_FIELDS = "tags";

  private AttachedKnowledgeBatch() {}

  public record AssetKey(String fullyQualifiedName, String entityType) {}

  public record AssetKnowledge(
      String fullyQualifiedName, String entityType, List<KnowledgeItem> items) {}

  private record Lookups(
      Map<String, List<UUID>> pageIdsByAsset,
      Map<String, List<UUID>> metricIdsByAsset,
      Map<UUID, Page> pages,
      Map<UUID, Metric> metrics,
      Map<String, KnowledgeItem> glossaryTerms) {}

  /**
   * Resolves attached knowledge for each asset. Unknown or unloadable assets are skipped, and so
   * are items {@code canView} rejects.
   */
  public static List<AssetKnowledge> resolve(
      List<AssetKey> assets, Predicate<KnowledgeItem> canView) {
    Map<AssetKey, EntityInterface<?>> loaded = loadAssets(assets);
    Lookups lookups = lookupKnowledge(loaded);
    List<AssetKnowledge> result = new ArrayList<>();
    for (Map.Entry<AssetKey, EntityInterface<?>> entry : loaded.entrySet()) {
      result.add(
          new AssetKnowledge(
              entry.getKey().fullyQualifiedName(),
              entry.getKey().entityType(),
              itemsFor(entry.getValue(), lookups, canView)));
    }
    return result;
  }

  // Keyed by the full AssetKey (type + FQN): FQNs are only unique per entity type — a chart and
  // a dashboard under the same service can share an FQN, and a name-only key would drop one.
  private static Map<AssetKey, EntityInterface<?>> loadAssets(List<AssetKey> assets) {
    Map<AssetKey, EntityInterface<?>> loaded = new LinkedHashMap<>();
    for (AssetKey key : assets.stream().limit(MAX_ASSETS).toList()) {
      if (!nullOrEmpty(key.fullyQualifiedName()) && !nullOrEmpty(key.entityType())) {
        loadAsset(key, loaded);
      }
    }
    return loaded;
  }

  private static void loadAsset(AssetKey key, Map<AssetKey, EntityInterface<?>> into) {
    try {
      String fields = Entity.TABLE.equals(key.entityType()) ? TABLE_FIELDS : DEFAULT_FIELDS;
      into.putIfAbsent(
          key,
          Entity.getEntityByName(
              key.entityType(), key.fullyQualifiedName(), fields, Include.NON_DELETED));
    } catch (EntityNotFoundException | IllegalArgumentException e) {
      LOG.debug("Skipping unresolvable asset {}: {}", key.fullyQualifiedName(), e.getMessage());
    }
  }

  private static Lookups lookupKnowledge(Map<AssetKey, EntityInterface<?>> loaded) {
    List<String> assetIds =
        loaded.values().stream().map(entity -> entity.getId().toString()).toList();
    Map<String, List<UUID>> pageIdsByAsset = Map.of();
    Map<String, List<UUID>> metricIdsByAsset = Map.of();
    if (!assetIds.isEmpty()) {
      CollectionDAO.EntityRelationshipDAO relationships =
          Entity.getCollectionDAO().relationshipDAO();
      pageIdsByAsset =
          PersonaContextBuilder.groupRelatedIds(
              relationships.findToBatch(assetIds, Relationship.HAS.ordinal(), Entity.PAGE), true);
      metricIdsByAsset =
          PersonaContextBuilder.groupRelatedIds(
              relationships.findFromBatch(
                  assetIds, Relationship.APPLIED_TO.ordinal(), Entity.METRIC),
              false);
    }
    return new Lookups(
        pageIdsByAsset,
        metricIdsByAsset,
        PersonaContextBuilder.entitiesById(Entity.PAGE, flattenIds(pageIdsByAsset), Page.class),
        PersonaContextBuilder.entitiesById(
            Entity.METRIC, flattenIds(metricIdsByAsset), Metric.class),
        loadGlossaryTerms(loaded));
  }

  static List<UUID> flattenIds(Map<String, List<UUID>> idsByAsset) {
    return idsByAsset.values().stream().flatMap(List::stream).distinct().toList();
  }

  /** Null values are cached too, so a missing/unapproved term is looked up once per batch. */
  private static Map<String, KnowledgeItem> loadGlossaryTerms(
      Map<AssetKey, EntityInterface<?>> loaded) {
    Map<String, KnowledgeItem> terms = new LinkedHashMap<>();
    for (EntityInterface<?> entity : loaded.values()) {
      for (String fqn : AIContextBuilder.collectGlossaryFqns(entity)) {
        if (!terms.containsKey(fqn)) {
          terms.put(fqn, PersonaContextBuilder.loadGlossaryTerm(fqn));
        }
      }
    }
    return terms;
  }

  private static List<KnowledgeItem> itemsFor(
      EntityInterface<?> asset, Lookups lookups, Predicate<KnowledgeItem> canView) {
    List<KnowledgeItem> items = new ArrayList<>();
    for (String fqn : AIContextBuilder.collectGlossaryFqns(asset)) {
      addItem(items, lookups.glossaryTerms().get(fqn), canView);
    }
    String assetId = asset.getId().toString();
    for (UUID id : lookups.metricIdsByAsset().getOrDefault(assetId, List.of())) {
      addItem(items, knowledgeItemOf(Entity.METRIC, lookups.metrics().get(id)), canView);
    }
    for (UUID id : lookups.pageIdsByAsset().getOrDefault(assetId, List.of())) {
      addItem(items, knowledgeItemOf(Entity.PAGE, lookups.pages().get(id)), canView);
    }
    return items;
  }

  /** An item {@code canView} rejects does not take one of the per-asset slots. */
  static void addItem(
      List<KnowledgeItem> items, KnowledgeItem item, Predicate<KnowledgeItem> canView) {
    if (item != null && items.size() < MAX_ITEMS_PER_ASSET && canView.test(item)) {
      items.add(truncated(item));
    }
  }

  private static KnowledgeItem knowledgeItemOf(String entityType, EntityInterface<?> entity) {
    return entity == null ? null : PersonaContextBuilder.fullKnowledgeItem(entityType, entity);
  }

  static KnowledgeItem truncated(KnowledgeItem item) {
    KnowledgeItem result = item;
    String content = item.getContent();
    if (content != null && content.length() > MAX_CONTENT_CHARS) {
      result =
          new KnowledgeItem()
              .withId(item.getId())
              .withType(item.getType())
              .withName(item.getName())
              .withDisplayName(item.getDisplayName())
              .withFullyQualifiedName(item.getFullyQualifiedName())
              .withContent(content.substring(0, MAX_CONTENT_CHARS) + "…")
              .withContentTruncated(true);
    }
    return result;
  }
}
