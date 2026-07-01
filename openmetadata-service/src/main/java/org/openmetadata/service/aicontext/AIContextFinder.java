/*
 *  Copyright 2024 Collate
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
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

/**
 * Mode B of the AI Context Platform: given a natural-language question and no chosen asset, run a
 * semantic search over the company-knowledge layer (glossary terms, metrics, Context Center
 * articles) and route each hit back to the candidate data assets it points to — glossary terms to
 * the assets tagged with them, metrics to the assets they are applied to, and articles to the
 * assets they are about. The agent gets both the business definitions and a set of candidate asset
 * FQNs to hand to {@code get_asset_context} (Mode A). Knowledge pills are intentionally excluded
 * here (they carry per-user visibility rules and are surfaced through the PBAC-checked Mode-A path).
 */
@Slf4j
public class AIContextFinder {
  private static final List<String> CONTEXT_ENTITY_TYPES =
      List.of(Entity.GLOSSARY_TERM, Entity.METRIC, Entity.PAGE);
  private static final Map<String, List<String>> CONTEXT_FILTER =
      Map.of("entityType", CONTEXT_ENTITY_TYPES);
  private static final int SEARCH_K = 100;
  private static final int MAX_ASSETS_PER_ITEM = 10;
  private static final int MAX_CONTENT_CHARS = 2000;

  public record CandidateAsset(String fullyQualifiedName, String entityType, String via) {}

  public record FoundContext(List<KnowledgeItem> items, List<CandidateAsset> candidateAssets) {
    public boolean isEmpty() {
      return items.isEmpty();
    }
  }

  public FoundContext find(String query, int size) {
    List<KnowledgeItem> items = new ArrayList<>();
    Map<String, CandidateAsset> candidates = new LinkedHashMap<>();
    VectorSearchResponse response = searchKnowledge(query, size);
    if (response != null && response.getHits() != null) {
      for (Map<String, Object> hit : response.getHits()) {
        collectHit(hit, items, candidates);
      }
    }
    return new FoundContext(items, new ArrayList<>(candidates.values()));
  }

  private void collectHit(
      Map<String, Object> hit, List<KnowledgeItem> items, Map<String, CandidateAsset> candidates) {
    KnowledgeItem item = toKnowledgeItem(hit);
    if (item != null) {
      items.add(item);
      for (CandidateAsset asset : routeToAssets(hit, item)) {
        candidates.putIfAbsent(asset.fullyQualifiedName(), asset);
      }
    }
  }

  private VectorSearchResponse searchKnowledge(String query, int size) {
    VectorSearchResponse response = null;
    if (Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      OpenSearchVectorService service = OpenSearchVectorService.getInstance();
      if (service != null) {
        try {
          response = service.search(query, CONTEXT_FILTER, size, 0, SEARCH_K, 0.0);
        } catch (Exception e) {
          LOG.warn("AIContext find: vector search failed: {}", e.getMessage());
        }
      }
    }
    return response;
  }

  static KnowledgeItem toKnowledgeItem(Map<String, Object> hit) {
    KnowledgeItem item = null;
    String fqn = asString(hit.get("fullyQualifiedName"));
    KnowledgeItem.Type kind = knowledgeType(asString(hit.get("entityType")));
    if (!nullOrEmpty(fqn) && kind != null) {
      item =
          new KnowledgeItem()
              .withType(kind)
              .withName(asString(hit.get("name")))
              .withDisplayName(asString(hit.get("displayName")))
              .withFullyQualifiedName(fqn)
              .withContent(content(hit));
    }
    return item;
  }

  static KnowledgeItem.Type knowledgeType(String entityType) {
    KnowledgeItem.Type type = null;
    try {
      if (!nullOrEmpty(entityType)) {
        type = KnowledgeItem.Type.fromValue(entityType);
      }
    } catch (IllegalArgumentException e) {
      LOG.debug("AIContext find: unmapped knowledge entityType {}", entityType);
    }
    return type;
  }

