/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidGlossaryTermMove;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusiveForParentAndSubField;
import static org.openmetadata.service.resources.tags.TagLabelUtil.getUniqueTags;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchConstants.TAGS_FQN;
import static org.openmetadata.service.util.EntityUtil.compareEntityReferenceById;
import static org.openmetadata.service.util.EntityUtil.compareTagLabel;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.getId;
import static org.openmetadata.service.util.EntityUtil.isNullOrEmptyChangeDescription;
import static org.openmetadata.service.util.EntityUtil.stringMatch;
import static org.openmetadata.service.util.EntityUtil.tagLabelMatch;
import static org.openmetadata.service.util.EntityUtil.termReferenceMatch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.ValidateGlossaryTagsRequest;
import org.openmetadata.schema.api.data.MoveGlossaryTermRequest;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.glossary.GlossaryTermResource;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.DefaultInheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldQuery;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldResult;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RequestEntityCache;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

@Slf4j
public class GlossaryTermRepository extends EntityRepository<GlossaryTerm> {
  private static final String ES_MISSING_DATA =
      "Entity Details is unavailable in Elastic Search. Please reindex to get more Information.";
  private static final String UPDATE_FIELDS = "references,relatedTerms,synonyms,style";
  private static final String PATCH_FIELDS = "references,relatedTerms,synonyms,style";

  final FeedRepository feedRepository = Entity.getFeedRepository();
  private InheritedFieldEntitySearch inheritedFieldEntitySearch;

  public GlossaryTermRepository() {
    super(
        GlossaryTermResource.COLLECTION_PATH,
        GLOSSARY_TERM,
        GlossaryTerm.class,
        Entity.getCollectionDAO().glossaryTermDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
    renameAllowed = true;
    fieldFetchers.put("parent", this::fetchAndSetParentOrGlossary);
    fieldFetchers.put("relatedTerms", this::fetchAndSetRelatedTerms);
    fieldFetchers.put("usageCount", this::fetchAndSetUsageCount);
    fieldFetchers.put("childrenCount", this::fetchAndSetChildrenCount);

    // Initialize inherited field search
    if (searchRepository != null) {
      inheritedFieldEntitySearch = new DefaultInheritedFieldEntitySearch(searchRepository);
    }
  }

  public ResultList<EntityReference> getGlossaryTermAssets(
      UUID glossaryTermId, int limit, int offset) {
    GlossaryTerm term = get(null, glossaryTermId, getFields("id,fullyQualifiedName"));

    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search is unavailable for glossary term assets. Returning empty list.");
      return new ResultList<>(new ArrayList<>(), null, null, 0);
    }

    InheritedFieldQuery query =
        InheritedFieldQuery.forGlossaryTerm(term.getFullyQualifiedName(), offset, limit);

    InheritedFieldResult result =
        inheritedFieldEntitySearch.getEntitiesForField(
            query,
            () -> {
              LOG.warn(
                  "Search fallback for glossary term {} assets. Returning empty list.",
                  term.getFullyQualifiedName());
              return new InheritedFieldResult(new ArrayList<>(), 0);
            });

    return new ResultList<>(result.entities(), null, null, result.total());
  }

  public ResultList<EntityReference> getGlossaryTermAssetsByName(
      String termName, int limit, int offset) {
    GlossaryTerm term = getByName(null, termName, getFields("id,fullyQualifiedName"));
    return getGlossaryTermAssets(term.getId(), limit, offset);
  }

  public Map<String, Integer> getAllGlossaryTermsWithAssetsCount() {
    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search unavailable for glossary term asset counts");
      return new HashMap<>();
    }

    List<GlossaryTerm> allGlossaryTerms =
        listAll(getFields("fullyQualifiedName"), new ListFilter(null));
    Map<String, Integer> glossaryTermAssetCounts = new HashMap<>();

    for (GlossaryTerm term : allGlossaryTerms) {
      InheritedFieldQuery query =
          InheritedFieldQuery.forGlossaryTerm(term.getFullyQualifiedName(), 0, 0);

      Integer count =
          inheritedFieldEntitySearch.getCountForField(
              query,
              () -> {
                LOG.warn(
                    "Search fallback for glossary term {} asset count. Returning 0.",
                    term.getFullyQualifiedName());
                return 0;
              });

      glossaryTermAssetCounts.put(term.getFullyQualifiedName(), count);
    }

