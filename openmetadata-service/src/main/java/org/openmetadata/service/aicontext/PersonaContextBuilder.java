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
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
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
    if (definition.getMaxTotalChars() != null
        && definition.getMaxTotalChars() != 150_000
        && (definition.getCharacterBudget() == null
            || definition.getCharacterBudget() == 150_000)) {
      return definition.getMaxTotalChars();
    }
    if (definition.getCharacterBudget() != null) {
      return definition.getCharacterBudget();
    }
    return definition.getMaxTotalChars() == null ? 150_000 : definition.getMaxTotalChars();
  }

  static int cacheTtlSeconds(PersonaContextDefinition definition) {
    if (definition.getCacheTtlSeconds() != null
        && definition.getCacheTtlSeconds() != 1800
        && (definition.getCacheTtlMinutes() == null || definition.getCacheTtlMinutes() == 30)) {
      return definition.getCacheTtlSeconds();
    }
    if (definition.getCacheTtlMinutes() != null) {
      return definition.getCacheTtlMinutes() * 60;
    }
    return definition.getCacheTtlSeconds() == null ? 1800 : definition.getCacheTtlSeconds();
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
      for (Map<String, Object> document : matches.documents()) {
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
            for (SelectedEntity member : expandDataProductAssets(entity)) {
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
    int maxAssets = rule.getMaxAssets() == null ? 50 : rule.getMaxAssets();
    List<Map<String, Object>> documents = new ArrayList<>(maxAssets);
    Object[] searchAfter = null;
    int matched = 0;
    String sortField =
        KEYWORD_SORT_ENTITY_TYPES.contains(rule.getEntityType())
            ? "fullyQualifiedName.keyword"
            : "fullyQualifiedName";
    SearchSortFilter sort = new SearchSortFilter(sortField, "asc", null, null);
    try {
      while (documents.size() < maxAssets) {
        int pageSize = Math.min(SEARCH_BATCH_SIZE, maxAssets - documents.size());
        SearchResultListMapper page =
            searchRepository.listWithDeepPagination(
                rule.getEntityType(),
                null,
                nullOrEmpty(rule.getQueryFilter()) ? null : rule.getQueryFilter(),
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
      throw new IllegalArgumentException(
          "Failed to evaluate persona context rule '"
              + rule.getName()
              + "': "
              + exception.getMessage(),
          exception);
    }
    return new RuleSearchResult(matched, documents);
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
    String fqn = stringValue(document.get("fullyQualifiedName"));
    String id = stringValue(document.get("id"));
    AIContext context =
        new AIContext()
            .withFullyQualifiedName(fqn)
            .withEntityType(rule.getEntityType())
            .withDisplayName(stringValue(document.get("displayName")))
            .withDescription(stringValue(document.get("description")))
            .withTags(classificationTags(document))
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
    loadHeavySections(context, selectedSections(rule));
    return new SelectedEntity(id, document, context, null, null);
  }

  protected List<SelectedEntity> expandDataProductAssets(SelectedEntity dataProduct) {
    List<SelectedEntity> members = new ArrayList<>();
    if (nullOrEmpty(dataProduct.id())) {
      return members;
    }
    try {
      DataProductRepository repository =
          (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
      UUID dataProductId = UUID.fromString(dataProduct.id());
      int offset = 0;
      while (true) {
        ResultList<EntityReference> page =
            repository.getDataProductAssets(dataProductId, DATA_PRODUCT_ASSET_BATCH_SIZE, offset);
        List<EntityReference> assets = listOrEmpty(page.getData());
        if (assets.isEmpty()) {
          break;
        }
        for (EntityReference asset : assets) {
          SelectedEntity member = buildDataProductAssetSelection(asset);
          if (member != null) {
            members.add(member);
          }
        }
        offset += assets.size();
        if (assets.size() < DATA_PRODUCT_ASSET_BATCH_SIZE) {
          break;
        }
      }
    } catch (Exception exception) {
      LOG.warn(
          "Failed to expand assets for data product {}: {}",
          dataProduct.context().getFullyQualifiedName(),
          exception.getMessage());
    }
    return members;
  }

  private SelectedEntity buildDataProductAssetSelection(EntityReference asset) {
    if (asset == null
        || nullOrEmpty(asset.getType())
        || nullOrEmpty(asset.getFullyQualifiedName())) {
      return null;
    }
    try {
      AIContext context =
          new AIContextBuilder(asset.getType(), asset.getFullyQualifiedName()).build();
      Map<String, Object> document = new LinkedHashMap<>();
      if (asset.getId() != null) {
        document.put("id", asset.getId().toString());
      }
      document.put("fullyQualifiedName", asset.getFullyQualifiedName());
      return new SelectedEntity(
          asset.getId() == null ? null : asset.getId().toString(), document, context, null, null);
    } catch (Exception exception) {
      LOG.warn(
          "Failed to materialize data product asset {}: {}",
          asset.getFullyQualifiedName(),
          exception.getMessage());
      return null;
    }
  }

  static Set<ContextSection> selectedSections(ContextRule rule) {
    return Boolean.TRUE.equals(rule.getFullyRendered())
        ? ASSET_CONTEXT_SECTIONS
        : rule.getSections() == null ? Set.of() : rule.getSections();
  }

  private void loadHeavySections(AIContext context, Set<ContextSection> sections) {
    Set<ContextSection> selected = sections == null ? Set.of() : sections;
    boolean needsLineage = selected.contains(ContextSection.LINEAGE);
    boolean needsDataQuality = selected.contains(ContextSection.DATA_QUALITY);
    if (!needsLineage && !needsDataQuality) {
      return;
    }
    try {
      AIContext heavy =
          new AIContextBuilder(context.getEntityType(), context.getFullyQualifiedName()).build();
      if (needsLineage) {
        context.withUpstream(heavy.getUpstream()).withDownstream(heavy.getDownstream());
      }
      if (needsDataQuality && heavy.getObservability() != null) {
        context.withObservability(
            new Observability().withDataQuality(heavy.getObservability().getDataQuality()));
      }
    } catch (Exception exception) {
      LOG.warn(
          "Failed to load heavy persona context sections for {}: {}",
          context.getFullyQualifiedName(),
          exception.getMessage());
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
              .withFullyQualifiedName(entity.getFullyQualifiedName())
              .withEntityType(entityType)
              .withDisplayName(entity.getDisplayName())
              .withDescription(entity.getDescription())
              .withGeneratedAt(System.currentTimeMillis());
      attachKnowledge(context, item, Boolean.TRUE.equals(rule.getFullyRendered()));
      return new SelectedEntity(stringValue(document.get("id")), document, context, item, entity);
    } catch (Exception exception) {
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

    for (SelectedEntity asset : assets) {
      ContextRule rule = findRule(materializedRules, asset);
      Set<ContextSection> sections = selectedSections(rule);
      if (sections.contains(ContextSection.GLOSSARY_TERMS)) {
        for (String termFqn : glossaryFqns(asset.document())) {
          KnowledgeItem full = loadGlossaryTerm(termFqn);
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

  private static ContextRule findRule(
      List<RuleMaterialization> rules, SelectedEntity selectedEntity) {
    return rules.stream()
        .filter(rule -> rule.entities().contains(selectedEntity))
        .findFirst()
        .orElseThrow()
        .rule();
  }

  private static Map<String, List<UUID>> groupRelatedIds(
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

  private static List<UUID> flatten(Collection<List<UUID>> values) {
    return values.stream().flatMap(Collection::stream).distinct().toList();
  }

  private static <T extends EntityInterface> Map<UUID, T> entitiesById(
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

  private static KnowledgeItem loadGlossaryTerm(String fqn) {
    try {
      GlossaryTerm term =
          Entity.getEntityByName(Entity.GLOSSARY_TERM, fqn, "", Include.NON_DELETED);
      return fullKnowledgeItem(Entity.GLOSSARY_TERM, term);
    } catch (Exception exception) {
      LOG.warn("Failed to load persona glossary term {}: {}", fqn, exception.getMessage());
      return null;
    }
  }

  private static KnowledgeItem fullKnowledgeItem(String entityType, EntityInterface entity) {
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
        .withType(type)
        .withName(entity.getName())
        .withDisplayName(entity.getDisplayName())
        .withFullyQualifiedName(entity.getFullyQualifiedName())
        .withContent(AIContextBuilder.fullContentOf(entity));
  }

  private static KnowledgeItem referenceOf(KnowledgeItem item) {
    return new KnowledgeItem()
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

  static boolean isKnowledgeEntityType(String entityType) {
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