  static String content(Map<String, Object> hit) {
    String content = asString(hit.get("textToLLMContext"));
    if (nullOrEmpty(content)) {
      content = asString(hit.get("description"));
    }
    return content == null || content.length() <= MAX_CONTENT_CHARS
        ? content
        : content.substring(0, MAX_CONTENT_CHARS) + "…";
  }

  private List<CandidateAsset> routeToAssets(Map<String, Object> hit, KnowledgeItem item) {
    List<CandidateAsset> assets = new ArrayList<>();
    UUID id = parseId(hit.get("id"));
    String via = item.getFullyQualifiedName();
    switch (item.getType()) {
      case GLOSSARY_TERM -> addRefs(assets, searchAssetsByTag(via), via);
      case METRIC -> addRefs(
          assets, findRelated(id, Entity.METRIC, Relationship.APPLIED_TO, true), via);
      case PAGE -> addRefs(assets, findRelated(id, Entity.PAGE, Relationship.HAS, false), via);
      default -> LOG.debug("AIContext find: no routing for type {}", item.getType());
    }
    return assets;
  }

  private static void addRefs(List<CandidateAsset> assets, List<EntityReference> refs, String via) {
    for (EntityReference ref : refs) {
      if (assets.size() < MAX_ASSETS_PER_ITEM) {
        assets.add(new CandidateAsset(ref.getFullyQualifiedName(), ref.getType(), via));
      }
    }
  }

  private static List<EntityReference> findRelated(
      UUID id, String entityType, Relationship relationship, boolean toSide) {
    List<EntityReference> refs = new ArrayList<>();
    if (id != null) {
      try {
        refs =
            toSide
                ? Entity.getEntityRepository(entityType).findTo(id, entityType, relationship, null)
                : Entity.getEntityRepository(entityType)
                    .findFrom(id, entityType, relationship, null);
      } catch (Exception e) {
        LOG.warn("AIContext find: relationship lookup failed for {}: {}", id, e.getMessage());
      }
    }
    return refs;
  }

  private List<EntityReference> searchAssetsByTag(String tagFqn) {
    List<EntityReference> refs = new ArrayList<>();
    try {
      SearchRequest request =
          new SearchRequest()
              .withQuery(
                  String.format(
                      "** AND (tags.tagFQN:\"%s\")", ReindexingUtil.escapeDoubleQuotes(tagFqn)))
              .withSize(MAX_ASSETS_PER_ITEM)
              .withIndex(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
              .withFrom(0)
              .withFetchSource(true)
              .withTrackTotalHits(false)
              .withSortFieldParam("_score")
              .withDeleted(false)
              .withSortOrder("desc")
              .withIncludeSourceFields(new ArrayList<>());
      Response response = Entity.getSearchRepository().search(request, null);
      parseTagHits((String) response.getEntity(), refs);
    } catch (Exception e) {
      LOG.warn("AIContext find: tag search failed for {}: {}", tagFqn, e.getMessage());
    }
    return refs;
  }

  private static void parseTagHits(String json, List<EntityReference> refs) {
    ArrayNode hits = (ArrayNode) JsonUtils.extractValue(json, "hits", "hits");
    if (hits != null) {
      for (JsonNode hit : hits) {
        JsonNode source = hit.path("_source");
        String fqn = source.path("fullyQualifiedName").asText(null);
        String type = source.path("entityType").asText(null);
        if (fqn != null && type != null) {
          refs.add(new EntityReference().withFullyQualifiedName(fqn).withType(type));
        }
      }
    }
  }

  private static UUID parseId(Object value) {
    UUID id = null;
    if (value != null) {
      try {
        id = UUID.fromString(value.toString());
      } catch (IllegalArgumentException e) {
        LOG.debug("AIContext find: hit missing valid id: {}", value);
      }
    }
    return id;
  }

  private static String asString(Object value) {
    return value == null ? null : value.toString();
  }
}