    return glossaryTermAssetCounts;
  }

  public Map<String, Integer> getRelationTypeUsageCounts() {
    Map<String, Integer> usageCounts = new HashMap<>();
    List<EntityRelationshipRecord> records =
        daoCollection
            .relationshipDAO()
            .findAllByEntityTypes(entityType, entityType, Relationship.RELATED_TO.ordinal());

    for (EntityRelationshipRecord record : records) {
      String relationType = extractRelationType(record.getJson());
      usageCounts.merge(relationType, 1, Integer::sum);
    }

    return usageCounts;
  }

  @Override
  public void setFields(GlossaryTerm entity, Fields fields, RelationIncludes relationIncludes) {
    entity.withParent(getParent(entity)).withGlossary(getGlossary(entity));
    entity.setRelatedTerms(
        fields.contains("relatedTerms") ? getRelatedTerms(entity) : entity.getRelatedTerms());
    entity.withUsageCount(
        fields.contains("usageCount") ? getUsageCount(entity) : entity.getUsageCount());
    entity.withChildrenCount(
        fields.contains("childrenCount") ? getChildrenCount(entity) : entity.getChildrenCount());
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<GlossaryTerm> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    // Resolve parent/glossary references in batch to avoid per-entity relationship lookups.
    populateParentAndGlossaryReferencesInBulk(entities);

    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  private void populateParentAndGlossaryReferencesInBulk(List<GlossaryTerm> entities) {
    Map<UUID, GlossaryTerm> termById =
        entities.stream()
            .filter(term -> term.getId() != null)
            .collect(Collectors.toMap(GlossaryTerm::getId, term -> term, (a, b) -> a));
    if (termById.isEmpty()) {
      return;
    }

    List<String> termIds = termById.keySet().stream().map(UUID::toString).toList();
    List<CollectionDAO.EntityRelationshipObject> containsRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(termIds, Relationship.CONTAINS.ordinal(), Include.ALL);
    List<CollectionDAO.EntityRelationshipObject> hasGlossaryRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(termIds, Relationship.HAS.ordinal(), GLOSSARY, Include.ALL);

    Set<UUID> parentIds = new HashSet<>();
    Set<UUID> glossaryIds = new HashSet<>();
    for (CollectionDAO.EntityRelationshipObject record : containsRecords) {
      if (GLOSSARY_TERM.equals(record.getFromEntity())) {
        parentIds.add(UUID.fromString(record.getFromId()));
      } else if (GLOSSARY.equals(record.getFromEntity())) {
        glossaryIds.add(UUID.fromString(record.getFromId()));
      }
    }
    for (CollectionDAO.EntityRelationshipObject record : hasGlossaryRecords) {
      glossaryIds.add(UUID.fromString(record.getFromId()));
    }

    Map<String, EntityReference> parentRefById =
        Entity.getEntityReferencesByIds(GLOSSARY_TERM, new ArrayList<>(parentIds), Include.ALL)
            .stream()
            .collect(Collectors.toMap(ref -> ref.getId().toString(), ref -> ref));
    Map<String, EntityReference> glossaryRefById =
        Entity.getEntityReferencesByIds(GLOSSARY, new ArrayList<>(glossaryIds), Include.ALL)
            .stream()
            .collect(Collectors.toMap(ref -> ref.getId().toString(), ref -> ref));

    Map<UUID, EntityReference> parentByTermId = new HashMap<>();
    Map<UUID, EntityReference> glossaryFromContainsByTermId = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : containsRecords) {
      UUID termId = UUID.fromString(record.getToId());
      if (GLOSSARY_TERM.equals(record.getFromEntity())) {
        EntityReference parentRef = parentRefById.get(record.getFromId());
        if (parentRef != null) {
          parentByTermId.put(termId, parentRef);
        }
      } else if (GLOSSARY.equals(record.getFromEntity())) {
        EntityReference glossaryRef = glossaryRefById.get(record.getFromId());
        if (glossaryRef != null) {
          glossaryFromContainsByTermId.put(termId, glossaryRef);
        }
      }
    }

    Map<UUID, EntityReference> glossaryFromHasByTermId = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : hasGlossaryRecords) {
      UUID termId = UUID.fromString(record.getToId());
      EntityReference glossaryRef = glossaryRefById.get(record.getFromId());
      if (glossaryRef != null) {
        glossaryFromHasByTermId.put(termId, glossaryRef);
      }
    }

    for (GlossaryTerm term : entities) {
      if (term.getId() == null) {
        continue;
      }

      if (term.getParent() == null) {
        EntityReference parentRef = parentByTermId.get(term.getId());
        if (parentRef != null) {
          term.setParent(parentRef);
        }
      }

      if (term.getGlossary() == null) {
        boolean hasParent = term.getParent() != null;
        EntityReference glossaryRef =
            hasParent
                ? glossaryFromHasByTermId.getOrDefault(
                    term.getId(), glossaryFromContainsByTermId.get(term.getId()))
                : glossaryFromContainsByTermId.getOrDefault(
                    term.getId(), glossaryFromHasByTermId.get(term.getId()));
        if (glossaryRef != null) {
          term.setGlossary(glossaryRef);
        }
      }
    }
  }

  @Override
  public void clearFields(GlossaryTerm entity, Fields fields) {
    entity.setRelatedTerms(fields.contains("relatedTerms") ? entity.getRelatedTerms() : null);
    entity.withUsageCount(fields.contains("usageCount") ? entity.getUsageCount() : null);
    entity.withChildrenCount(fields.contains("childrenCount") ? entity.getChildrenCount() : null);
  }

  @Override
  public void setInheritedFields(GlossaryTerm glossaryTerm, Fields fields) {
    super.setInheritedFields(glossaryTerm, fields);
  }

  @Override
  public void setInheritedFields(List<GlossaryTerm> glossaryTerms, Fields fields) {
    super.setInheritedFields(glossaryTerms, fields);
  }

  @Override
  protected String getInheritableFields() {
    return "owners,domains,reviewers";
  }

  @Override
  protected boolean requiresParentForInheritance(GlossaryTerm glossaryTerm, Fields fields) {
    boolean needsOwners = fields.contains(FIELD_OWNERS) && nullOrEmpty(glossaryTerm.getOwners());
    boolean needsDomains = fields.contains(FIELD_DOMAINS) && nullOrEmpty(glossaryTerm.getDomains());
    boolean needsReviewers = fields.contains(FIELD_REVIEWERS);
    return needsOwners || needsDomains || needsReviewers;
  }

  @Override
  protected void applyInheritance(
      GlossaryTerm glossaryTerm, Fields fields, EntityInterface parent) {
    inheritOwners(glossaryTerm, fields, parent);
    inheritDomains(glossaryTerm, fields, parent);
    inheritReviewers(glossaryTerm, fields, parent);
  }

  private Integer getUsageCount(GlossaryTerm term) {
    return daoCollection
        .tagUsageDAO()
        .getTagCount(TagSource.GLOSSARY.ordinal(), term.getFullyQualifiedName());
  }

  private Integer getChildrenCount(GlossaryTerm term) {
    // Count all nested terms using FQN prefix matching for efficiency
    return daoCollection.glossaryTermDAO().countNestedTerms(term.getFullyQualifiedName());
  }

  private List<TermRelation> getRelatedTerms(GlossaryTerm entity) {
    List<TermRelation> relations = new ArrayList<>();
    List<EntityRelationshipRecord> fromRecords =
        findFromRecords(entity.getId(), GLOSSARY_TERM, Relationship.RELATED_TO, GLOSSARY_TERM);
    List<EntityRelationshipRecord> toRecords =
        findToRecords(entity.getId(), GLOSSARY_TERM, Relationship.RELATED_TO, GLOSSARY_TERM);

    // entity is TO side: json reflects the FROM entity's relation type, apply inverse to get
    // entity's perspective
    for (EntityRelationshipRecord record : fromRecords) {
      TermRelation rel = buildTermRelation(record);
      String inverse = getInverseRelationType(rel.getRelationType());
      if (inverse != null) {
        rel.setRelationType(inverse);
      }
      relations.add(rel);
    }
    // entity is FROM side: json reflects entity's relation type directly, use as-is
    for (EntityRelationshipRecord record : toRecords) {
      relations.add(buildTermRelation(record));
    }
    relations.sort(Comparator.comparing(tr -> tr.getTerm().getFullyQualifiedName()));
    return relations;
  }

  private TermRelation buildTermRelation(EntityRelationshipRecord record) {
    EntityReference termRef = Entity.getEntityReferenceById(GLOSSARY_TERM, record.getId(), ALL);
    String relationType = "relatedTo";
    if (record.getJson() != null) {
      try {
        Map<String, Object> jsonMap = JsonUtils.readValue(record.getJson(), Map.class);
        if (jsonMap.containsKey("relationType")) {
          relationType = (String) jsonMap.get("relationType");
        }
      } catch (Exception e) {
        LOG.debug("Failed to parse relation JSON: {}", e.getMessage());
      }
    }
    return new TermRelation().withTerm(termRef).withRelationType(relationType);
  }

  private void populateTermRelations(List<TermRelation> termRelations) {
    if (termRelations == null) {
      return;
    }
    for (TermRelation termRelation : termRelations) {
      if (termRelation.getTerm() != null) {
        EntityReference ref = termRelation.getTerm();
        EntityReference populatedRef = Entity.getEntityReference(ref, Include.NON_DELETED);
        termRelation.setTerm(populatedRef);
      }
      if (termRelation.getRelationType() == null) {
        termRelation.setRelationType("relatedTo");
      }
    }
  }

  @Override
  public void prepare(GlossaryTerm entity, boolean update) {
    // Validate parent term
    GlossaryTerm parentTerm =
        entity.getParent() != null
            ? Entity.getEntity(
                entity.getParent().withType(GLOSSARY_TERM), "owners,reviewers", Include.NON_DELETED)
            : null;
    if (parentTerm != null) {
      entity.setParent(parentTerm.getEntityReference());
    }
    // Validate glossary
    Glossary glossary = Entity.getEntity(entity.getGlossary(), "reviewers", Include.NON_DELETED);
    entity.setGlossary(glossary.getEntityReference());
    validateHierarchy(entity);
    // Validate related terms
    populateTermRelations(entity.getRelatedTerms());

    if (!update) {
      checkDuplicateTerms(entity);
    }
  }

  /**
   * Performs validation during CSV import (both dry-run and actual import).
   * Checks for circular self-references and move-to-child scenarios to prevent import issues.
   * This validation runs before entity creation/update to catch logical errors early.
   */
  public void validateForDryRun(
      GlossaryTerm entity, Map<String, GlossaryTerm> dryRunCreatedEntities) {
    if (entity.getParent() == null) {
      return;
    }

    // Check if term name matches parent name (catches CSV import circular reference)
    // Example: parent name = "term1", term name = "term1" indicates self-reference
    if (entity.getName() != null
        && entity.getParent().getName() != null
        && entity.getName().equals(entity.getParent().getName())) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid hierarchy: Term '%s' cannot be its own parent",
              entity.getParent().getFullyQualifiedName()));
    }

    // Check for move-to-child scenario: does an existing term with the same name
    // exist that would be moved under its own descendant?
    String newParentFqn = entity.getParent().getFullyQualifiedName();

    // First, check in-memory dryRunCreatedEntities for terms created earlier in this batch
    // This avoids redundant DB calls for large batch imports
    GlossaryTerm existingTerm = findTermByNameInBatch(entity, dryRunCreatedEntities);

    // If not found in batch, check DB for pre-existing terms
    if (existingTerm == null) {
      String existingTermString =
          daoCollection
              .glossaryTermDAO()
              .getGlossaryTermByNameAndGlossaryIgnoreCase(
                  entity.getGlossary().getFullyQualifiedName(), entity.getName());
      if (existingTermString != null && !existingTermString.isEmpty()) {
        existingTerm = JsonUtils.readValue(existingTermString, GlossaryTerm.class);
      }
    }

    if (existingTerm != null && existingTerm.getFullyQualifiedName() != null) {
      String existingFqn = existingTerm.getFullyQualifiedName();
      // If the new parent's FQN starts with the existing term's FQN,
      // then we're trying to move the term under its own descendant
      if (FullyQualifiedName.isParent(newParentFqn, existingFqn)) {
        throw new IllegalArgumentException(invalidGlossaryTermMove(existingFqn, newParentFqn));
      }
    }
  }

  /** Find a term with the same name in the current batch (dryRunCreatedEntities). */
  private GlossaryTerm findTermByNameInBatch(
      GlossaryTerm entity, Map<String, GlossaryTerm> dryRunCreatedEntities) {
    if (dryRunCreatedEntities == null || dryRunCreatedEntities.isEmpty()) {
      return null;
    }
    String glossaryFqn = entity.getGlossary().getFullyQualifiedName();
    String termName = entity.getName().toLowerCase();

    // Search through batch for a term with the same name in the same glossary
    for (GlossaryTerm batchTerm : dryRunCreatedEntities.values()) {
      if (batchTerm.getGlossary() != null
          && batchTerm.getGlossary().getFullyQualifiedName() != null
          && batchTerm.getGlossary().getFullyQualifiedName().equals(glossaryFqn)
          && batchTerm.getName() != null
          && batchTerm.getName().toLowerCase().equals(termName)) {
        return batchTerm;
      }
    }
    return null;
  }

  @Override
  protected void setDefaultStatus(GlossaryTerm entity, boolean update) {
    // If the entityStatus is set as Unprocessed then it is the default value from the POJO
    if (!update
        || entity.getEntityStatus() == null
        || entity.getEntityStatus() == EntityStatus.UNPROCESSED) {
      // Get reviewers from parent term or glossary to determine appropriate default status
      List<EntityReference> parentReviewers = null;

      // Get parent reviewers if parent term exists
      if (entity.getParent() != null) {
        GlossaryTerm parentTerm =
            Entity.getEntity(
                entity.getParent().withType(GLOSSARY_TERM), "reviewers", Include.NON_DELETED);
        parentReviewers = parentTerm.getReviewers();
      }

      // Get glossary reviewers if no parent reviewers
      if (parentReviewers == null && entity.getGlossary() != null) {
        Glossary glossary =
            Entity.getEntity(entity.getGlossary(), "reviewers", Include.NON_DELETED);
        parentReviewers = glossary.getReviewers();
      }

      // If parentTerm or glossary has reviewers set, the glossary term can only be created in
      // `Draft` mode, otherwise use `Approved`
      entity.setEntityStatus(
          !nullOrEmpty(parentReviewers) ? EntityStatus.DRAFT : EntityStatus.APPROVED);
    }
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("glossary", "parent", "reviewers", "relatedTerms");
  }

  @Override
  public void storeEntity(GlossaryTerm entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeEntities(List<GlossaryTerm> entities) {
    storeMany(entities);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<GlossaryTerm> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(GlossaryTerm::getId).toList();
    deleteToMany(ids, Entity.GLOSSARY_TERM, Relationship.CONTAINS, Entity.GLOSSARY);
    deleteToMany(ids, Entity.GLOSSARY_TERM, Relationship.HAS, Entity.GLOSSARY);
    deleteToMany(ids, Entity.GLOSSARY_TERM, Relationship.CONTAINS, Entity.GLOSSARY_TERM);
    deleteFromMany(ids, Entity.GLOSSARY_TERM, Relationship.RELATED_TO, Entity.GLOSSARY_TERM);
    deleteToMany(ids, Entity.GLOSSARY_TERM, Relationship.RELATED_TO, Entity.GLOSSARY_TERM);
  }

  @Override
  public void storeRelationships(GlossaryTerm entity) {
    addGlossaryRelationship(entity);
    addParentRelationship(entity);
    validateRelationCardinality(entity.getId(), listOrEmpty(entity.getRelatedTerms()));
    for (TermRelation termRelation : listOrEmpty(entity.getRelatedTerms())) {
      String relationType =
          termRelation.getRelationType() != null ? termRelation.getRelationType() : "relatedTo";
      validateRelationType(relationType);
      UUID toId = termRelation.getTerm().getId();
      String canonicalType = computeCanonicalRelationType(entity.getId(), toId, relationType);
      String json = String.format("{\"relationType\":\"%s\"}", canonicalType);
      addRelationship(
          entity.getId(), toId, GLOSSARY_TERM, GLOSSARY_TERM, Relationship.RELATED_TO, json, true);
      RdfUpdater.addGlossaryTermRelation(entity.getId(), toId, relationType);
    }
  }

  @Transaction
  public GlossaryTerm addTermRelation(UUID id, TermRelation termRelation) {
    GlossaryTerm term = get(null, id, getFields("relatedTerms"), Include.NON_DELETED, false);
    EntityReference termRef =
        Entity.getEntityReference(termRelation.getTerm(), Include.NON_DELETED);
    termRelation.setTerm(termRef);
    String relationType =
        termRelation.getRelationType() != null ? termRelation.getRelationType() : "relatedTo";
    validateRelationType(relationType);

    boolean exists =
        listOrEmpty(term.getRelatedTerms()).stream()
            .anyMatch(
                rel ->
                    rel.getTerm() != null
                        && rel.getTerm().getId() != null
                        && rel.getTerm().getId().equals(termRef.getId())
                        && Objects.equals(
                            rel.getRelationType() != null ? rel.getRelationType() : "relatedTo",
                            relationType));
    if (!exists) {
      validateRelationCardinality(id, List.of(termRelation));
    }

    String canonicalType = computeCanonicalRelationType(id, termRef.getId(), relationType);
    String json = String.format("{\"relationType\":\"%s\"}", canonicalType);
    addRelationship(
        id, termRef.getId(), GLOSSARY_TERM, GLOSSARY_TERM, Relationship.RELATED_TO, json, true);
    RdfUpdater.addGlossaryTermRelation(id, termRef.getId(), relationType);
    RequestEntityCache.invalidate(entityType, id, null);
    return get(null, id, getFields("relatedTerms"), Include.NON_DELETED, false);
  }

  @Transaction
  public GlossaryTerm removeTermRelation(UUID id, UUID toTermId, String relationType) {
    if (relationType != null) {
      deleteBidirectionalRelatedTo(id, toTermId, relationType);
      RdfUpdater.removeGlossaryTermRelation(id, toTermId, relationType);
    } else {
      deleteAllBidirectionalRelatedTo(id, toTermId);
    }
    return get(null, id, getFields("relatedTerms"), Include.NON_DELETED, false);
  }

  public static final List<String> DEFAULT_RELATION_TYPES =
      List.of(
          "relatedTo",
          "synonym",
          "broader",
          "narrower",
          "antonym",
          "partOf",
          "hasPart",
          "calculatedFrom",
          "usedToCalculate",
          "seeAlso");

  public void validateRelationType(String relationType) {
    if (relationType == null || relationType.isEmpty()) {
      return;
    }
    List<String> validTypes = getValidRelationTypes();
    boolean isValid = validTypes.contains(relationType);
    if (!isValid) {
      throw new BadRequestException(
          String.format(
              "Invalid relation type '%s'. Valid types are: %s",
              relationType, String.join(", ", validTypes)));
    }
  }

  private List<String> getValidRelationTypes() {
    try {
      GlossaryTermRelationSettings settings =
          SettingsCache.getSetting(
              SettingsType.GLOSSARY_TERM_RELATION_SETTINGS, GlossaryTermRelationSettings.class);
      if (settings != null && settings.getRelationTypes() != null) {
        return settings.getRelationTypes().stream()
            .map(GlossaryTermRelationType::getName)
            .collect(Collectors.toList());
      }
    } catch (Exception e) {
      LOG.warn("Failed to load glossary term relation settings, using defaults", e);
    }
    return DEFAULT_RELATION_TYPES;
  }

  private GlossaryTermRelationType getRelationTypeConfig(String relationType) {
    if (relationType == null || relationType.isEmpty()) {
      return null;
    }
    try {
      GlossaryTermRelationSettings settings =
          SettingsCache.getSetting(
              SettingsType.GLOSSARY_TERM_RELATION_SETTINGS, GlossaryTermRelationSettings.class);
      if (settings != null && settings.getRelationTypes() != null) {
        return settings.getRelationTypes().stream()
            .filter(rt -> relationType.equalsIgnoreCase(rt.getName()))
            .findFirst()
            .orElse(null);
      }
    } catch (Exception e) {
      // Settings not available, ignore
    }
    return null;
  }

  private String getInverseRelationType(String relationType) {
    GlossaryTermRelationType config = getRelationTypeConfig(relationType);
    if (config != null && config.getInverseRelation() != null) {
      return config.getInverseRelation();
    }
    return null;
  }

  private String computeCanonicalRelationType(UUID fromId, UUID toId, String relationType) {
    if (fromId.compareTo(toId) > 0) {
      String inverse = getInverseRelationType(relationType);
      if (inverse != null) {
        return inverse;
      }
    }
    return relationType;
  }

  private int getRelationCount(UUID termId, String relationType, Map<String, Integer> cache) {
    String key = "any:" + termId + ":" + relationType;
    Integer cached = cache.get(key);
    if (cached != null) {
      return cached;
    }

    int count = 0;
    Set<String> seen = new HashSet<>();
    String inverseType = getInverseRelationType(relationType);

    // toRecords: termId is the source (fromId) — stored relation type matches directly
    List<EntityRelationshipRecord> toRecords =
        daoCollection
            .relationshipDAO()
            .findTo(termId, GLOSSARY_TERM, Relationship.RELATED_TO.ordinal());
    for (EntityRelationshipRecord record : toRecords) {
      String relType = extractRelationType(record.getJson());
      if (relationType.equalsIgnoreCase(relType)) {
        String relKey = termId + "->" + record.getId();
        if (seen.add(relKey)) {
          count++;
        }
      }
    }

    // fromRecords: termId is the target (toId) — stored type is from the other term's
    // perspective, so match against the inverse
    List<EntityRelationshipRecord> fromRecords =
        daoCollection
            .relationshipDAO()
            .findFrom(termId, GLOSSARY_TERM, Relationship.RELATED_TO.ordinal(), GLOSSARY_TERM);
    for (EntityRelationshipRecord record : fromRecords) {
      String relType = extractRelationType(record.getJson());
      String matchType = inverseType != null ? inverseType : relationType;
      if (matchType.equalsIgnoreCase(relType)) {
        String relKey = record.getId() + "->" + termId;
        if (seen.add(relKey)) {
          count++;
        }
      }
    }

    cache.put(key, count);
    return count;
  }

  private void validateRelationCardinality(UUID fromId, List<TermRelation> additions) {
    if (additions == null || additions.isEmpty()) {
      return;
    }

    Map<String, Integer> relationCountCache = new HashMap<>();
    Map<String, Integer> outgoingAdds = new HashMap<>();
    Map<String, Integer> incomingAdds = new HashMap<>();

    for (TermRelation relation : additions) {
      if (relation == null || relation.getTerm() == null || relation.getTerm().getId() == null) {
        continue;
      }

      String relationType =
          relation.getRelationType() != null ? relation.getRelationType() : "relatedTo";
      GlossaryTermRelationType config = getRelationTypeConfig(relationType);
      Integer sourceMax = config != null ? config.getSourceMax() : null;
      Integer targetMax = config != null ? config.getTargetMax() : null;
      RelationCardinality cardinality = config != null ? config.getCardinality() : null;

      if (cardinality != null && cardinality != RelationCardinality.CUSTOM) {
        switch (cardinality) {
          case ONE_TO_ONE -> {
            sourceMax = 1;
            targetMax = 1;
          }
          case ONE_TO_MANY -> {
            sourceMax = null;
            targetMax = 1;
          }
          case MANY_TO_ONE -> {
            sourceMax = 1;
            targetMax = null;
          }
          case MANY_TO_MANY -> {
            sourceMax = null;
            targetMax = null;
          }
          default -> {
            // Keep configured values for unknown/custom.
          }
        }
      }

      UUID toId = relation.getTerm().getId();

      if (sourceMax != null) {
        String outKey = fromId + ":" + relationType;
        int addedOut = outgoingAdds.merge(outKey, 1, Integer::sum);
        int existingOut = getRelationCount(fromId, relationType, relationCountCache);
        if (existingOut + addedOut > sourceMax) {
          throw new BadRequestException(
              String.format(
                  "Relation type '%s' exceeds source cardinality (max=%d) for term %s",
                  relationType, sourceMax, fromId));
        }
      }

      if (targetMax != null) {
        String inKey = toId + ":" + relationType;
        int addedIn = incomingAdds.merge(inKey, 1, Integer::sum);
        int existingIn = getRelationCount(toId, relationType, relationCountCache);
        if (existingIn + addedIn > targetMax) {
          throw new BadRequestException(
              String.format(
                  "Relation type '%s' exceeds target cardinality (max=%d) for term %s",
                  relationType, targetMax, toId));
        }
      }
    }
  }

  public Map<String, Object> getTermRelationGraph(UUID id, int depth, List<String> relationTypes) {
    Map<String, Object> graph = new HashMap<>();
    Set<UUID> visited = new HashSet<>();
    List<Map<String, Object>> nodes = new ArrayList<>();
    List<Map<String, Object>> edges = new ArrayList<>();

    GlossaryTerm rootTerm = get(null, id, getFields("relatedTerms"), Include.NON_DELETED, false);
    Map<String, Object> rootNode = new HashMap<>();
    rootNode.put("id", rootTerm.getId().toString());
    rootNode.put("name", rootTerm.getName());
    rootNode.put("fullyQualifiedName", rootTerm.getFullyQualifiedName());
    rootNode.put("displayName", rootTerm.getDisplayName());
    nodes.add(rootNode);
    visited.add(rootTerm.getId());

    Map<UUID, GlossaryTerm> prefetchedTerms = new HashMap<>();
    prefetchedTerms.put(rootTerm.getId(), rootTerm);
    if (depth > 1) {
      prefetchGraphTerms(rootTerm, depth, prefetchedTerms);
    }

    buildGraph(rootTerm, depth, relationTypes, visited, nodes, edges, prefetchedTerms);

    graph.put("nodes", nodes);
    graph.put("edges", edges);
    return graph;
  }

  private static final int MAX_GRAPH_NODES = 200;

  private void prefetchGraphTerms(
      GlossaryTerm term, int depth, Map<UUID, GlossaryTerm> prefetchedTerms) {
    if (depth <= 1 || prefetchedTerms.size() >= MAX_GRAPH_NODES) {
      return;
    }

    List<GlossaryTerm> currentLevel = List.of(term);
    Fields fields = getFields("relatedTerms");

    for (int d = depth; d > 1 && !currentLevel.isEmpty(); d--) {
      List<UUID> toFetch = new ArrayList<>();
      for (GlossaryTerm t : currentLevel) {
        if (t.getRelatedTerms() == null) {
          continue;
        }
        for (TermRelation relation : t.getRelatedTerms()) {
          UUID relatedId = relation.getTerm().getId();
          if (!prefetchedTerms.containsKey(relatedId) && !toFetch.contains(relatedId)) {
            toFetch.add(relatedId);
            if (prefetchedTerms.size() + toFetch.size() >= MAX_GRAPH_NODES) {
              break;
            }
          }
        }
        if (prefetchedTerms.size() + toFetch.size() >= MAX_GRAPH_NODES) {
          break;
        }
      }

      if (toFetch.isEmpty()) {
        break;
      }

      List<GlossaryTerm> fetched = get(null, toFetch, fields, Include.NON_DELETED);
      for (GlossaryTerm f : fetched) {
        prefetchedTerms.put(f.getId(), f);
      }
      currentLevel = fetched;
    }
  }

  private void buildGraph(
      GlossaryTerm term,
      int depth,
      List<String> relationTypes,
      Set<UUID> visited,
      List<Map<String, Object>> nodes,
      List<Map<String, Object>> edges,
      Map<UUID, GlossaryTerm> prefetchedTerms) {
    if (depth <= 0 || term.getRelatedTerms() == null) {
      return;
    }
    if (nodes.size() >= MAX_GRAPH_NODES) {
      LOG.warn("Graph node limit ({}) reached, stopping traversal", MAX_GRAPH_NODES);
      return;
    }

    Set<String> edgesSeen = new HashSet<>();
    for (TermRelation relation : term.getRelatedTerms()) {
      if (relation.getTerm() == null || relation.getTerm().getId() == null) {
        continue;
      }
      if (relationTypes != null && !relationTypes.isEmpty()) {
        if (!relationTypes.contains(relation.getRelationType())) {
          continue;
        }
      }

      UUID relatedTermId = relation.getTerm().getId();

      String edgeKey = term.getId() + ":" + relatedTermId + ":" + relation.getRelationType();
      if (edgesSeen.add(edgeKey)) {
        Map<String, Object> edge = new HashMap<>();
        edge.put("from", term.getId().toString());
        edge.put("to", relatedTermId.toString());
        edge.put("relationType", relation.getRelationType());
        edges.add(edge);
      }

      if (!visited.contains(relatedTermId)) {
        visited.add(relatedTermId);

        Map<String, Object> node = new HashMap<>();
        node.put("id", relatedTermId.toString());
        node.put("name", relation.getTerm().getName());
        node.put("fullyQualifiedName", relation.getTerm().getFullyQualifiedName());
        node.put("displayName", relation.getTerm().getDisplayName());
        nodes.add(node);

        if (depth > 1) {
          GlossaryTerm relatedTerm = prefetchedTerms.get(relatedTermId);
          if (relatedTerm != null) {
            buildGraph(
                relatedTerm, depth - 1, relationTypes, visited, nodes, edges, prefetchedTerms);
          }
        }
      }
    }
  }

  @Override
  public void restorePatchAttributes(GlossaryTerm original, GlossaryTerm updated) {
    // Patch can't update Children
    super.restorePatchAttributes(original, updated);
    updated.withChildren(original.getChildren());
  }

  @Override
  public void entityRelationshipReindex(GlossaryTerm original, GlossaryTerm updated) {
    super.entityRelationshipReindex(original, updated);

    // Update search indexes of assets and entity itself on name , fullyQualifiedName and
    // displayName change
    if (!Objects.equals(original.getFullyQualifiedName(), updated.getFullyQualifiedName())
        || !Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      updateAssetIndexes(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
    }
  }

  @Override
  public void setFullyQualifiedName(GlossaryTerm entity) {
    // Validate parent
    if (entity.getParent() == null) { // Glossary term at the root of the glossary
      entity.setFullyQualifiedName(
          FullyQualifiedName.build(entity.getGlossary().getFullyQualifiedName(), entity.getName()));
    } else { // Glossary term that is a child of another glossary term
      EntityReference parent = entity.getParent();
      entity.setFullyQualifiedName(
          FullyQualifiedName.add(parent.getFullyQualifiedName(), entity.getName()));
    }
  }

  public BulkOperationResult bulkAddAndValidateGlossaryToAssets(
      UUID glossaryTermId, AddGlossaryToAssetsRequest request) {
    boolean dryRun = Boolean.TRUE.equals(request.getDryRun());

    GlossaryTerm term = this.get(null, glossaryTermId, getFields("id,tags"));
    EntityRepository<?> glossaryRepository = Entity.getEntityRepository(Entity.GLOSSARY);
    EntityInterface glossary =
        glossaryRepository.getByName(
            null, term.getGlossary().getFullyQualifiedName(), glossaryRepository.getFields("tags"));
    // Check if the tags are mutually exclusive for the glossary
    checkMutuallyExclusive(glossary.getTags());

    BulkOperationResult result = new BulkOperationResult().withDryRun(dryRun);
    List<BulkResponse> failures = new ArrayList<>();
    List<BulkResponse> success = new ArrayList<>();

    if (dryRun
        && (CommonUtil.nullOrEmpty(glossary.getTags())
            || CommonUtil.nullOrEmpty(request.getAssets()))) {
      // Nothing to Validate
      return result
          .withStatus(ApiStatus.SUCCESS)
          .withSuccessRequest(List.of(new BulkResponse().withMessage("Nothing to Validate.")));
    }

    // Validation for entityReferences
    EntityUtil.populateEntityReferences(request.getAssets());

    TagLabel tagLabel =
        new TagLabel()
            .withTagFQN(term.getFullyQualifiedName())
            .withSource(TagSource.GLOSSARY)
            .withLabelType(TagLabel.LabelType.MANUAL);

    for (EntityReference ref : request.getAssets()) {
      // Update Result Processed
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);

      // Handle column assets specially - columns don't have their own repository
      if (Entity.TABLE_COLUMN.equals(ref.getType())) {
        try {
          addTagToColumn(ref, tagLabel, glossary.getTags(), dryRun, success, failures, result);
        } catch (Exception ex) {
          failures.add(new BulkResponse().withRequest(ref).withMessage(ex.getMessage()));
          result.withFailedRequest(failures);
          result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
        }
        continue;
      }

      EntityRepository<?> entityRepository = Entity.getEntityRepository(ref.getType());
      EntityInterface asset =
          entityRepository.get(null, ref.getId(), entityRepository.getFields("tags"));

      try {
        Map<String, List<TagLabel>> allAssetTags =
            daoCollection.tagUsageDAO().getTagsByPrefix(asset.getFullyQualifiedName(), "%", true);
        checkMutuallyExclusiveForParentAndSubField(
            asset.getFullyQualifiedName(),
            FullyQualifiedName.buildHash(asset.getFullyQualifiedName()),
            allAssetTags,
            glossary.getTags(),
            false);
        success.add(new BulkResponse().withRequest(ref));
        result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
      } catch (Exception ex) {
        failures.add(new BulkResponse().withRequest(ref).withMessage(ex.getMessage()));
        result.withFailedRequest(failures);
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
      }
      // Validate and Store Tags
      if (!dryRun && CommonUtil.nullOrEmpty(result.getFailedRequest())) {
        List<TagLabel> tempList = new ArrayList<>(asset.getTags());
        tempList.add(tagLabel);
        // Apply Tags to Entities
        entityRepository.applyTags(getUniqueTags(tempList), asset.getFullyQualifiedName());

        searchRepository.updateEntity(ref);
      }
    }

    // Apply the tags of glossary to the glossary term
    if (!dryRun
        && CommonUtil.nullOrEmpty(result.getFailedRequest())
        && (!(term.getTags().isEmpty() && glossary.getTags().isEmpty()))) {
      // Remove current entity tags in the database. It will be added back later from the merged tag
      // list.
      daoCollection.tagUsageDAO().deleteTagsByTarget(term.getFullyQualifiedName());
      applyTags(getUniqueTags(glossary.getTags()), term.getFullyQualifiedName());

      searchRepository.updateEntity(term.getEntityReference());
    }

    // Add Failed And Suceess Request
    result.withFailedRequest(failures).withSuccessRequest(success);

    // Set Final Status
    if (result.getNumberOfRowsPassed().equals(result.getNumberOfRowsProcessed())) {
      result.withStatus(ApiStatus.SUCCESS);
    } else if (result.getNumberOfRowsPassed() > 1) {
      result.withStatus(ApiStatus.PARTIAL_SUCCESS);
    } else {
      result.withStatus(ApiStatus.FAILURE);
    }

    return result;
  }

  /**
   * Add a tag to a column through its parent table.
   * Columns are not standalone entities, so we need to update the parent table's column.
   */
  private void addTagToColumn(
      EntityReference columnRef,
      TagLabel tagLabel,
      List<TagLabel> glossaryTags,
      boolean dryRun,
      List<BulkResponse> success,
      List<BulkResponse> failures,
      BulkOperationResult result) {
    String columnFqn = columnRef.getFullyQualifiedName();
    if (columnFqn == null) {
      throw new IllegalArgumentException("Column FQN is required");
    }

    // Extract table FQN from column FQN (format: service.database.schema.table.column[.nested...])
    String tableFqn = FullyQualifiedName.getTableFQN(columnFqn);

    // Get the table with columns
    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    Table table =
        tableRepository.getByName(null, tableFqn, tableRepository.getFields("columns,tags"));

    // Find the column by FQN
    Column targetColumn = findColumnByFqn(table.getColumns(), columnFqn);
    if (targetColumn == null) {
      throw new IllegalArgumentException("Column not found: " + columnFqn);
    }

    // Validate mutually exclusive tags
    Map<String, List<TagLabel>> allAssetTags =
        daoCollection.tagUsageDAO().getTagsByPrefix(columnFqn, "%", true);
    checkMutuallyExclusiveForParentAndSubField(
        columnFqn, FullyQualifiedName.buildHash(columnFqn), allAssetTags, glossaryTags, false);

    if (!dryRun && CommonUtil.nullOrEmpty(result.getFailedRequest())) {
      List<TagLabel> columnTags = new ArrayList<>(listOrEmpty(targetColumn.getTags()));
      columnTags.add(tagLabel);
      applyTags(getUniqueTags(columnTags), columnFqn);
      searchRepository.updateEntity(table.getEntityReference());
    }

    success.add(new BulkResponse().withRequest(columnRef));
    result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
  }

  private Column findColumnByFqn(List<Column> columns, String columnFqn) {
    if (columns == null) {
      return null;
    }
    for (Column column : columns) {
      if (columnFqn.equals(column.getFullyQualifiedName())) {
        return column;
      }
      // Check nested columns
      if (column.getChildren() != null) {
        Column nested = findColumnByFqn(column.getChildren(), columnFqn);
        if (nested != null) {
          return nested;
        }
      }
    }
    return null;
  }

  public BulkOperationResult validateGlossaryTagsAddition(
      UUID glossaryTermId, ValidateGlossaryTagsRequest request) {
    GlossaryTerm term = this.get(null, glossaryTermId, getFields("id,tags"));

    List<TagLabel> glossaryTagsToValidate = request.getGlossaryTags();

    // Check if the tags are mutually exclusive for the glossary
    checkMutuallyExclusive(request.getGlossaryTags());

    BulkOperationResult result = new BulkOperationResult().withDryRun(true);
    List<BulkResponse> failures = new ArrayList<>();
    List<BulkResponse> success = new ArrayList<>();

    if (CommonUtil.nullOrEmpty(glossaryTagsToValidate)) {
      // Nothing to Validate
      return result
          .withStatus(ApiStatus.SUCCESS)
          .withSuccessRequest(List.of(new BulkResponse().withMessage("Nothing to Validate.")));
    }

    Set<String> targetFQNHashesFromDb =
        new HashSet<>(
            daoCollection.tagUsageDAO().getTargetFQNHashForTag(term.getFullyQualifiedName()));
    Map<String, EntityReference> targetFQNFromES =
        getGlossaryUsageFromES(term.getFullyQualifiedName(), targetFQNHashesFromDb.size(), false);
    // Inclusion of soft deleted assets as well
    targetFQNFromES.putAll(
        getGlossaryUsageFromES(term.getFullyQualifiedName(), targetFQNHashesFromDb.size(), true));

    for (String fqnHash : targetFQNHashesFromDb) {
      // Update Result Processed
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);

      Map<String, List<TagLabel>> allAssetTags =
          daoCollection.tagUsageDAO().getTagsByPrefix(fqnHash, "%", false);

      EntityReference refDetails = targetFQNFromES.get(fqnHash);

      try {
        // Assets FQN is not available / we can use fqnHash for now
        checkMutuallyExclusiveForParentAndSubField(
            term.getFullyQualifiedName(), fqnHash, allAssetTags, glossaryTagsToValidate, true);
        if (refDetails != null) {
          success.add(new BulkResponse().withRequest(refDetails));
        } else {
          success.add(
              new BulkResponse()
                  .withRequest(
                      new EntityReference().withFullyQualifiedName(fqnHash).withType("unknown"))
                  .withMessage(ES_MISSING_DATA));
        }
        result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
      } catch (IllegalArgumentException ex) {
        if (refDetails != null) {
          failures.add(new BulkResponse().withRequest(refDetails).withMessage(ex.getMessage()));
        } else {
          failures.add(
              new BulkResponse()
                  .withRequest(
                      new EntityReference().withFullyQualifiedName(fqnHash).withType("unknown"))
                  .withMessage(String.format("%s %s", ex.getMessage(), ES_MISSING_DATA)));
        }
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
      }
    }

    // Add Failed And Suceess Request
    result.withFailedRequest(failures).withSuccessRequest(success);

    // Set Final Status
    if (result.getNumberOfRowsPassed().equals(result.getNumberOfRowsProcessed())) {
      result.withStatus(ApiStatus.SUCCESS);
    } else if (result.getNumberOfRowsPassed() > 1) {
      result.withStatus(ApiStatus.PARTIAL_SUCCESS);
    } else {
      result.withStatus(ApiStatus.FAILURE);
    }

    return result;
  }

  protected Map<String, EntityReference> getGlossaryUsageFromES(
      String glossaryFqn, int size, boolean softDeleted) {
    try {
      String key = "_source";
      SearchRequest searchRequest =
          new SearchRequest()
              .withQuery(
                  String.format(
                      "** AND (tags.tagFQN:\"%s\")",
                      ReindexingUtil.escapeDoubleQuotes(glossaryFqn)))
              .withSize(size)
              .withIndex(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
              .withFrom(0)
              .withFetchSource(true)
              .withTrackTotalHits(false)
              .withSortFieldParam("_score")
              .withDeleted(softDeleted)
              .withSortOrder("desc")
              .withIncludeSourceFields(new ArrayList<>());
      Response response = searchRepository.search(searchRequest, null);
      String json = (String) response.getEntity();
      Set<EntityReference> fqns = new TreeSet<>(compareEntityReferenceById);
      for (Iterator<JsonNode> it =
              ((ArrayNode) JsonUtils.extractValue(json, "hits", "hits")).elements();
          it.hasNext(); ) {
        JsonNode jsonNode = it.next();
        String id = JsonUtils.extractValue(jsonNode, key, "id");
        String fqn = JsonUtils.extractValue(jsonNode, key, "fullyQualifiedName");
        String type = JsonUtils.extractValue(jsonNode, key, "entityType");
        if (!CommonUtil.nullOrEmpty(fqn) && !CommonUtil.nullOrEmpty(type)) {
          fqns.add(
              new EntityReference()
                  .withId(UUID.fromString(id))
                  .withFullyQualifiedName(fqn)
                  .withType(type));
        }
      }

      return fqns.stream()
          .collect(
              Collectors.toMap(
                  entityReference ->
                      FullyQualifiedName.buildHash(entityReference.getFullyQualifiedName()),
                  entityReference -> entityReference));
    } catch (Exception ex) {
      LOG.error("Error while getting glossary usage from ES for validation", ex);
    }
    return new HashMap<>();
  }

  public BulkOperationResult bulkRemoveGlossaryToAssets(
      UUID glossaryTermId, AddGlossaryToAssetsRequest request) {
    GlossaryTerm term = this.get(null, glossaryTermId, getFields("id,tags"));

    BulkOperationResult result =
        new BulkOperationResult().withStatus(ApiStatus.SUCCESS).withDryRun(false);
    List<BulkResponse> success = new ArrayList<>();

    // Validation for entityReferences
    EntityUtil.populateEntityReferences(request.getAssets());

    for (EntityReference ref : request.getAssets()) {
      // Update Result Processed
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);

      // Handle column assets specially - columns don't have their own repository
      if (Entity.TABLE_COLUMN.equals(ref.getType())) {
        try {
          removeTagFromColumn(ref, term, success, result);
        } catch (Exception ex) {
          LOG.error("Error removing glossary tag from column: {}", ref.getFullyQualifiedName(), ex);
          result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
        }
        continue;
      }

      EntityRepository<?> entityRepository = Entity.getEntityRepository(ref.getType());
      EntityInterface asset =
          entityRepository.get(null, ref.getId(), entityRepository.getFields("id"));

      daoCollection
          .tagUsageDAO()
          .deleteTagsByTagAndTargetEntity(
              term.getFullyQualifiedName(), asset.getFullyQualifiedName());
      success.add(new BulkResponse().withRequest(ref));
      result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);

      // Update ES
      searchRepository.updateEntity(ref);
    }

    return result.withSuccessRequest(success);
  }

  /**
   * Remove a glossary term tag from a column through its parent table.
   */
  private void removeTagFromColumn(
      EntityReference columnRef,
      GlossaryTerm term,
      List<BulkResponse> success,
      BulkOperationResult result) {
    String columnFqn = columnRef.getFullyQualifiedName();
    if (columnFqn == null) {
      throw new IllegalArgumentException("Column FQN is required");
    }

    // Extract table FQN from column FQN (format: service.database.schema.table.column[.nested...])
    String tableFqn = FullyQualifiedName.getTableFQN(columnFqn);

    // Get the table
    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    Table table = tableRepository.getByName(null, tableFqn, tableRepository.getFields("columns"));

    // Remove the tag from the column
    daoCollection
        .tagUsageDAO()
        .deleteTagsByTagAndTargetEntity(term.getFullyQualifiedName(), columnFqn);
    success.add(new BulkResponse().withRequest(columnRef));
    result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);

    // Update the parent table's search index
    searchRepository.updateEntity(table.getEntityReference());
  }

  protected EntityReference getGlossary(GlossaryTerm term) {
    if (term.getGlossary() != null) {
      return term.getGlossary();
    }

    Relationship preferred = term.getParent() != null ? Relationship.HAS : Relationship.CONTAINS;
    EntityReference glossaryRef = getFromEntityRef(term.getId(), preferred, GLOSSARY, false);
    if (glossaryRef != null) {
      return glossaryRef;
    }

    // Parent resolution can be unavailable for some list/read paths (for example, when the parent
    // term was removed). In that case, fallback to the alternate glossary relationship type.
    Relationship fallback =
        preferred == Relationship.HAS ? Relationship.CONTAINS : Relationship.HAS;
    glossaryRef = getFromEntityRef(term.getId(), fallback, GLOSSARY, false);
    if (glossaryRef != null) {
      return glossaryRef;
    }

    return getFromEntityRef(term.getId(), preferred, GLOSSARY, true);
  }

  public EntityReference getGlossary(String id) {
    return Entity.getEntityReferenceById(GLOSSARY, UUID.fromString(id), ALL);
  }

  @Override
  public EntityRepository<GlossaryTerm>.EntityUpdater getUpdater(
      GlossaryTerm original, GlossaryTerm updated, Operation operation, ChangeSource changeSource) {
    return new GlossaryTermUpdater(original, updated, operation);
  }

  @Override
  protected void postCreate(GlossaryTerm entity) {
    super.postCreate(entity);
  }

  @Override
  public void postUpdate(GlossaryTerm original, GlossaryTerm updated) {
    super.postUpdate(original, updated);
    if (original.getEntityStatus() == EntityStatus.IN_REVIEW) {
      if (updated.getEntityStatus() == EntityStatus.APPROVED) {
        closeApprovalTask(updated, "Approved the glossary term");
      } else if (updated.getEntityStatus() == EntityStatus.REJECTED) {
        closeApprovalTask(updated, "Rejected the glossary term");
      }
    }

    // TODO: It might happen that a task went from DRAFT to IN_REVIEW to DRAFT fairly quickly
    // Due to ChangesConsolidation, the postUpdate will be called as from DRAFT to DRAFT, but there
    // will be a Task created.
    // This if handles this case scenario, by guaranteeing that we are any Approval Task if the
    // Glossary Term goes back to DRAFT.
    if (original.getEntityStatus() != EntityStatus.DRAFT
        && updated.getEntityStatus() == EntityStatus.DRAFT) {
      try {
        closeApprovalTask(updated, "Closed due to glossary term going back to DRAFT.");
      } catch (EntityNotFoundException ignored) {
      } // No ApprovalTask is present, and thus we don't need to worry about this.
    }
  }

  @Override
  protected void postDelete(GlossaryTerm entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    // Cleanup all the tag labels using this glossary term
    daoCollection
        .tagUsageDAO()
        .deleteTagLabels(TagSource.GLOSSARY.ordinal(), entity.getFullyQualifiedName());
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    return super.getTaskWorkflow(threadContext);
  }

  @Override
  protected EntityReference getParentReference(GlossaryTerm entity) {
    return entity.getParent() != null ? entity.getParent() : entity.getGlossary();
  }

  @Override
  public EntityInterface getParentEntity(GlossaryTerm entity, String fields) {
    return entity.getParent() != null
        ? Entity.getEntity(entity.getParent(), fields, Include.ALL)
        : Entity.getEntity(entity.getGlossary(), fields, Include.ALL);
  }

  public List<EntityInterface> getParentEntities(List<GlossaryTerm> entities, String fields) {
    List<EntityInterface> result = new ArrayList<>();
    if (CollectionUtils.isEmpty(entities)) {
      return result;
    }
    List<EntityReference> parents =
        entities.stream().map(GlossaryTerm::getParent).filter(Objects::nonNull).distinct().toList();
    result.addAll(Entity.getEntities(parents, fields, Include.ALL));
    List<EntityReference> glossaries =
        entities.stream()
            .map(GlossaryTerm::getGlossary)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
    result.addAll(Entity.getEntities(glossaries, fields, Include.ALL));
    return result;
  }

  private void addGlossaryRelationship(GlossaryTerm term) {
    Relationship relationship = term.getParent() != null ? Relationship.HAS : Relationship.CONTAINS;
    addRelationship(
        term.getGlossary().getId(), term.getId(), GLOSSARY, GLOSSARY_TERM, relationship);
  }

  private void addParentRelationship(GlossaryTerm term) {
    if (term.getParent() != null) {
      addRelationship(
          term.getParent().getId(),
          term.getId(),
          GLOSSARY_TERM,
          GLOSSARY_TERM,
          Relationship.CONTAINS);
    }
  }

  private void validateHierarchy(GlossaryTerm term) {
    if (term.getParent() == null) {
      return;
    }

    if (term.getId() != null
        && term.getParent().getId() != null
        && term.getId().equals(term.getParent().getId())) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid hierarchy: Term '%s' cannot be its own parent",
              term.getFullyQualifiedName()));
    }

    // Check by FQN to catch cases where UUIDs might differ (e.g., CSV import with new UUID)
    if (term.getFullyQualifiedName() != null
        && term.getParent().getFullyQualifiedName() != null
        && term.getFullyQualifiedName().equals(term.getParent().getFullyQualifiedName())) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid hierarchy: Term '%s' cannot be its own parent",
              term.getFullyQualifiedName()));
    }

    // Check if term name matches parent name (catches CSV import circular reference)
    // Example: parent name = "term1", term name = "term1" indicates self-reference
    if (term.getName() != null
        && term.getParent().getName() != null
        && term.getName().equals(term.getParent().getName())) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid hierarchy: Term '%s' cannot be its own parent",
              term.getParent().getFullyQualifiedName()));
    }

    // Check for circular references by traversing the entire parent chain in the database
    // We track visited terms to detect cycles
    if (term.getId() != null && term.getParent().getId() != null) {
      Set<UUID> visitedTerms = new HashSet<>();
      visitedTerms.add(term.getId());
      UUID currentParentId = term.getParent().getId();

      while (currentParentId != null) {
        if (visitedTerms.contains(currentParentId)) {
          // Fqn is changed, so we need the old fqn for proper error message
          GlossaryTerm originalTerm =
              Entity.getEntity(GLOSSARY_TERM, term.getId(), "fullyQualifiedName", Include.ALL);
          throw new IllegalArgumentException(
              String.format(
                  "Circular reference detected: Cannot set parent relationship as it would create a cycle. "
                      + "Term '%s' (or one of its descendants) already exists in the parent chain.",
                  originalTerm.getFullyQualifiedName()));
        }

        visitedTerms.add(currentParentId);

        List<EntityRelationshipRecord> parentRelationships =
            daoCollection
                .relationshipDAO()
                .findFrom(
                    currentParentId, GLOSSARY_TERM, Relationship.CONTAINS.ordinal(), GLOSSARY_TERM);

        if (parentRelationships.isEmpty()) {
          break;
        }
        currentParentId = parentRelationships.getFirst().getId();
      }
    }
  }

  public static void checkUpdatedByReviewer(GlossaryTerm term, String updatedBy) {
    // Only list of allowed reviewers can change the status from DRAFT to APPROVED
    List<EntityReference> reviewers = term.getReviewers();
    if (!nullOrEmpty(reviewers)) {
      // Updating user must be one of the reviewers
      boolean isReviewer =
          reviewers.stream()
              .anyMatch(
                  e -> {
                    if (e.getType().equals(TEAM)) {
                      Team team =
                          Entity.getEntityByName(TEAM, e.getName(), "users", Include.NON_DELETED);
                      return team.getUsers().stream()
                          .anyMatch(
                              u ->
                                  u.getName().equals(updatedBy)
                                      || u.getFullyQualifiedName().equals(updatedBy));
                    } else {
                      return e.getName().equals(updatedBy)
                          || e.getFullyQualifiedName().equals(updatedBy);
                    }
                  });
      if (!isReviewer) {
        throw new AuthorizationException(notReviewer(updatedBy));
      }
    }
  }

  private void closeApprovalTask(GlossaryTerm entity, String comment) {
    EntityLink about = new EntityLink(GLOSSARY_TERM, entity.getFullyQualifiedName());
    FeedRepository feedRepository = Entity.getFeedRepository();
    try {
      Thread taskThread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      feedRepository.closeTask(
          taskThread, entity.getUpdatedBy(), new CloseTask().withComment(comment));
    } catch (EntityNotFoundException ex) {
      LOG.info(
          "{} Task not found for glossary term {}",
          TaskType.RequestApproval,
          entity.getFullyQualifiedName());
    }
  }

  private void updateAssetIndexes(String oldFqn, String newFqn) {
    searchRepository
        .getSearchClient()
        .updateGlossaryTermByFqnPrefix(GLOBAL_SEARCH_ALIAS, oldFqn, newFqn, TAGS_FQN);
  }

  private void updateEntityLinks(String oldFqn, String newFqn, GlossaryTerm updated) {
    daoCollection.fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);

    EntityLink newAbout = new EntityLink(GLOSSARY_TERM, newFqn);
    daoCollection.feedDAO().updateByEntityId(newAbout.getLinkString(), updated.getId().toString());

    List<EntityReference> childTerms =
        findTo(updated.getId(), GLOSSARY_TERM, Relationship.CONTAINS, GLOSSARY_TERM);

    for (EntityReference child : childTerms) {
      newAbout = new EntityLink(entityType, child.getFullyQualifiedName());
      daoCollection.feedDAO().updateByEntityId(newAbout.getLinkString(), child.getId().toString());
    }
  }

  private List<GlossaryTerm> getNestedTerms(GlossaryTerm glossaryTerm) {
    // Get all the hierarchically nested child terms of the glossary term
    List<String> jsons =
        daoCollection.glossaryTermDAO().getNestedTerms(glossaryTerm.getFullyQualifiedName());
    return JsonUtils.readObjects(jsons, GlossaryTerm.class);
  }

  protected void updateTaskWithNewReviewers(GlossaryTerm term) {
    try {
      MessageParser.EntityLink about =
          new MessageParser.EntityLink(GLOSSARY_TERM, term.getFullyQualifiedName());
      Thread originalTask =
          feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      term =
          Entity.getEntityByName(
              Entity.GLOSSARY_TERM,
              term.getFullyQualifiedName(),
              "id,fullyQualifiedName,reviewers",
              Include.ALL);

      Thread updatedTask = JsonUtils.deepCopy(originalTask, Thread.class);
      updatedTask.getTask().withAssignees(new ArrayList<>(term.getReviewers()));
      JsonPatch patch = JsonUtils.getJsonPatch(originalTask, updatedTask);
      RestUtil.PatchResponse<Thread> thread =
          feedRepository.patchThread(null, originalTask.getId(), updatedTask.getUpdatedBy(), patch);

      // Send WebSocket Notification
      WebsocketNotificationHandler.handleTaskNotification(thread.entity());
    } catch (EntityNotFoundException e) {
      LOG.info(
          "{} Task not found for glossary term {}",
          TaskType.RequestApproval,
          term.getFullyQualifiedName());
    }
  }

  private void fetchAndSetRelatedTerms(List<GlossaryTerm> entities, Fields fields) {
    if (!fields.contains("relatedTerms") || entities.isEmpty()) {
      return;
    }
    Set<String> termIdsSet =
        entities.stream().map(GlossaryTerm::getId).map(UUID::toString).collect(Collectors.toSet());

    List<CollectionDAO.EntityRelationshipObject> fromRecords =
        findFromRecordsBatch(termIdsSet, GLOSSARY_TERM, Relationship.RELATED_TO, GLOSSARY_TERM);
    List<CollectionDAO.EntityRelationshipObject> toRecords =
        findToRecordsBatch(
            termIdsSet, Entity.GLOSSARY_TERM, Relationship.RELATED_TO, Entity.GLOSSARY_TERM);

    Map<UUID, List<TermRelation>> relatedTermsMap = new HashMap<>();
    Set<String> processedPairs = new HashSet<>();

    for (CollectionDAO.EntityRelationshipObject rec : fromRecords) {
      UUID termId = UUID.fromString(rec.getFromId());
      UUID relatedTermId = UUID.fromString(rec.getToId());
      String relationType = extractRelationType(rec.getJson());
      String pairKey =
          termId.compareTo(relatedTermId) < 0
              ? termId + ":" + relatedTermId + ":" + relationType
              : relatedTermId + ":" + termId + ":" + relationType;

      LOG.debug(
          "fetchAndSetRelatedTerms fromRecord: fromId={}, toId={}, json={}, extractedType={}",
          rec.getFromId(),
          rec.getToId(),
          rec.getJson(),
          relationType);

      if (processedPairs.add(pairKey)) {
        EntityReference relatedRef =
            Entity.getEntityReferenceById(Entity.GLOSSARY_TERM, relatedTermId, Include.ALL);
        TermRelation relation =
            new TermRelation().withTerm(relatedRef).withRelationType(relationType);
        relatedTermsMap.computeIfAbsent(termId, k -> new ArrayList<>()).add(relation);

        String inverseType = getInverseRelationType(relationType);
        String reverseType = inverseType != null ? inverseType : relationType;
        EntityReference termRef =
            Entity.getEntityReferenceById(Entity.GLOSSARY_TERM, termId, Include.ALL);
        TermRelation reverseRelation =
            new TermRelation().withTerm(termRef).withRelationType(reverseType);
        relatedTermsMap.computeIfAbsent(relatedTermId, k -> new ArrayList<>()).add(reverseRelation);
      }
    }

    for (CollectionDAO.EntityRelationshipObject rec : toRecords) {
      UUID termId = UUID.fromString(rec.getToId());
      UUID relatedTermId = UUID.fromString(rec.getFromId());
      String relationType = extractRelationType(rec.getJson());
      String pairKey =
          termId.compareTo(relatedTermId) < 0
              ? termId + ":" + relatedTermId + ":" + relationType
              : relatedTermId + ":" + termId + ":" + relationType;

      LOG.debug(
          "fetchAndSetRelatedTerms toRecord: fromId={}, toId={}, json={}, extractedType={}",
          rec.getFromId(),
          rec.getToId(),
          rec.getJson(),
          relationType);

      if (processedPairs.add(pairKey)) {
        String inverseType = getInverseRelationType(relationType);
        String termRelType = inverseType != null ? inverseType : relationType;
        EntityReference relatedRef =
            Entity.getEntityReferenceById(Entity.GLOSSARY_TERM, relatedTermId, Include.ALL);
        TermRelation relation =
            new TermRelation().withTerm(relatedRef).withRelationType(termRelType);
        relatedTermsMap.computeIfAbsent(termId, k -> new ArrayList<>()).add(relation);

        EntityReference termRef =
            Entity.getEntityReferenceById(Entity.GLOSSARY_TERM, termId, Include.ALL);
        TermRelation reverseRelation =
            new TermRelation().withTerm(termRef).withRelationType(relationType);
        relatedTermsMap.computeIfAbsent(relatedTermId, k -> new ArrayList<>()).add(reverseRelation);
      }
    }

    for (List<TermRelation> relations : relatedTermsMap.values()) {
      relations.sort(Comparator.comparing(tr -> tr.getTerm().getFullyQualifiedName()));
    }

    if (!relatedTermsMap.isEmpty()) {
      for (GlossaryTerm term : entities) {
        List<TermRelation> relatedTerms =
            relatedTermsMap.getOrDefault(term.getId(), Collections.emptyList());
        term.setRelatedTerms(relatedTerms);
      }
    }
  }

  private String extractRelationType(String json) {
    if (json == null) {
      LOG.debug("extractRelationType: json is null, returning default 'relatedTo'");
      return "relatedTo";
    }
    try {
      Map<String, Object> jsonMap = JsonUtils.readValue(json, Map.class);
      if (jsonMap.containsKey("relationType")) {
        String relationType = (String) jsonMap.get("relationType");
        LOG.debug("extractRelationType: found relationType='{}' in json='{}'", relationType, json);
        return relationType;
      }
      LOG.debug("extractRelationType: no relationType key in json='{}', returning default", json);
    } catch (Exception e) {
      LOG.debug("extractRelationType: Failed to parse json='{}', error: {}", json, e.getMessage());
    }
    return "relatedTo";
  }

  private void fetchAndSetParentOrGlossary(List<GlossaryTerm> terms, Fields fields) {
    if (terms == null || terms.isEmpty()) {
      return;
    }

    List<String> entityIds =
        terms.stream().map(GlossaryTerm::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> parentRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityIds, Relationship.CONTAINS.ordinal(), entityType, entityType);

    Map<UUID, EntityReference> parentMap = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject rec : parentRecords) {
      parentMap.put(
          UUID.fromString(rec.getToId()),
          Entity.getEntityReferenceById(
              rec.getFromEntity(), UUID.fromString(rec.getFromId()), ALL));
    }

    // Set parent references on GlossaryTerms
    for (GlossaryTerm term : terms) {
      EntityReference parentRef = parentMap.get(term.getId());
      if (parentRef != null) {
        term.setParent(parentRef);
      }
    }

    List<String> hasRelationIds =
        terms.stream()
            .filter(term -> term.getParent() != null)
            .map(GlossaryTerm::getId)
            .map(UUID::toString)
            .toList();

    List<String> containsRelationIds =
        terms.stream()
            .filter(term -> term.getParent() == null)
            .map(GlossaryTerm::getId)
            .map(UUID::toString)
            .toList();

    List<CollectionDAO.EntityRelationshipObject> hasRecords = Collections.emptyList();
    if (!hasRelationIds.isEmpty()) {
      hasRecords =
          daoCollection
              .relationshipDAO()
              .findFromBatch(hasRelationIds, Relationship.HAS.ordinal(), GLOSSARY);
    }

    List<CollectionDAO.EntityRelationshipObject> containsRecords = Collections.emptyList();
    if (!containsRelationIds.isEmpty()) {
      containsRecords =
          daoCollection
              .relationshipDAO()
              .findFromBatch(containsRelationIds, Relationship.CONTAINS.ordinal(), GLOSSARY);
    }

    List<CollectionDAO.EntityRelationshipObject> allRecords = new ArrayList<>();
    allRecords.addAll(hasRecords);
    allRecords.addAll(containsRecords);

    // Map to entity ID -> glossary reference
    Map<UUID, EntityReference> glossaryMap = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject rec : allRecords) {
      glossaryMap.put(
          UUID.fromString(rec.getToId()),
          Entity.getEntityReferenceById(
              rec.getFromEntity(), UUID.fromString(rec.getFromId()), ALL));
    }

    for (GlossaryTerm term : terms) {
      EntityReference glossaryRef = glossaryMap.get(term.getId());
      if (glossaryRef != null) {
        term.setGlossary(glossaryRef);
      }
    }
  }

  private void fetchAndSetUsageCount(List<GlossaryTerm> entities, Fields fields) {
    if (!fields.contains("usageCount") || entities.isEmpty()) {
      return;
    }
    // TODO: modify to use a single db query
    for (GlossaryTerm entity : entities) {
      entity.withUsageCount(getUsageCount(entity));
    }
  }

  private void fetchAndSetChildrenCount(List<GlossaryTerm> entities, Fields fields) {
    if (!fields.contains("childrenCount") || entities.isEmpty()) {
      return;
    }

    // Count all nested terms using FQN prefix matching for efficiency
    for (GlossaryTerm entity : entities) {
      int count = daoCollection.glossaryTermDAO().countNestedTerms(entity.getFullyQualifiedName());
      entity.setChildrenCount(count);
    }
  }

  private void checkDuplicateTerms(GlossaryTerm entity) {
    int count =
        daoCollection
            .glossaryTermDAO()
            .getGlossaryTermCountIgnoreCase(
                entity.getGlossary().getFullyQualifiedName(), entity.getName());
    if (count > 0) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.duplicateGlossaryTerm(
              entity.getName(), entity.getGlossary().getFullyQualifiedName()));
    }
  }

  private void checkDuplicateTermsForUpdate(GlossaryTerm original, GlossaryTerm updated) {
    if (!original.getName().equals(updated.getName())) {
      int count =
          daoCollection
              .glossaryTermDAO()
              .getGlossaryTermCountIgnoreCaseExcludingId(
                  updated.getGlossary().getFullyQualifiedName(),
                  updated.getName(),
                  original.getId().toString());
      if (count > 0) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.duplicateGlossaryTerm(
                updated.getName(), updated.getGlossary().getFullyQualifiedName()));
      }
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class GlossaryTermUpdater extends EntityUpdater {
    private boolean renameProcessed = false;

    public GlossaryTermUpdater(GlossaryTerm original, GlossaryTerm updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      validateParent();
      compareAndUpdate(
          "synonyms",
          () -> {
            updateSynonyms(original, updated);
          });
      compareAndUpdate(
          "references",
          () -> {
            updateReferences(original, updated);
          });
      compareAndUpdate(
          "relatedTerms",
          () -> {
            updateRelatedTerms(original, updated);
          });
      compareAndUpdateAny(() -> updateNameAndParent(updated), "name", "parent", "glossary");
      // Mutually exclusive cannot be updated
      updated.setMutuallyExclusive(original.getMutuallyExclusive());
    }

    /**
     * Move a glossary term to a new parent or glossary. Only parent or glossary can be changed.
     */
    @Transaction
    public void moveAndStore() {
      changeDescription = new ChangeDescription().withPreviousVersion(original.getVersion());
      // Now updated from previous/original to updated one
      validateParent();
      updateParent(original, updated); // Only update parent/glossary and FQN/relationships
      storeUpdate();
      postUpdate(original, updated);
    }

    private boolean validateIfTagsAreEqual(
        List<TagLabel> originalTags, List<TagLabel> updatedTags) {
      Set<String> originalTagsFqn =
          listOrEmpty(originalTags).stream()
              .map(TagLabel::getTagFQN)
              .collect(Collectors.toCollection(TreeSet::new));
      Set<String> updatedTagsFqn =
          listOrEmpty(updatedTags).stream()
              .map(TagLabel::getTagFQN)
              .collect(Collectors.toCollection(TreeSet::new));

      // Validate if both are exactly equal
      return originalTagsFqn.equals(updatedTagsFqn);
    }

    @Override
    protected void updateTags(
        String fqn, String fieldName, List<TagLabel> origTags, List<TagLabel> updatedTags) {
      // Remove current entity tags in the database. It will be added back later from the merged tag
      // list.
      origTags = listOrEmpty(origTags);
      // updatedTags cannot be immutable list, as we are adding the origTags to updatedTags even if
      // its empty.
      updatedTags = Optional.ofNullable(updatedTags).orElse(new ArrayList<>());
      if (!(origTags.isEmpty() && updatedTags.isEmpty())
          && !validateIfTagsAreEqual(origTags, updatedTags)) {
        List<String> targetFQNHashes = daoCollection.tagUsageDAO().getTargetFQNHashForTag(fqn);
        for (String fqnHash : targetFQNHashes) {
          Map<String, List<TagLabel>> allAssetTags =
              daoCollection.tagUsageDAO().getTagsByPrefix(fqnHash, "%", false);

          // Assets FQN is not available / we can use fqnHash for now
          checkMutuallyExclusiveForParentAndSubField("", fqnHash, allAssetTags, updatedTags, true);
        }

        // Remove current entity tags in the database. It will be added back later from the merged
        // tag
        // list.
        daoCollection.tagUsageDAO().deleteTagsByTarget(fqn);

        if (operation.isPut()) {
          // PUT operation merges tags in the request with what already exists
          EntityUtil.mergeTags(updatedTags, origTags);
          checkMutuallyExclusive(updatedTags);
        }

        List<TagLabel> addedTags = new ArrayList<>();
        List<TagLabel> deletedTags = new ArrayList<>();
        recordListChange(fieldName, origTags, updatedTags, addedTags, deletedTags, tagLabelMatch);
        updatedTags.sort(compareTagLabel);
        applyTags(updatedTags, fqn);
      }
    }

    private void updateSynonyms(GlossaryTerm origTerm, GlossaryTerm updatedTerm) {
      List<String> origSynonyms = listOrEmpty(origTerm.getSynonyms());
      List<String> updatedSynonyms = listOrEmpty(updatedTerm.getSynonyms());

      List<String> added = new ArrayList<>();
      List<String> deleted = new ArrayList<>();
      recordListChange("synonyms", origSynonyms, updatedSynonyms, added, deleted, stringMatch);
    }

    private void updateReferences(GlossaryTerm origTerm, GlossaryTerm updatedTerm) {
      List<TermReference> origReferences = listOrEmpty(origTerm.getReferences());
      List<TermReference> updatedReferences = listOrEmpty(updatedTerm.getReferences());

      List<TermReference> added = new ArrayList<>();
      List<TermReference> deleted = new ArrayList<>();
      recordListChange(
          "references", origReferences, updatedReferences, added, deleted, termReferenceMatch);
    }

    private void updateRelatedTerms(GlossaryTerm origTerm, GlossaryTerm updatedTerm) {
      List<TermRelation> origRelated = listOrEmpty(origTerm.getRelatedTerms());
      List<TermRelation> updatedRelated = listOrEmpty(updatedTerm.getRelatedTerms());

      List<TermRelation> added = new ArrayList<>();
      List<TermRelation> deleted = new ArrayList<>();

      recordListChange(
          "relatedTerms",
          origRelated,
          updatedRelated,
          added,
          deleted,
          (tr1, tr2) ->
              tr1.getTerm().getId().equals(tr2.getTerm().getId())
                  && Objects.equals(tr1.getRelationType(), tr2.getRelationType()));

      for (TermRelation termRelation : deleted) {
        String delRelationType =
            termRelation.getRelationType() != null ? termRelation.getRelationType() : "relatedTo";
        deleteBidirectionalRelatedTo(
            origTerm.getId(), termRelation.getTerm().getId(), delRelationType);
        RdfUpdater.removeGlossaryTermRelation(
            origTerm.getId(), termRelation.getTerm().getId(), delRelationType);
      }

      validateRelationCardinality(origTerm.getId(), added);

      for (TermRelation termRelation : added) {
        String relationType =
            termRelation.getRelationType() != null ? termRelation.getRelationType() : "relatedTo";
        validateRelationType(relationType);
        UUID toId = termRelation.getTerm().getId();
        String canonicalType = computeCanonicalRelationType(origTerm.getId(), toId, relationType);
        String json = String.format("{\"relationType\":\"%s\"}", canonicalType);
        addRelationship(
            origTerm.getId(),
            toId,
            GLOSSARY_TERM,
            GLOSSARY_TERM,
            Relationship.RELATED_TO,
            json,
            true);
        RdfUpdater.addGlossaryTermRelation(origTerm.getId(), toId, relationType);
      }

      updatedTerm.setRelatedTerms(updatedRelated.isEmpty() ? null : updatedRelated);
    }

    /**
     * Handle name and parent changes together using getOriginalFqn() for correct FQN tracking.
     * This ensures that during change consolidation, we use the correct original FQN.
     */
    public void updateNameAndParent(GlossaryTerm updated) {
      UUID oldParentId = getId(original.getParent());
      UUID newParentId = getId(updated.getParent());
      final boolean parentChanged = !Objects.equals(oldParentId, newParentId);

      UUID oldGlossaryId = getId(original.getGlossary());
      UUID newGlossaryId = getId(updated.getGlossary());
      final boolean glossaryChanged = !Objects.equals(oldGlossaryId, newGlossaryId);

      String oldFqn = getOriginalFqn();
      setFullyQualifiedName(updated);
      String newFqn = updated.getFullyQualifiedName();

      if (oldFqn.equals(newFqn)) {
        return;
      }

      if (renameProcessed) {
        return;
      }
      renameProcessed = true;

      if (ProviderType.SYSTEM.equals(original.getProvider())) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
      }

      String[] oldParts = FullyQualifiedName.split(oldFqn);
      String oldTermName = oldParts.length > 0 ? oldParts[oldParts.length - 1] : oldFqn;
      boolean nameChanged = !oldTermName.equals(updated.getName());

      if (nameChanged) {
        checkDuplicateTermsForUpdate(original, updated);
      }

      LOG.info("Glossary term FQN changed from {} to {}", oldFqn, newFqn);
      daoCollection.glossaryTermDAO().updateFqn(oldFqn, newFqn);
      daoCollection.tagUsageDAO().rename(TagSource.GLOSSARY.ordinal(), oldFqn, newFqn);

      daoCollection.tagUsageDAO().deleteTagsByTarget(oldFqn);
      List<TagLabel> updatedTags = updated.getTags();
      updatedTags.sort(compareTagLabel);
      applyTags(updatedTags, newFqn);
      daoCollection
          .tagUsageDAO()
          .renameByTargetFQNHash(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);

      updateEntityLinks(oldFqn, newFqn, updated);

      if (nameChanged) {
        recordChange("name", oldTermName, updated.getName());
      }

      if (glossaryChanged) {
        updateGlossaryRelationship(original, updated);
        updateChildrenGlossaryRelationships(original, updated);
        recordChange(
            "glossary", original.getGlossary(), updated.getGlossary(), true, entityReferenceMatch);
      }

      if (parentChanged) {
        updateGlossaryRelationship(original, updated);
        updateParentRelationship(original, updated);
        recordChange(
            "parent", original.getParent(), updated.getParent(), true, entityReferenceMatch);
      }

      if (parentChanged || glossaryChanged || nameChanged) {
        invalidateTerm(updated.getId());
        updateAssetIndexes(oldFqn, newFqn);
      }
    }

    /**
     * Update parent/glossary relationships. Used by moveAndStore() for move operations.
     */
    private void updateParent(GlossaryTerm original, GlossaryTerm updated) {
      // Can't change parent and glossary both at the same time
      UUID oldParentId = getId(original.getParent());
      UUID newParentId = getId(updated.getParent());
      final boolean parentChanged = !Objects.equals(oldParentId, newParentId);

      UUID oldGlossaryId = getId(original.getGlossary());
      UUID newGlossaryId = getId(updated.getGlossary());
      final boolean glossaryChanged = !Objects.equals(oldGlossaryId, newGlossaryId);

      if (!parentChanged && !glossaryChanged) {
        return;
      }

      // Use getOriginalFqn() for correct FQN tracking during change consolidation
      String oldFqn = getOriginalFqn();
      setFullyQualifiedName(updated);
      String newFqn = updated.getFullyQualifiedName();

      daoCollection.glossaryTermDAO().updateFqn(oldFqn, newFqn);
      daoCollection.tagUsageDAO().rename(TagSource.GLOSSARY.ordinal(), oldFqn, newFqn);

      // update tags
      daoCollection.tagUsageDAO().deleteTagsByTarget(oldFqn);
      List<TagLabel> updatedTags = updated.getTags();
      updatedTags.sort(compareTagLabel);
      applyTags(updatedTags, newFqn);

      daoCollection
          .tagUsageDAO()
          .renameByTargetFQNHash(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);

      updateEntityLinks(oldFqn, newFqn, updated);

      if (glossaryChanged) {
        updateGlossaryRelationship(original, updated);
        updateChildrenGlossaryRelationships(original, updated);
        recordChange(
            "glossary", original.getGlossary(), updated.getGlossary(), true, entityReferenceMatch);
        invalidateTerm(updated.getId());
      }
      if (parentChanged) {
        updateGlossaryRelationship(original, updated);
        updateParentRelationship(original, updated);
        recordChange(
            "parent", original.getParent(), updated.getParent(), true, entityReferenceMatch);
        invalidateTerm(updated.getId());
      }
      updateAssetIndexes(oldFqn, newFqn);
    }

    private void validateParent() {
      String fqn = original.getFullyQualifiedName();
      String newParentFqn =
          updated.getParent() == null ? null : updated.getParent().getFullyQualifiedName();
      // A glossary term can't be moved under its child
      if (newParentFqn != null && FullyQualifiedName.isParent(newParentFqn, fqn)) {
        throw new IllegalArgumentException(invalidGlossaryTermMove(fqn, newParentFqn));
      }
    }

    private void updateGlossaryRelationship(GlossaryTerm orig, GlossaryTerm updated) {
      deleteGlossaryRelationship(orig);
      addGlossaryRelationship(updated);
    }

    private void deleteGlossaryRelationship(GlossaryTerm term) {
      Relationship relationship =
          term.getParent() == null ? Relationship.CONTAINS : Relationship.HAS;
      deleteRelationship(
          term.getGlossary().getId(), GLOSSARY, term.getId(), GLOSSARY_TERM, relationship);
    }

    private void updateParentRelationship(GlossaryTerm orig, GlossaryTerm updated) {
      deleteParentRelationship(orig);
      addParentRelationship(updated);
    }

    private void deleteParentRelationship(GlossaryTerm term) {
      if (term.getParent() != null) {
        deleteRelationship(
            term.getParent().getId(),
            GLOSSARY_TERM,
            term.getId(),
            GLOSSARY_TERM,
            Relationship.CONTAINS);
      }
    }

    private void updateChildrenGlossaryRelationships(GlossaryTerm original, GlossaryTerm updated) {
      List<GlossaryTerm> nestedTerms = getNestedTerms(updated);
      if (nestedTerms.isEmpty()) {
        return;
      }

      List<String> childIds =
          nestedTerms.stream().map(GlossaryTerm::getId).map(UUID::toString).toList();

      daoCollection
          .relationshipDAO()
          .bulkUpdateFromId(
              original.getGlossary().getId(),
              updated.getGlossary().getId(),
              childIds,
              GLOSSARY,
              GLOSSARY_TERM,
              Relationship.HAS.ordinal());

      LOG.info(
          "Updated glossary relationships for {} nested terms from {} to {}",
          childIds.size(),
          original.getGlossary().getFullyQualifiedName(),
          updated.getGlossary().getFullyQualifiedName());
    }

    private void invalidateTerm(UUID termId) {
      // The name of the glossary term changed or parent change. Invalidate that tag and all the
      // children from the cache
      invalidateTerm(termId, new HashSet<>());
    }

    private void invalidateTerm(UUID termId, Set<UUID> visited) {
      if (visited.contains(termId)) {
        return;
      }
      visited.add(termId);
      List<EntityRelationshipRecord> tagRecords =
          findToRecords(termId, GLOSSARY_TERM, Relationship.CONTAINS, GLOSSARY_TERM);
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(GLOSSARY_TERM, termId));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTerm(tagRecord.getId(), visited);
      }
    }
  }

  private void deleteBidirectionalRelatedTo(UUID termA, UUID termB, String relationType) {
    UUID from = termA;
    UUID to = termB;
    String canonicalType = relationType;
    if (from.compareTo(to) > 0) {
      from = termB;
      to = termA;
      String inverse = getInverseRelationType(relationType);
      if (inverse != null) {
        canonicalType = inverse;
      }
    }
    daoCollection
        .relationshipDAO()
        .deleteWithRelationType(
            from,
            GLOSSARY_TERM,
            to,
            GLOSSARY_TERM,
            Relationship.RELATED_TO.ordinal(),
            canonicalType);
  }

  private void deleteAllBidirectionalRelatedTo(UUID termA, UUID termB) {
    UUID from = termA;
    UUID to = termB;
    if (from.compareTo(to) > 0) {
      from = termB;
      to = termA;
    }
    daoCollection
        .relationshipDAO()
        .delete(from, GLOSSARY_TERM, to, GLOSSARY_TERM, Relationship.RELATED_TO.ordinal());
  }

  public ResultList<GlossaryTerm> searchGlossaryTermsById(
      UUID glossaryId,
      String query,
      int limit,
      int offset,
      String fieldsParam,
      Include include,
      String entityStatus) {
    Glossary glossary =
        Entity.getEntity(GLOSSARY, glossaryId, "id,name,fullyQualifiedName", include);
    return searchGlossaryTermsInternal(
        glossary.getFullyQualifiedName(), query, limit, offset, fieldsParam, include, entityStatus);
  }

  public ResultList<GlossaryTerm> searchGlossaryTermsByFQN(
      String glossaryFqn,
      String query,
      int limit,
      int offset,
      String fieldsParam,
      Include include,
      String entityStatus) {
    return searchGlossaryTermsInternal(
        glossaryFqn, query, limit, offset, fieldsParam, include, entityStatus);
  }

  public ResultList<GlossaryTerm> searchGlossaryTermsByParentId(
      UUID parentId,
      String query,
      int limit,
      int offset,
      String fieldsParam,
      Include include,
      String entityStatus) {
    GlossaryTerm parentTerm =
        Entity.getEntity(GLOSSARY_TERM, parentId, "id,name,fullyQualifiedName,glossary", include);
    return searchGlossaryTermsInternal(
        parentTerm.getFullyQualifiedName(),
        query,
        limit,
        offset,
        fieldsParam,
        include,
        entityStatus);
  }

  public ResultList<GlossaryTerm> searchGlossaryTermsByParentFQN(
      String parentFqn,
      String query,
      int limit,
      int offset,
      String fieldsParam,
      Include include,
      String entityStatus) {
    return searchGlossaryTermsInternal(
        parentFqn, query, limit, offset, fieldsParam, include, entityStatus);
  }

  private String prepareSearchTerm(String query) {
    // For LIKE queries, add wildcards
    return "%" + query.trim() + "%";
  }

  private ResultList<GlossaryTerm> searchGlossaryTermsInternal(
      String parentFqn,
      String query,
      int limit,
      int offset,
      String fieldsParam,
      Include include,
      String entityStatus) {

    CollectionDAO.GlossaryTermDAO dao = daoCollection.glossaryTermDAO();

    // Build the parent hash for filtering
    String parentHash = parentFqn != null ? FullyQualifiedName.buildHash(parentFqn) + ".%" : "%";

    // If no search query, use regular listing
    if (query == null || query.trim().isEmpty()) {
      ListFilter filter = new ListFilter(include);
      if (parentFqn != null) {
        filter.addQueryParam("parent", parentFqn);
      }
      if (entityStatus != null && !entityStatus.isEmpty()) {
        filter.addQueryParam("entityStatus", entityStatus);
      }

      // Use cursor-based pagination with limit and convert offset to cursor
      String afterCursor = offset > 0 ? String.valueOf(offset) : null;
      ResultList<GlossaryTerm> result =
          listAfter(null, getFields(fieldsParam), filter, limit, afterCursor);

      // Convert pagination info
      String before = offset > 0 ? String.valueOf(Math.max(0, offset - limit)) : null;
      String after =
          result.getPaging() != null && result.getPaging().getAfter() != null
              ? String.valueOf(offset + limit)
              : null;
      int total =
          result.getPaging() != null ? result.getPaging().getTotal() : result.getData().size();

      return new ResultList<>(result.getData(), before, after, total);
    }

    // For search queries, fetch limit+1 to determine if there are more pages
    // Prepare search term for full-text search
    String searchTerm = prepareSearchTerm(query.trim());

    // Build status condition (validate against enum to prevent SQL injection)
    String statusCondition = "";
    if (entityStatus != null && !entityStatus.isBlank()) {
      Set<String> validStatuses =
          Arrays.stream(EntityStatus.values()).map(EntityStatus::value).collect(Collectors.toSet());
      String validatedStatuses =
          Arrays.stream(entityStatus.split(","))
              .map(String::trim)
              .filter(Predicate.not(String::isEmpty))
              .filter(validStatuses::contains)
              .map(s -> "'" + s + "'")
              .collect(Collectors.joining(","));
      if (!validatedStatuses.isEmpty()) {
        statusCondition = "AND entityStatus IN (" + validatedStatuses + ")";
      }
    }

    // Fetch limit+1 records to check if there's a next page
    List<String> jsons =
        dao.searchGlossaryTerms(parentHash, searchTerm, statusCondition, limit + 1, offset);

    // Check if we have more than limit results
    boolean hasMore = jsons.size() > limit;
    if (hasMore) {
      // Remove the extra record
      jsons = jsons.subList(0, limit);
    }

    List<GlossaryTerm> terms = new ArrayList<>();
    for (String json : jsons) {
      GlossaryTerm term = JsonUtils.readValue(json, GlossaryTerm.class);
      terms.add(term);
    }

    // Use bulk method for efficient field fetching
    setFieldsInBulk(getFields(fieldsParam), terms);

    // Set up pagination info
    String before = offset > 0 ? String.valueOf(Math.max(0, offset - limit)) : null;
    String after = hasMore ? String.valueOf(offset + limit) : null;

    // For the total count, we only know it's at least offset + terms.size() + (hasMore ? 1 : 0)
    // This is sufficient for pagination without the expensive COUNT query
    int knownTotal = offset + terms.size() + (hasMore ? 1 : 0);

    return new ResultList<>(terms, before, after, knownTotal);
  }

  /**
   * Validate a move operation before executing it. This should be called synchronously
   * before submitting the actual move to async executor.
   */
  public void validateMoveOperation(UUID termId, MoveGlossaryTermRequest moveRequest) {
    if (moveRequest == null || moveRequest.getParent() == null) {
      return; // Nothing to validate
    }

    // Get the term being moved
    GlossaryTerm term =
        Entity.getEntity(
            GLOSSARY_TERM, termId, "id,name,fullyQualifiedName,parent,glossary", Include.ALL);

    // Create a temporary term object with the new parent to validate the hierarchy
    GlossaryTerm tempTerm = JsonUtils.deepCopy(term, GlossaryTerm.class);

    EntityReference parent = moveRequest.getParent();
    if (parent.getType().equals(GLOSSARY)) {
      // Moving to root of glossary - no circular reference possible
      tempTerm.setParent(null);
    } else if (parent.getType().equals(GLOSSARY_TERM)) {
      // Moving under another glossary term - validate no circular reference
      GlossaryTerm parentTerm =
          Entity.getEntity(
              GLOSSARY_TERM, parent.getId(), "id,name,fullyQualifiedName,glossary", Include.ALL);
      tempTerm.setParent(parentTerm.getEntityReference());

      // This will throw IllegalArgumentException if circular reference detected
      validateHierarchy(tempTerm);
    } else {
      throw new IllegalArgumentException("Invalid parent type: " + parent.getType());
    }
  }

  /**
   * Move a glossary term to a new parent or glossary. Only parent or glossary can be changed.
   */
  public GlossaryTerm moveGlossaryTerm(UUID id, MoveGlossaryTermRequest moveRequest, String user) {
    if (moveRequest == null || moveRequest.getParent() == null) {
      return null; // Nothing to move
    }
    GlossaryTerm original =
        Entity.getEntity(
            GLOSSARY_TERM,
            id,
            "id,name,fullyQualifiedName,parent,glossary,tags,reviewers,entityStatus",
            Include.ALL);
    GlossaryTerm updated = JsonUtils.deepCopy(original, GlossaryTerm.class);

    EntityReference parent = moveRequest.getParent();
    if (parent.getType().equalsIgnoreCase("glossary")) {
      // Move to root of the glossary
      Glossary glossary =
          Entity.getEntity(GLOSSARY, parent.getId(), "id,name,fullyQualifiedName", Include.ALL);
      updated.setParent(null);
      updated.setGlossary(glossary.getEntityReference());
    } else if (parent.getType().equalsIgnoreCase("glossaryTerm")) {
      // Can be of same glossary or a different glossary
      GlossaryTerm parentTerm =
          Entity.getEntity(
              GLOSSARY_TERM, parent.getId(), "id,name,fullyQualifiedName,glossary", Include.ALL);
      updated.setParent(parentTerm.getEntityReference());
      Glossary glossary =
          Entity.getEntity(
              GLOSSARY,
              parentTerm.getGlossary().getId(),
              "id,name,fullyQualifiedName",
              Include.ALL);
      updated.setGlossary(glossary.getEntityReference());
    } else {
      throw new IllegalArgumentException("Invalid parent type: " + parent.getType());
    }
    updated.setUpdatedBy(user);
    updated.setUpdatedAt(System.currentTimeMillis());
    GlossaryTermUpdater updater = new GlossaryTermUpdater(original, updated, Operation.PUT);
    updater.moveAndStore();
    if (updated.getChangeDescription() != null
        && !isNullOrEmptyChangeDescription(updated.getChangeDescription())) {
      try {
        ChangeEvent changeEvent =
            new ChangeEvent()
                .withId(UUID.randomUUID())
                .withEventType(EventType.ENTITY_UPDATED)
                .withEntityType(entityType)
                .withEntityId(updated.getId())
                .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
                .withUserName(updated.getUpdatedBy())
                .withPreviousVersion(original.getVersion())
                .withCurrentVersion(updated.getVersion())
                .withTimestamp(System.currentTimeMillis())
                .withEntity(updated);
        Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
      } catch (Exception e) {
        LOG.error("Failed to insert change event for async move operation", e);
      }
    }
    return updated;
  }

  @Override
  public RestUtil.PutResponse<GlossaryTerm> createOrUpdateForImport(
      UriInfo uriInfo, GlossaryTerm updated, String updatedBy) {

    GlossaryTerm original = findByNameOrNull(updated.getFullyQualifiedName(), Include.ALL);

    // Glossary term's parent can change which alters its FQN. If the FQN lookup fails, try
    // locating the term by (glossary, name) combination.
    if (original == null) {
      try {
        String existingTermString =
            Entity.getCollectionDAO()
                .glossaryTermDAO()
                .getGlossaryTermByNameAndGlossaryIgnoreCase(
                    updated.getGlossary().getFullyQualifiedName(), updated.getName());
        if (existingTermString != null && !existingTermString.isEmpty()) {
          original = JsonUtils.readValue(existingTermString, GlossaryTerm.class);
        }
      } catch (Exception ignored) {
      }
    }

    if (original == null) {
      return new RestUtil.PutResponse<>(
          Response.Status.CREATED, withHref(uriInfo, createNewEntity(updated)), ENTITY_CREATED);
    }

    return updateForImport(uriInfo, original, updated, updatedBy);
  }

  @Override
  public GlossaryTerm findMatchForImport(GlossaryTerm entity) {
    GlossaryTerm original = super.findMatchForImport(entity);
    if (original != null) {
      return original;
    }

    // A glossary term may have been moved to a different parent causing its FQN to change. So check
    // with name field
    String existingTermJson =
        daoCollection
            .glossaryTermDAO()
            .getGlossaryTermByNameAndGlossaryIgnoreCase(
                entity.getGlossary().getFullyQualifiedName(), entity.getName());
    if (existingTermJson != null && !existingTermJson.isEmpty()) {
      return JsonUtils.readValue(existingTermJson, GlossaryTerm.class);
    }
    return null;
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    return exportToCsv(name, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    Fields fields =
        getFields("owners,reviewers,tags,relatedTerms,synonyms,references,extension,parent");
    GlossaryTerm glossaryTerm = getByName(null, name, fields);
    GlossaryRepository glossaryRepository =
        (GlossaryRepository) Entity.getEntityRepository(GLOSSARY);
    Glossary glossary =
        glossaryRepository.get(null, glossaryTerm.getGlossary().getId(), Fields.EMPTY_FIELDS);

    List<GlossaryTerm> terms = listAllForCSV(fields, glossaryTerm.getFullyQualifiedName());

    terms.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return new GlossaryRepository.GlossaryCsv(glossary, user).exportCsv(terms, callback);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    return importFromCsv(name, csv, dryRun, user, recursive, (CsvImportProgressCallback) null);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      CsvImportProgressCallback callback)
      throws IOException {
    GlossaryTerm glossaryTerm = getByName(null, name, Fields.EMPTY_FIELDS);
    GlossaryRepository glossaryRepository =
        (GlossaryRepository) Entity.getEntityRepository(GLOSSARY);

    Glossary glossary =
        glossaryRepository.getByName(
            null, glossaryTerm.getGlossary().getName(), Fields.EMPTY_FIELDS);
    GlossaryRepository.GlossaryCsv glossaryCsv = new GlossaryRepository.GlossaryCsv(glossary, user);
    return glossaryCsv.importCsv(csv, dryRun, callback);
  }
}
