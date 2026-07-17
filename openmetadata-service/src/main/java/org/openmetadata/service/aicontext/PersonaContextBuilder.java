/*
 *  Copyright 2026 Collate
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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.ServiceUnavailableException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PersonaContext;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.aicontext.AssetContext;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.schema.type.aicontext.TableContext;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.type.personaContext.ContextSection;
import org.openmetadata.schema.type.personaContext.SharedKnowledge;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.util.FullyQualifiedName;

/** Materializes the dynamic entity-selection rules attached to a Persona into one AI context. */
@Slf4j
public class PersonaContextBuilder {
  static final int MAX_SHARED_KNOWLEDGE_ITEMS = 500;
  private static final int SEARCH_BATCH_SIZE = 100;
  private static final int DATA_PRODUCT_ASSET_BATCH_SIZE = 1000;
  private static final int DEFAULT_MAX_ASSETS = 200;
  private static final Set<String> KNOWLEDGE_ENTITY_TYPES =
      Set.of(Entity.GLOSSARY_TERM, Entity.PAGE, Entity.METRIC);
  private static final Set<String> ASSET_ENTITY_TYPES =
      Set.of(
          Entity.TABLE,
          Entity.TOPIC,
          Entity.CHART,
          Entity.DASHBOARD,
          Entity.DASHBOARD_DATA_MODEL,
          Entity.PIPELINE,
          Entity.MLMODEL,
          Entity.CONTAINER,
          Entity.DATABASE,
          Entity.DATABASE_SCHEMA,
          Entity.STORED_PROCEDURE,
          Entity.SEARCH_INDEX,
          Entity.API_COLLECTION,
          Entity.API_ENDPOINT,
          Entity.DATA_PRODUCT);
  private static final Set<ContextSection> ASSET_CONTEXT_SECTIONS =
      EnumSet.of(
          ContextSection.DESCRIPTION,
          ContextSection.SCHEMA,
          ContextSection.CONSTRAINTS,
          ContextSection.JOINS,
          ContextSection.TAGS,
          ContextSection.GLOSSARY_TERMS,
          ContextSection.ARTICLES,
          ContextSection.METRICS,
          ContextSection.LINEAGE,
          ContextSection.PROFILE,
          ContextSection.DATA_QUALITY);
  private static final Set<ContextSection> DEFAULT_ASSET_CONTEXT_SECTIONS =
      EnumSet.of(
          ContextSection.DESCRIPTION,
          ContextSection.SCHEMA,
          ContextSection.CONSTRAINTS,
          ContextSection.JOINS,
          ContextSection.TAGS,
          ContextSection.GLOSSARY_TERMS,
          ContextSection.ARTICLES,
          ContextSection.METRICS);
  private static final Set<String> KEYWORD_SORT_ENTITY_TYPES = Set.of("testCase", "user", "team");
  private static final String[] SEARCH_FIELDS = {
    "id",
    "name",
    "displayName",
    "fullyQualifiedName",
    "description",
    "entityType",
    "entityStatus",
    "href",
    "owners",
    "serviceType",
    "tags",
    "tier",
    "classificationTags",
    "glossaryTags",
    "aiContext"
  };

  private final Persona persona;
  private final SearchRepository searchRepository;

  public PersonaContextBuilder(Persona persona) {
    this(persona, Entity.getSearchRepository());
  }

  PersonaContextBuilder(Persona persona, SearchRepository searchRepository) {
    this.persona = persona;
    this.searchRepository = searchRepository;
  }

  public MaterializedPersonaContext build() {
    PersonaContextDefinition definition = definitionOf(persona);
    List<RuleMaterialization> materializedRules = selectRules(definition);
    loadProfiles(materializedRules);
    SharedKnowledgeAccumulator knowledge = enrichAssetKnowledge(materializedRules);
    SharedKnowledge sharedKnowledge = knowledge.toSharedKnowledge();
    PersonaContext context =
        new PersonaContext()
            .withPersona(persona.getEntityReference())
            .withGeneratedAt(System.currentTimeMillis())
            .withSharedKnowledge(sharedKnowledge);
    return PersonaContextMarkdown.render(
        persona, definition, materializedRules, context, knowledge.overflowed());
  }

  static PersonaContextDefinition definitionOf(Persona persona) {
    return persona.getContextDefinition() == null
        ? new PersonaContextDefinition()
        : persona.getContextDefinition();
  }

  static int characterBudget(PersonaContextDefinition definition) {
    return definition.getCharacterBudget() == null ? 400_000 : definition.getCharacterBudget();
  }

  static int cacheTtlSeconds(PersonaContextDefinition definition) {
    return (definition.getCacheTtlMinutes() == null ? 30 : definition.getCacheTtlMinutes()) * 60;
  }

  List<RuleMaterialization> selectRules(PersonaContextDefinition definition) {
    List<RuleMaterialization> results = new ArrayList<>();
    if (!Boolean.TRUE.equals(definition.getEnabled())) {
      return results;
    }
    Set<String> seenEntities = new HashSet<>();
    List<ContextRule> orderedRules = new ArrayList<>(listOrEmpty(definition.getRules()));
    orderedRules.sort(
        Comparator.comparing(rule -> !Boolean.TRUE.equals(rule.getAlwaysInContext())));
    for (ContextRule rule : orderedRules) {
      if (!Boolean.TRUE.equals(rule.getEnabled())) {
        continue;
      }
      RuleSearchResult matches = search(rule);
      List<SelectedEntity> selected = new ArrayList<>();
      int maxAssets = rule.getMaxAssets() == null ? DEFAULT_MAX_ASSETS : rule.getMaxAssets();
      for (Map<String, Object> document : matches.documents()) {
        if (selected.size() >= maxAssets) {
          break;
        }
        String fqn = stringValue(document.get("fullyQualifiedName"));
        if (nullOrEmpty(fqn) || !seenEntities.add(rule.getEntityType() + ':' + fqn)) {
          continue;
        }
        SelectedEntity entity =
            isKnowledgeEntityType(rule.getEntityType())
                ? buildKnowledgeSelection(rule, document)
                : buildAssetSelection(rule, document);
        if (entity != null) {
          selected.add(entity);
          if (Entity.DATA_PRODUCT.equals(rule.getEntityType())
              && Boolean.TRUE.equals(rule.getFullyRendered())) {
            int remaining = maxAssets - selected.size();
            for (SelectedEntity member : expandDataProductAssets(entity, remaining)) {
              String memberFqn = member.context().getFullyQualifiedName();
              String memberType = member.context().getEntityType();
              if (!nullOrEmpty(memberFqn)
                  && !nullOrEmpty(memberType)
                  && seenEntities.add(memberType + ':' + memberFqn)) {
                selected.add(member);
              }
            }
          }
        }
      }
      results.add(new RuleMaterialization(rule, matches.matched(), selected));
    }
    return results;
  }

  RuleSearchResult search(ContextRule rule) {
    if (searchRepository == null) {
      throw new IllegalStateException("Search is unavailable while materializing persona context");
    }
    int maxAssets = rule.getMaxAssets() == null ? DEFAULT_MAX_ASSETS : rule.getMaxAssets();
    List<Map<String, Object>> documents = new ArrayList<>(maxAssets);
    Object[] searchAfter = null;
    int matched = 0;
    String sortField =
        KEYWORD_SORT_ENTITY_TYPES.contains(rule.getEntityType())
            ? "fullyQualifiedName.keyword"
            : "fullyQualifiedName";
    SearchSortFilter sort = new SearchSortFilter(sortField, "asc", null, null);
    String queryFilter = activeEntityFilter(rule.getQueryFilter());
    try {
      while (documents.size() < maxAssets) {
        int pageSize = Math.min(SEARCH_BATCH_SIZE, maxAssets - documents.size());
        SearchResultListMapper page =
            searchRepository.listWithDeepPagination(
                rule.getEntityType(),
                null,
                queryFilter,
                SEARCH_FIELDS,
                sort,
                pageSize,
                searchAfter);
        if (documents.isEmpty()) {
          matched = page.getTotal() > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) page.getTotal();
        }
        if (page.getResults() == null || page.getResults().isEmpty()) {
          break;
        }
        documents.addAll(page.getResults());
        searchAfter = page.getLastHitSortValues();
        if (searchAfter == null || page.getResults().size() < pageSize) {
          break;
        }
      }
    } catch (IOException | RuntimeException exception) {
      ServiceUnavailableException unavailable =
          new ServiceUnavailableException(
              "Failed to evaluate persona context rule '"
                  + rule.getName()
                  + "': "
                  + exception.getMessage());
      unavailable.initCause(exception);
      throw unavailable;
    }
    return new RuleSearchResult(matched, documents);
  }

  static String activeEntityFilter(String queryFilter) {
    JsonNode requestedFilter = null;
    if (!nullOrEmpty(queryFilter)) {
      JsonNode parsedFilter = JsonUtils.readTree(queryFilter);
      if (parsedFilter == null || !parsedFilter.isObject()) {
        throw new IllegalArgumentException("Persona context queryFilter must be a JSON object");
      }
      requestedFilter = parsedFilter.has("query") ? parsedFilter.get("query") : parsedFilter;
    }
    List<Object> filters = new ArrayList<>();
    filters.add(Map.of("term", Map.of("deleted", false)));
    if (requestedFilter != null && !requestedFilter.isEmpty()) {
      filters.add(requestedFilter);
    }
    return JsonUtils.pojoToJson(Map.of("query", Map.of("bool", Map.of("filter", filters))));
  }

  public static RulePreview preview(ContextRule rule) {
    if (!supportsEntityType(rule.getEntityType())) {
      throw new IllegalArgumentException(
          "Unsupported persona context entity type: " + rule.getEntityType());
    }
    RuleSearchResult result = new PersonaContextBuilder(null).search(rule);
    List<String> samples =
        result.documents().stream()
            .map(PersonaContextBuilder::displayNameOf)
            .filter(value -> !nullOrEmpty(value))
            .limit(5)
            .toList();
    return new RulePreview(result.matched(), samples);
  }

  public static boolean supportsEntityType(String entityType) {
    return ASSET_ENTITY_TYPES.contains(entityType) || KNOWLEDGE_ENTITY_TYPES.contains(entityType);
  }

  private SelectedEntity buildAssetSelection(ContextRule rule, Map<String, Object> document) {
    return buildAssetSelection(rule, document, true);
  }

  private SelectedEntity buildAssetSelection(
      ContextRule rule, Map<String, Object> document, boolean loadHeavySections) {
    String fqn = stringValue(document.get("fullyQualifiedName"));
    String id = stringValue(document.get("id"));
    AIContext context =
        new AIContext()
            .withId(nullOrEmpty(id) ? null : UUID.fromString(id))
            .withFullyQualifiedName(fqn)
            .withEntityType(rule.getEntityType())
            .withDisplayName(stringValue(document.get("displayName")))
            .withDescription(stringValue(document.get("description")))
            .withServiceType(stringValue(document.get("serviceType")))
            .withTags(classificationTags(document))
            .withOwners(ownerReferences(document))
            .withAssetContext(assetContext(document))
            .withGeneratedAt(System.currentTimeMillis());
    String href = stringValue(document.get("href"));
    if (!nullOrEmpty(href)) {
      try {
        context.withResource(URI.create(href));
      } catch (IllegalArgumentException ignored) {
        LOG.debug("Ignoring invalid indexed href for {}: {}", fqn, href);
      }
    }
    if (loadHeavySections && !Entity.DATA_PRODUCT.equals(rule.getEntityType())) {
      loadHeavySections(context, selectedSections(rule));
    }
    return new SelectedEntity(id, document, context, null, null);
  }

  protected List<SelectedEntity> expandDataProductAssets(
      SelectedEntity dataProduct, int maxAssets) {
    List<SelectedEntity> members = new ArrayList<>();
    if (nullOrEmpty(dataProduct.id()) || maxAssets <= 0) {
      return members;
    }
    UUID dataProductId;
    try {
      dataProductId = UUID.fromString(dataProduct.id());
    } catch (IllegalArgumentException exception) {
      LOG.warn(
          "Ignoring invalid data product id for {}: {}",
          dataProduct.context().getFullyQualifiedName(),
          exception.getMessage());
      return members;
    }
    DataProductRepository repository =
        (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
    int limit = Math.min(maxAssets, DATA_PRODUCT_ASSET_BATCH_SIZE);
    ResultList<EntityReference> page = repository.getDataProductAssets(dataProductId, limit, 0);
    Map<String, List<String>> fqnsByType = new LinkedHashMap<>();
    for (EntityReference asset : listOrEmpty(page.getData())) {
      if (asset != null
          && supportsEntityType(asset.getType())
          && !isKnowledgeEntityType(asset.getType())
          && !nullOrEmpty(asset.getFullyQualifiedName())) {
        fqnsByType
            .computeIfAbsent(asset.getType(), ignored -> new ArrayList<>())
            .add(asset.getFullyQualifiedName());
      }
    }

    for (Map.Entry<String, List<String>> entry : fqnsByType.entrySet()) {
      if (members.size() >= limit) {
        break;
      }
      List<String> fqns = entry.getValue();
      ContextRule memberRule =
          new ContextRule()
              .withName("Data product member")
              .withEntityType(entry.getKey())
              .withQueryFilter(
                  JsonUtils.pojoToJson(
                      Map.of("query", Map.of("terms", Map.of("fullyQualifiedName", fqns)))))
              .withMaxAssets(Math.min(fqns.size(), limit - members.size()))
              .withFullyRendered(true)
              .withSections(ASSET_CONTEXT_SECTIONS);
      for (Map<String, Object> document : search(memberRule).documents()) {
        members.add(buildAssetSelection(memberRule, document, false));
      }
    }
    return members;
  }

  static Set<ContextSection> selectedSections(ContextRule rule) {
    return Boolean.TRUE.equals(rule.getFullyRendered())
        ? ASSET_CONTEXT_SECTIONS
        : nullOrEmpty(rule.getSections()) ? DEFAULT_ASSET_CONTEXT_SECTIONS : rule.getSections();
  }

  private void loadHeavySections(AIContext context, Set<ContextSection> sections) {
    Set<ContextSection> selected = sections == null ? Set.of() : sections;
    boolean needsLineage = selected.contains(ContextSection.LINEAGE);
    boolean needsDataQuality = selected.contains(ContextSection.DATA_QUALITY);
    if (needsLineage || needsDataQuality) {
      AIContext heavy =
          new AIContextBuilder(context.getEntityType(), context.getFullyQualifiedName()).build();
      applyHeavySections(context, heavy, needsLineage, needsDataQuality);
    }
  }

  static void applyHeavySections(
      AIContext context, AIContext heavy, boolean needsLineage, boolean needsDataQuality) {
    if (needsLineage) {
      context
          .withUpstream(heavy.getUpstream())
          .withUpstreamEdges(heavy.getUpstreamEdges())
          .withDownstream(heavy.getDownstream())
          .withDownstreamEdges(heavy.getDownstreamEdges());
    }
    if (needsDataQuality && heavy.getObservability() != null) {
      context.withObservability(
          new Observability().withDataQuality(heavy.getObservability().getDataQuality()));
    }
  }

  private SelectedEntity buildKnowledgeSelection(ContextRule rule, Map<String, Object> document) {
    String entityType = rule.getEntityType();
    String fqn = stringValue(document.get("fullyQualifiedName"));
    try {
      EntityInterface entity =
          Entity.getEntityByName(entityType, fqn, knowledgeFields(entityType), Include.NON_DELETED);
      KnowledgeItem item = fullKnowledgeItem(entityType, entity);
      if (item == null) {
        return null;
      }
      AIContext context =
          new AIContext()
              .withId(entity.getId())
              .withFullyQualifiedName(entity.getFullyQualifiedName())
              .withEntityType(entityType)
              .withDisplayName(entity.getDisplayName())
              .withDescription(entity.getDescription())
              .withGeneratedAt(System.currentTimeMillis());
      attachKnowledge(context, item, true);
      return new SelectedEntity(stringValue(document.get("id")), document, context, item, entity);
    } catch (EntityNotFoundException exception) {
      LOG.warn("Failed to load persona knowledge entity {}: {}", fqn, exception.getMessage());
      return null;
    }
  }

  private static String knowledgeFields(String entityType) {
    return switch (entityType) {
      case Entity.PAGE -> "owners,tags,relatedEntities";
      case Entity.METRIC -> "owners,tags,assets,relatedMetrics";
      case Entity.GLOSSARY_TERM -> "owners,tags,relatedTerms";
      default -> "";
    };
  }

  private SharedKnowledgeAccumulator enrichAssetKnowledge(
      List<RuleMaterialization> materializedRules) {
    List<SelectedEntity> assets =
        materializedRules.stream()
            .filter(rule -> !isKnowledgeEntityType(rule.rule().getEntityType()))
            .flatMap(rule -> rule.entities().stream())
            .filter(entity -> !nullOrEmpty(entity.id()))
            .toList();
    SharedKnowledgeAccumulator accumulator = new SharedKnowledgeAccumulator();
    materializedRules.stream()
        .filter(rule -> isKnowledgeEntityType(rule.rule().getEntityType()))
        .flatMap(rule -> rule.entities().stream())
        .map(SelectedEntity::knowledgeItem)
        .forEach(accumulator::exclude);
    if (assets.isEmpty()) {
      return accumulator;
    }

    Map<SelectedEntity, ContextRule> ruleByEntity = indexRulesByEntity(materializedRules);
    Map<String, SelectedEntity> assetById = new LinkedHashMap<>();
    assets.forEach(asset -> assetById.put(asset.id(), asset));
    List<String> assetIds = new ArrayList<>(assetById.keySet());
    CollectionDAO.EntityRelationshipDAO relationships = Entity.getCollectionDAO().relationshipDAO();

    Map<String, List<UUID>> pageIdsByAsset =
        groupRelatedIds(
            relationships.findToBatch(assetIds, Relationship.HAS.ordinal(), Entity.PAGE), true);
    Map<String, List<UUID>> metricIdsByAsset =
        groupRelatedIds(
            relationships.findFromBatch(assetIds, Relationship.APPLIED_TO.ordinal(), Entity.METRIC),
            false);
    Map<UUID, Page> pages = entitiesById(Entity.PAGE, flatten(pageIdsByAsset.values()), Page.class);
    Map<UUID, Metric> metrics =
        entitiesById(Entity.METRIC, flatten(metricIdsByAsset.values()), Metric.class);
    Set<String> glossaryFqns = new LinkedHashSet<>();
    for (SelectedEntity asset : assets) {
      ContextRule rule = ruleByEntity.get(asset);
      if (selectedSections(rule).contains(ContextSection.GLOSSARY_TERMS)) {
        glossaryFqns.addAll(glossaryFqns(asset.document()));
      }
    }
    Map<String, KnowledgeItem> glossaryTerms = new HashMap<>();
    for (String glossaryFqn : glossaryFqns) {
      KnowledgeItem term = loadGlossaryTerm(glossaryFqn);
      if (term != null) {
        glossaryTerms.put(glossaryFqn, term);
      }
    }

    for (SelectedEntity asset : assets) {
      ContextRule rule = ruleByEntity.get(asset);
      Set<ContextSection> sections = selectedSections(rule);
      if (sections.contains(ContextSection.GLOSSARY_TERMS)) {
        for (String termFqn : glossaryFqns(asset.document())) {
          KnowledgeItem full = glossaryTerms.get(termFqn);
          if (full != null) {
            accumulator.add(full);
            attachKnowledge(asset.context(), referenceOf(full), false);
          }
        }
      }
      if (sections.contains(ContextSection.ARTICLES)) {
        for (UUID pageId : pageIdsByAsset.getOrDefault(asset.id(), List.of())) {
          Page page = pages.get(pageId);
          if (page != null) {
            KnowledgeItem full = fullKnowledgeItem(Entity.PAGE, page);
            accumulator.add(full);
            attachKnowledge(asset.context(), referenceOf(full), false);
          }
        }
      }
      if (sections.contains(ContextSection.METRICS)) {
        for (UUID metricId : metricIdsByAsset.getOrDefault(asset.id(), List.of())) {
          Metric metric = metrics.get(metricId);
          if (metric != null) {
            KnowledgeItem full = fullKnowledgeItem(Entity.METRIC, metric);
            accumulator.add(full);
            attachKnowledge(asset.context(), referenceOf(full), false);
          }
        }
      }
    }
    return accumulator;
  }

  private static void loadProfiles(List<RuleMaterialization> materializedRules) {
    Map<String, SelectedEntity> assetsByFqnHash = new HashMap<>();
    for (RuleMaterialization materialization : materializedRules) {
      if (!selectedSections(materialization.rule()).contains(ContextSection.PROFILE)) {
        continue;
      }
      for (SelectedEntity selected : materialization.entities()) {
        if (!Entity.TABLE.equals(selected.context().getEntityType())) {
          continue;
        }
        String fqn = selected.context().getFullyQualifiedName();
        if (!nullOrEmpty(fqn)) {
          assetsByFqnHash.put(FullyQualifiedName.buildHash(fqn), selected);
        }
      }
    }
    if (assetsByFqnHash.isEmpty()) {
      return;
    }

    List<String> fqns =
        assetsByFqnHash.values().stream()
            .map(selected -> selected.context().getFullyQualifiedName())
            .toList();
    List<CollectionDAO.ProfilerDataTimeSeriesDAO.LatestExtensionRecord> profiles;
    try {
      profiles =
          Entity.getCollectionDAO()
              .profilerDataTimeSeriesDao()
              .getLatestExtensionsBatch(fqns, TableRepository.TABLE_PROFILE_EXTENSION);
    } catch (RuntimeException exception) {
      LOG.warn("Failed to load batched persona profile summaries: {}", exception.getMessage());
      return;
    }
    for (CollectionDAO.ProfilerDataTimeSeriesDAO.LatestExtensionRecord record : profiles) {
      SelectedEntity selected = assetsByFqnHash.get(record.entityFQNHash());
      if (selected == null) {
        continue;
      }
      try {
        JsonNode profile = JsonUtils.readTree(record.json());
        JsonNode profileData = profile == null ? null : profile.get("profileData");
        if (profileData == null || !profileData.isObject()) {
          continue;
        }
        TableProfile tableProfile = JsonUtils.convertValue(profileData, TableProfile.class);
        Observability observability = selected.context().getObservability();
        if (observability == null) {
          observability = new Observability();
          selected.context().withObservability(observability);
        }
        observability
            .withRowCount(tableProfile.getRowCount())
            .withProfiledAt(tableProfile.getTimestamp());
      } catch (RuntimeException exception) {
        LOG.warn(
            "Failed to load persona profile summary for {}: {}",
            selected.context().getFullyQualifiedName(),
            exception.getMessage());
      }
    }
  }

  static Map<SelectedEntity, ContextRule> indexRulesByEntity(
      List<RuleMaterialization> materializedRules) {
    Map<SelectedEntity, ContextRule> ruleByEntity = new IdentityHashMap<>();
    for (RuleMaterialization materialization : materializedRules) {
      for (SelectedEntity entity : materialization.entities()) {
        ruleByEntity.put(entity, materialization.rule());
      }
    }
    return ruleByEntity;
  }

  static Map<String, List<UUID>> groupRelatedIds(
      List<CollectionDAO.EntityRelationshipObject> records, boolean assetIsFrom) {
    Map<String, List<UUID>> grouped = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : listOrEmpty(records)) {
      String assetId = assetIsFrom ? record.getFromId() : record.getToId();
      String knowledgeId = assetIsFrom ? record.getToId() : record.getFromId();
      try {
        grouped
            .computeIfAbsent(assetId, ignored -> new ArrayList<>())
            .add(UUID.fromString(knowledgeId));
      } catch (IllegalArgumentException exception) {
        LOG.debug("Ignoring invalid knowledge relationship id: {}", knowledgeId);
      }
    }
    return grouped;
  }

  static List<UUID> flatten(Collection<List<UUID>> values) {
    return values.stream().flatMap(Collection::stream).distinct().toList();
  }

  static <T extends EntityInterface> Map<UUID, T> entitiesById(
      String entityType, List<UUID> ids, Class<T> entityClass) {
    Map<UUID, T> entitiesById = new HashMap<>();
    if (ids.isEmpty()) {
      return entitiesById;
    }
    List<EntityReference> references =
        Entity.getEntityReferencesByIds(entityType, ids, Include.NON_DELETED);
    List<T> entities = Entity.getEntities(references, "", Include.NON_DELETED);
    for (T entity : entities) {
      if (entityClass.isInstance(entity)) {
        entitiesById.put(entity.getId(), entity);
      }
    }
    return entitiesById;
  }

  static KnowledgeItem loadGlossaryTerm(String fqn) {
    try {
      GlossaryTerm term =
          Entity.getEntityByName(Entity.GLOSSARY_TERM, fqn, "", Include.NON_DELETED);
      return fullKnowledgeItem(Entity.GLOSSARY_TERM, term);
    } catch (EntityNotFoundException exception) {
      LOG.warn("Failed to load persona glossary term {}: {}", fqn, exception.getMessage());
      return null;
    }
  }

  static KnowledgeItem fullKnowledgeItem(String entityType, EntityInterface entity) {
    if (entity instanceof GlossaryTerm term && term.getEntityStatus() != EntityStatus.APPROVED) {
      return null;
    }
    KnowledgeItem.Type type =
        switch (entityType) {
          case Entity.GLOSSARY_TERM -> KnowledgeItem.Type.GLOSSARY_TERM;
          case Entity.PAGE -> KnowledgeItem.Type.PAGE;
          case Entity.METRIC -> KnowledgeItem.Type.METRIC;
          default -> throw new IllegalArgumentException(
              "Unsupported knowledge type: " + entityType);
        };
    return new KnowledgeItem()
        .withId(entity.getId())
        .withType(type)
        .withName(entity.getName())
        .withDisplayName(entity.getDisplayName())
        .withFullyQualifiedName(entity.getFullyQualifiedName())
        .withContent(AIContextBuilder.fullContentOf(entity));
  }

  private static KnowledgeItem referenceOf(KnowledgeItem item) {
    return new KnowledgeItem()
        .withId(item.getId())
        .withType(item.getType())
        .withName(item.getName())
        .withDisplayName(item.getDisplayName())
        .withFullyQualifiedName(item.getFullyQualifiedName());
  }

  private static void attachKnowledge(AIContext context, KnowledgeItem item, boolean full) {
    if (item == null || item.getType() == null) {
      return;
    }
    KnowledgeItem attached = full ? item : referenceOf(item);
    switch (item.getType()) {
      case GLOSSARY_TERM -> {
        List<KnowledgeItem> terms = new ArrayList<>(listOrEmpty(context.getGlossaryTerms()));
        terms.add(attached);
        context.withGlossaryTerms(terms);
      }
      case METRIC -> {
        List<KnowledgeItem> metrics = new ArrayList<>(listOrEmpty(context.getMetrics()));
        metrics.add(attached);
        context.withMetrics(metrics);
      }
      case PAGE -> {
        List<KnowledgeItem> articles = new ArrayList<>(listOrEmpty(context.getArticles()));
        articles.add(attached);
        context.withArticles(articles);
      }
      case CONTEXT_MEMORY -> {
        // Per-user knowledge pills are deliberately excluded from persona-scoped shared context.
      }
    }
  }

  @SuppressWarnings("unchecked")
  static AssetContext assetContext(Map<String, Object> document) {
    Object indexedContext = document.get("aiContext");
    if (!(indexedContext instanceof Map<?, ?> aiContext)) {
      return null;
    }
    Object table = aiContext.get("table");
    if (!(table instanceof Map<?, ?>)) {
      return null;
    }
    TableContext tableContext = JsonUtils.convertValue(table, TableContext.class);
    return new AssetContext().withTable(tableContext);
  }

  private static List<String> classificationTags(Map<String, Object> document) {
    LinkedHashSet<String> tags = new LinkedHashSet<>();
    addStrings(tags, document.get("classificationTags"));
    Object tier = document.get("tier");
    if (tier instanceof Map<?, ?> tierMap) {
      String tierFqn = stringValue(tierMap.get("tagFQN"));
      if (!nullOrEmpty(tierFqn)) {
        tags.add(tierFqn);
      }
    }
    if (tags.isEmpty()) {
      for (Map<String, Object> tag : tagMaps(document.get("tags"))) {
        if (!"Glossary".equalsIgnoreCase(stringValue(tag.get("source")))) {
          String tagFqn = stringValue(tag.get("tagFQN"));
          if (!nullOrEmpty(tagFqn)) {
            tags.add(tagFqn);
          }
        }
      }
    }
    return new ArrayList<>(tags);
  }

  static List<String> glossaryFqns(Map<String, Object> document) {
    LinkedHashSet<String> terms = new LinkedHashSet<>();
    addStrings(terms, document.get("glossaryTags"));
    if (terms.isEmpty()) {
      for (Map<String, Object> tag : tagMaps(document.get("tags"))) {
        if ("Glossary".equalsIgnoreCase(stringValue(tag.get("source")))) {
          String tagFqn = stringValue(tag.get("tagFQN"));
          if (!nullOrEmpty(tagFqn)) {
            terms.add(tagFqn);
          }
        }
      }
    }
    return new ArrayList<>(terms);
  }

  private static List<EntityReference> ownerReferences(Map<String, Object> document) {
    List<EntityReference> owners = new ArrayList<>();
    for (Map<String, Object> owner : tagMaps(document.get("owners"))) {
      String name = stringValue(owner.get("name"));
      String fqn = stringValue(owner.get("fullyQualifiedName"));
      if (nullOrEmpty(name) && nullOrEmpty(fqn)) {
        continue;
      }
      EntityReference reference =
          new EntityReference()
              .withName(name)
              .withType(stringValue(owner.get("type")))
              .withFullyQualifiedName(fqn)
              .withDisplayName(stringValue(owner.get("displayName")));
      String ownerId = stringValue(owner.get("id"));
      if (!nullOrEmpty(ownerId)) {
        try {
          reference.withId(UUID.fromString(ownerId));
        } catch (IllegalArgumentException ignored) {
          // Non-UUID id in the indexed document; keep name/type, skip the id.
        }
      }
      owners.add(reference);
    }
    return owners;
  }

  private static void addStrings(Set<String> destination, Object value) {
    if (value instanceof Collection<?> values) {
      values.stream()
          .map(PersonaContextBuilder::stringValue)
          .filter(v -> !nullOrEmpty(v))
          .forEach(destination::add);
    }
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> tagMaps(Object tags) {
    if (!(tags instanceof Collection<?> collection)) {
      return List.of();
    }
    return collection.stream()
        .filter(Map.class::isInstance)
        .map(tag -> (Map<String, Object>) tag)
        .toList();
  }

  private static String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private static String displayNameOf(Map<String, Object> document) {
    String displayName = stringValue(document.get("displayName"));
    if (!nullOrEmpty(displayName)) {
      return displayName;
    }
    String name = stringValue(document.get("name"));
    return !nullOrEmpty(name) ? name : stringValue(document.get("fullyQualifiedName"));
  }

  public static boolean isKnowledgeEntityType(String entityType) {
    return KNOWLEDGE_ENTITY_TYPES.contains(entityType);
  }

  public record MaterializedPersonaContext(PersonaContext context, String markdown) {}

  record RuleSearchResult(int matched, List<Map<String, Object>> documents) {}

  record SelectedEntity(
      String id,
      Map<String, Object> document,
      AIContext context,
      KnowledgeItem knowledgeItem,
      EntityInterface knowledgeEntity) {}

  record RuleMaterialization(ContextRule rule, int matched, List<SelectedEntity> entities) {}

  public record RulePreview(int matchedCount, List<String> sampleNames) {}

  private static final class SharedKnowledgeAccumulator {
    private final Set<String> excluded = new HashSet<>();
    private final Map<String, KnowledgeItem> items = new LinkedHashMap<>();
    private boolean overflowed;

    boolean add(KnowledgeItem item) {
      if (item == null || item.getType() == null || nullOrEmpty(item.getFullyQualifiedName())) {
        return false;
      }
      String key = item.getType().value() + ':' + item.getFullyQualifiedName();
      if (excluded.contains(key) || items.containsKey(key)) {
        return true;
      }
      if (items.size() >= MAX_SHARED_KNOWLEDGE_ITEMS) {
        overflowed = true;
        return false;
      }
      items.put(key, item);
      return true;
    }

    void exclude(KnowledgeItem item) {
      if (item != null && item.getType() != null && !nullOrEmpty(item.getFullyQualifiedName())) {
        excluded.add(item.getType().value() + ':' + item.getFullyQualifiedName());
      }
    }

    boolean overflowed() {
      return overflowed;
    }

    SharedKnowledge toSharedKnowledge() {
      Comparator<KnowledgeItem> byFqn =
          Comparator.comparing(
              KnowledgeItem::getFullyQualifiedName, Comparator.nullsLast(String::compareTo));
      List<KnowledgeItem> terms = new ArrayList<>();
      List<KnowledgeItem> metrics = new ArrayList<>();
      List<KnowledgeItem> articles = new ArrayList<>();
      for (KnowledgeItem item : items.values()) {
        switch (item.getType()) {
          case GLOSSARY_TERM -> terms.add(item);
          case METRIC -> metrics.add(item);
          case PAGE -> articles.add(item);
          case CONTEXT_MEMORY -> {
            // Per-user knowledge pills are deliberately excluded.
          }
        }
      }
      terms.sort(byFqn);
      metrics.sort(byFqn);
      articles.sort(byFqn);
      return new SharedKnowledge()
          .withGlossaryTerms(terms)
          .withMetrics(metrics)
          .withArticles(articles);
    }
  }
}
