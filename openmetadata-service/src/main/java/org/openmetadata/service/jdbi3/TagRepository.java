/*
 *  Copyright 2021 Collate
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
package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.CLASSIFICATION;
import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusiveForParentAndSubField;
import static org.openmetadata.service.resources.tags.TagLabelUtil.getUniqueTags;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.getId;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.BulkAssetsRequestInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.AddTagToAssetsRequest;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.metadata.EntityTagAssetRemoval;
import org.openmetadata.service.entity.metadata.EntityTagWriter;
import org.openmetadata.service.entity.metadata.EntityTagWriter.Target;
import org.openmetadata.service.entity.metadata.InheritedReferences;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityCursor;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.exception.BadCursorException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.resources.tags.TagResource;
import org.openmetadata.service.search.DefaultInheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldQuery;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldResult;
import org.openmetadata.service.search.PropagationDescriptor;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Repository()
public class TagRepository implements EntityPolicy<Tag> {

  private final EntityTagAssetRemoval tagAssetRemoval =
      new EntityTagAssetRemoval(
          () -> context().dependencies().daos().tagUsageDAO(),
          target ->
              EntityCaches.invalidations()
                  .metadataChanged(target.type(), target.id(), target.fqn()),
          target ->
              context()
                  .dependencies()
                  .search()
                  .updateEntity(
                      new EntityReference()
                          .withType(target.type())
                          .withId(target.id())
                          .withFullyQualifiedName(target.fqn())));

  private InheritedFieldEntitySearch inheritedFieldEntitySearch;

  public TagRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                TagResource.TAG_COLLECTION_PATH,
                Entity.TAG,
                Tag.class,
                Entity.getCollectionDAO().tagDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    context().options().setRenameAllowed(true);
    // Initialize inherited field search
    if (context().dependencies().search() != null) {
      inheritedFieldEntitySearch =
          new DefaultInheritedFieldEntitySearch(context().dependencies().search());
    }
  }

  @Override
  public List<PropagationDescriptor> getSearchPropagationDescriptors() {
    List<PropagationDescriptor> descriptors =
        new ArrayList<>(EntityPolicy.super.getSearchPropagationDescriptors());
    descriptors.add(
        new PropagationDescriptor(
            FIELD_NAME, PropagationDescriptor.PropagationType.SIMPLE_VALUE, null));
    descriptors.add(
        new PropagationDescriptor(
            FIELD_CERTIFICATION, PropagationDescriptor.PropagationType.SIMPLE_VALUE, null));
    return descriptors;
  }

  public ResultList<EntityReference> getTagAssets(UUID tagId, int limit, int offset) {
    Tag tag =
        reads()
            .byId(
                tagId,
                new EntityReadService.Query(
                    null,
                    fieldPolicy().parse("id,fullyQualifiedName"),
                    RelationIncludes.fromInclude(Include.NON_DELETED),
                    false));
    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search is unavailable for tag assets. Returning empty list.");
      return new ResultList<>(new ArrayList<>(), null, null, 0);
    }
    InheritedFieldQuery query =
        InheritedFieldQuery.forTag(tag.getFullyQualifiedName(), offset, limit);
    InheritedFieldResult result =
        inheritedFieldEntitySearch.getEntitiesForField(
            query,
            () -> {
              LOG.warn(
                  "Search fallback for tag {} assets. Returning empty list.",
                  tag.getFullyQualifiedName());
              return new InheritedFieldResult(new ArrayList<>(), 0);
            });
    return new ResultList<>(result.entities(), null, null, result.total());
  }

  public ResultList<EntityReference> getTagAssetsByName(String tagName, int limit, int offset) {
    Tag tag = getByName(null, tagName, fieldPolicy().parse("id,fullyQualifiedName"));
    return getTagAssets(tag.getId(), limit, offset);
  }

  public Map<String, Integer> getAllTagsWithAssetsCount() {
    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search unavailable for tag asset counts");
      return new HashMap<>();
    }
    List<Tag> allTags =
        collections().all(fieldPolicy().parse("fullyQualifiedName"), new ListFilter(null));
    Map<String, Integer> tagAssetCounts = new LinkedHashMap<>();
    for (Tag tag : allTags) {
      InheritedFieldQuery query = InheritedFieldQuery.forTag(tag.getFullyQualifiedName(), 0, 0);
      Integer count =
          inheritedFieldEntitySearch.getCountForField(
              query,
              () -> {
                LOG.warn(
                    "Search fallback for tag {} asset count. Returning 0.",
                    tag.getFullyQualifiedName());
                return 0;
              });
      tagAssetCounts.put(tag.getFullyQualifiedName(), count);
    }
    return tagAssetCounts;
  }

  @Override
  public void prepare(Tag entity, boolean update) {
    // Validate parent term
    EntityReference parentTerm = Entity.getEntityReference(entity.getParent(), NON_DELETED);
    entity.setParent(parentTerm);
    // Validate Classification
    EntityReference classification =
        Entity.getEntityReference(entity.getClassification(), NON_DELETED);
    entity.setClassification(classification);
    // Validate recognizers
    if (entity.getRecognizers() != null) {
      for (org.openmetadata.schema.type.Recognizer recognizer : entity.getRecognizers()) {
        prepareRecognizer(recognizer);
        validateRecognizer(recognizer);
      }
    }
  }

  private void prepareRecognizer(org.openmetadata.schema.type.Recognizer recognizer) {
    if (recognizer.getId() == null) {
      recognizer.setId(UUID.randomUUID());
    }
  }

  private void validateRecognizer(org.openmetadata.schema.type.Recognizer recognizer) {
    if (recognizer.getRecognizerConfig() == null) {
      throw new IllegalArgumentException("recognizerConfig is required");
    }
    if (recognizer.getConfidenceThreshold() != null) {
      double threshold = recognizer.getConfidenceThreshold();
      if (threshold < 0.0 || threshold > 1.0) {
        throw new IllegalArgumentException("confidenceThreshold must be between 0.0 and 1.0");
      }
    }
    if (recognizer.getId() == null) {
      throw new IllegalArgumentException("Can't create recognizer without an ID");
    }
  }

  /**
   * Heals seeded Tags: system recognizers the Tag lost - or that a later release added - are put
   * back by name, and a provider knocked off the seeded value is restored. A recognizer that is
   * still there is never touched, so user edits to it survive.
   */
  public void reconcileSeededTags(List<Tag> seedTags) {
    for (Tag seedTag : listOrEmpty(seedTags)) {
      try {
        reconcileSeededTag(seedTag);
      } catch (Exception e) {
        LOG.warn("Failed to reconcile seeded tag {}", seedTag.getFullyQualifiedName(), e);
      }
    }
  }

  private void reconcileSeededTag(Tag seedTag) {
    // A Tag missing altogether was just created from this same seed by initializeEntity()
    Tag stored = lookup().byNameOrNull(seedTag.getFullyQualifiedName(), ALL);
    if (stored == null) {
      return;
    }
    List<Recognizer> seeded = systemRecognizers(seedTag);
    List<Recognizer> missing = missingSystemRecognizers(stored.getRecognizers(), seeded);
    // CreateTag defaults provider to user, so any PUT that omits it downgrades a seeded Tag - and a
    // Tag that is no longer system provided is no longer protected from deletion
    boolean providerDrifted =
        seedTag.getProvider() != null && !seedTag.getProvider().equals(stored.getProvider());
    if (missing.isEmpty() && !providerDrifted) {
      return;
    }
    if (!missing.isEmpty()) {
      appendRecognizers(stored, seedTag, missing, seeded.size());
    }
    if (providerDrifted) {
      stored.setProvider(seedTag.getProvider());
    }
    persistence().store(stored, true);
    LOG.info(
        "Reconciled seeded tag {}: provider={}, recognizers re-added={}",
        stored.getFullyQualifiedName(),
        stored.getProvider(),
        missing.stream().map(Recognizer::getName).toList());
  }

  private List<Recognizer> systemRecognizers(Tag seedTag) {
    return listOrEmpty(seedTag.getRecognizers()).stream()
        .filter(recognizer -> Boolean.TRUE.equals(recognizer.getIsSystemDefault()))
        .toList();
  }

  private void appendRecognizers(
      Tag stored, Tag seedTag, List<Recognizer> missing, int seededCount) {
    List<Recognizer> merged = new ArrayList<>(listOrEmpty(stored.getRecognizers()));
    merged.addAll(missing);
    stored.setRecognizers(merged);
    restoreAutoClassification(stored, seedTag, missing.size() == seededCount);
  }

  /**
   * Seeded recognizers absent from {@code stored}, copied so the seed list stays reusable.
   */
  protected List<Recognizer> missingSystemRecognizers(
      List<Recognizer> stored, List<Recognizer> seeded) {
    Set<String> storedNames =
        listOrEmpty(stored).stream().map(Recognizer::getName).collect(Collectors.toSet());
    return seeded.stream()
        .filter(recognizer -> !storedNames.contains(recognizer.getName()))
        .map(recognizer -> JsonUtils.deepCopy(recognizer, Recognizer.class))
        .map(recognizer -> recognizer.withId(UUID.randomUUID()))
        .toList();
  }

  /**
   * Recognizers are inert while autoClassificationEnabled is false, so a Tag that lost every seeded
   * recognizer - the signature of a wipe - gets its flags back too. One merely short a newly shipped
   * recognizer keeps whatever the user configured.
   */
  private void restoreAutoClassification(Tag stored, Tag seedTag, boolean lostEverySeeded) {
    if (!lostEverySeeded || !Boolean.TRUE.equals(seedTag.getAutoClassificationEnabled())) {
      return;
    }
    stored.setAutoClassificationEnabled(true);
    stored.setAutoClassificationPriority(seedTag.getAutoClassificationPriority());
  }

  @Override
  public void setInheritedFields(Tag tag, Fields fields) {
    if (tag.getClassification() == null || tag.getClassification().getId() == null) {
      return;
    }
    try {
      Classification parent =
          Entity.getEntity(
              CLASSIFICATION, tag.getClassification().getId(), "owners,domains,reviewers", ALL);
      if (parent.getDisabled() != null && parent.getDisabled()) {
        tag.setDisabled(true);
      }
      InheritedReferences.apply(InheritedReferences.Field.OWNERS, tag, fields, parent);
      InheritedReferences.apply(InheritedReferences.Field.DOMAINS, tag, fields, parent);
      InheritedReferences.apply(InheritedReferences.Field.REVIEWERS, tag, fields, parent);
    } catch (Exception e) {
      LOG.debug(
          "Failed to get classification {} for tag {}: {}",
          tag.getClassification().getId(),
          tag.getId(),
          e.getMessage());
    }
  }

  @Override
  public void setInheritedFields(List<Tag> tags, Fields fields) {
    if (tags == null || tags.isEmpty()) {
      return;
    }
    Set<UUID> classificationIds =
        tags.stream()
            .map(Tag::getClassification)
            .filter(Objects::nonNull)
            .map(EntityReference::getId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    if (classificationIds.isEmpty()) {
      return;
    }
    ClassificationRepository classificationRepository =
        (ClassificationRepository) Entity.getEntityRepository(CLASSIFICATION);
    List<Classification> classifications =
        classificationRepository
            .getDao()
            .findEntitiesByIds(new ArrayList<>(classificationIds), ALL);
    classificationRepository.setFieldsInBulk(
        new Fields(Set.of("owners", "domains", "reviewers")), classifications);
    Map<UUID, Classification> classificationMap =
        classifications.stream().collect(Collectors.toMap(Classification::getId, c -> c));
    for (Tag tag : tags) {
      if (tag.getClassification() != null && tag.getClassification().getId() != null) {
        Classification classification = classificationMap.get(tag.getClassification().getId());
        if (classification != null) {
          if (classification.getDisabled() != null && classification.getDisabled()) {
            tag.setDisabled(true);
          }
          InheritedReferences.apply(InheritedReferences.Field.OWNERS, tag, fields, classification);
          InheritedReferences.apply(InheritedReferences.Field.DOMAINS, tag, fields, classification);
          InheritedReferences.apply(
              InheritedReferences.Field.REVIEWERS, tag, fields, classification);
        }
      }
    }
  }

  @Override
  public void storeEntity(Tag tag, boolean update) {
    // setInheritedFields() sets disabled=true on the in-memory Tag whenever the parent
    // Classification is disabled. That inherited value must never be persisted: once it is
    // stored, re-enabling the Classification can no longer clear it and the Tag stays disabled
    // forever.
    //
    // Leave the Tag holding its own flag afterwards rather than restoring the effective value.
    // The entity is cached after this returns, so restoring would write the inherited true into
    // the cache while the row holds false - the read then reports a Tag that is disabled with an
    // enabled Classification, which is the very state this guard exists to prevent. It only
    // shows up with a distributed cache, because an L1-only entry is invalidated on write and
    // reloaded from the row. Restoring is also unnecessary: inheritance is re-applied on the way
    // out, so the write response still reports the effective value.
    tag.setDisabled(getOwnDisabled(tag, update, tag.getDisabled()));
    persistence().store(tag, update);
  }

  /**
   * Returns the Tag's own {@code disabled} setting, with any value inherited from a disabled parent
   * Classification removed. While the parent Classification is disabled the Tag always reads as
   * disabled, so a user cannot express "disable this Tag individually" during that window - the
   * stored value is therefore authoritative.
   */
  private Boolean getOwnDisabled(Tag tag, boolean update, Boolean effectiveDisabled) {
    Boolean ownDisabled = effectiveDisabled;
    if (Boolean.TRUE.equals(effectiveDisabled) && isParentClassificationDisabled(tag)) {
      ownDisabled = update ? getStoredDisabled(tag.getId()) : Boolean.FALSE;
    }
    return ownDisabled;
  }

  private Boolean getStoredDisabled(UUID tagId) {
    Boolean storedDisabled = Boolean.FALSE;
    try {
      storedDisabled = context().schema().dao().findEntityById(tagId, ALL).getDisabled();
    } catch (EntityNotFoundException e) {
      LOG.debug("Tag {} not found while reading its stored disabled flag", tagId, e);
    }
    return storedDisabled;
  }

  private boolean isParentClassificationDisabled(Tag tag) {
    boolean isDisabled = false;
    EntityReference classificationRef = tag.getClassification();
    if (classificationRef != null && classificationRef.getId() != null) {
      try {
        Classification classification =
            Entity.getEntity(CLASSIFICATION, classificationRef.getId(), "", ALL, false);
        isDisabled = Boolean.TRUE.equals(classification.getDisabled());
      } catch (EntityNotFoundException e) {
        LOG.debug(
            "Classification {} not found while checking the disabled flag of tag {}",
            classificationRef.getId(),
            tag.getId(),
            e);
      }
    }
    return isDisabled;
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("classification", "parent");
  }

  @Override
  public void storeEntities(List<Tag> entities) {
    // Today every caller of this bulk path is create-only and applies setInheritedFields() after
    // the store, so no inherited value can be present here. Strip it anyway: a future bulk update
    // path would otherwise silently persist it and strand the Tags, which is the exact failure
    // storeEntity() guards against. Tags are almost never created disabled, so the guard costs
    // nothing on the common path.
    entities.forEach(this::clearInheritedDisabled);
    persistence().insertMany(entities);
  }

  private void clearInheritedDisabled(Tag tag) {
    if (Boolean.TRUE.equals(tag.getDisabled()) && isParentClassificationDisabled(tag)) {
      tag.setDisabled(Boolean.FALSE);
    }
  }

  @Override
  public void restorePatchAttributes(Tag original, Tag updated) {
    EntityPolicy.super.restorePatchAttributes(original, updated);
    updated.setChildren(original.getChildren());
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Tag> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Tag::getId).toList();
    deleteToMany(ids, Entity.TAG, Relationship.CONTAINS, Entity.CLASSIFICATION);
    deleteToMany(ids, Entity.TAG, Relationship.CONTAINS, Entity.TAG);
  }

  @Override
  public void storeRelationships(Tag entity) {
    addClassificationRelationship(entity);
    addParentRelationship(entity);
  }

  @Override
  public void setFullyQualifiedName(Tag tag) {
    if (tag.getParent() == null) {
      tag.setFullyQualifiedName(
          FullyQualifiedName.build(tag.getClassification().getFullyQualifiedName(), tag.getName()));
    } else {
      tag.setFullyQualifiedName(
          FullyQualifiedName.add(tag.getParent().getFullyQualifiedName(), tag.getName()));
    }
  }

  @Override
  public BulkOperationResult bulkAddAndValidateTagsToAssets(
      UUID classificationTagId, BulkAssetsRequestInterface request) {
    AddTagToAssetsRequest addTagToAssetsRequest = (AddTagToAssetsRequest) request;
    boolean dryRun = Boolean.TRUE.equals(addTagToAssetsRequest.getDryRun());
    Tag tag =
        this.reads()
            .byId(
                classificationTagId,
                new EntityReadService.Query(
                    null,
                    fieldPolicy().parse("id"),
                    RelationIncludes.fromInclude(Include.NON_DELETED),
                    false));
    BulkOperationResult result = new BulkOperationResult().withDryRun(dryRun);
    List<BulkResponse> failures = new ArrayList<>();
    List<BulkResponse> success = new ArrayList<>();
    if (nullOrEmpty(request.getAssets())) {
      // Nothing to Validate
      return result
          .withStatus(ApiStatus.SUCCESS)
          .withSuccessRequest(List.of(new BulkResponse().withMessage("Nothing to Validate.")));
    }
    // Validation for entityReferences
    EntityUtil.populateEntityReferences(request.getAssets());
    TagLabel tagLabel =
        new TagLabel()
            .withTagFQN(tag.getFullyQualifiedName())
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    for (EntityReference ref : request.getAssets()) {
      // Update Result Processed
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);
      // Handle column assets specially - columns don't have their own repository
      if (Entity.TABLE_COLUMN.equals(ref.getType())) {
        try {
          addTagToColumn(ref, tagLabel, dryRun, success, failures, result);
        } catch (Exception ex) {
          failures.add(new BulkResponse().withRequest(ref).withMessage(ex.getMessage()));
          result.withFailedRequest(failures);
          result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
        }
        continue;
      }
      EntityPolicy<?> entityRepository = Entity.getEntityRepository(ref.getType());
      EntityInterface asset =
          entityRepository
              .reads()
              .byId(
                  ref.getId(),
                  new EntityReadService.Query(
                      null,
                      entityRepository.fieldPolicy().parse("tags"),
                      RelationIncludes.fromInclude(Include.NON_DELETED),
                      false));
      try {
        Map<String, List<TagLabel>> allAssetTags =
            context()
                .dependencies()
                .daos()
                .tagUsageDAO()
                .getTagsByPrefix(asset.getFullyQualifiedName(), "%", true);
        checkMutuallyExclusiveForParentAndSubField(
            asset.getFullyQualifiedName(),
            FullyQualifiedName.buildHash(asset.getFullyQualifiedName()),
            allAssetTags,
            new ArrayList<>(Collections.singleton(tagLabel)),
            false);
        success.add(new BulkResponse().withRequest(ref));
        result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
      } catch (Exception ex) {
        failures.add(new BulkResponse().withRequest(ref).withMessage(ex.getMessage()));
        result.withFailedRequest(failures);
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
      }
      // Validate and Store Tags — skip the write side-effects on dryRun so the preview
      // surfaces the same validation outcome a real call would without mutating state.
      if (!dryRun && nullOrEmpty(result.getFailedRequest())) {
        List<TagLabel> tempList = new ArrayList<>(asset.getTags());
        tempList.add(tagLabel);
        // Apply Tags to Entities
        entityRepository
            .tagWrites()
            .apply(
                getUniqueTags(tempList), new EntityTagWriter.Target(asset.getFullyQualifiedName()));
        context().dependencies().search().updateEntity(ref);
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

  /**
   * Add a tag to a column through its parent table.
   * Columns are not standalone entities, so we need to update the parent table's column.
   */
  private void addTagToColumn(
      EntityReference columnRef,
      TagLabel tagLabel,
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
        tableRepository.getByName(
            null, tableFqn, tableRepository.fieldPolicy().parse("columns,tags"));
    // Find the column by FQN
    Column targetColumn = findColumnByFqn(table.getColumns(), columnFqn);
    if (targetColumn == null) {
      throw new IllegalArgumentException("Column not found: " + columnFqn);
    }
    // Validate mutually exclusive tags
    Map<String, List<TagLabel>> allAssetTags =
        context().dependencies().daos().tagUsageDAO().getTagsByPrefix(columnFqn, "%", true);
    checkMutuallyExclusiveForParentAndSubField(
        columnFqn,
        FullyQualifiedName.buildHash(columnFqn),
        allAssetTags,
        new ArrayList<>(Collections.singleton(tagLabel)),
        false);
    if (!dryRun && nullOrEmpty(result.getFailedRequest())) {
      List<TagLabel> columnTags = new ArrayList<>(listOrEmpty(targetColumn.getTags()));
      columnTags.add(tagLabel);
      tagWrites().apply(getUniqueTags(columnTags), new EntityTagWriter.Target(columnFqn));
      context().dependencies().search().updateEntity(table.getEntityReference());
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

  @Override
  public BulkOperationResult bulkRemoveAndValidateTagsToAssets(
      UUID classificationTagId, BulkAssetsRequestInterface request) {
    AddTagToAssetsRequest assetsRequest = (AddTagToAssetsRequest) request;
    boolean dryRun = Boolean.TRUE.equals(assetsRequest.getDryRun());
    Tag tag =
        this.reads()
            .byId(
                classificationTagId,
                new EntityReadService.Query(
                    null,
                    fieldPolicy().parse("id"),
                    RelationIncludes.fromInclude(Include.NON_DELETED),
                    false));
    BulkOperationResult result =
        new BulkOperationResult().withStatus(ApiStatus.SUCCESS).withDryRun(dryRun);
    List<BulkResponse> success = new ArrayList<>();
    if (nullOrEmpty(request.getAssets())) {
      // Nothing to Validate
      return result.withSuccessRequest(
          List.of(new BulkResponse().withMessage("Nothing to Validate.")));
    }
    // Validation for entityReferences
    EntityUtil.populateEntityReferences(request.getAssets());
    for (EntityReference ref : request.getAssets()) {
      // Update Result Processed
      result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);
      // Handle column assets specially - columns don't have their own repository
      if (Entity.TABLE_COLUMN.equals(ref.getType())) {
        try {
          removeTagFromColumn(ref, tag, dryRun, success, result);
        } catch (Exception ex) {
          LOG.error("Error removing tag from column: {}", ref.getFullyQualifiedName(), ex);
          result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
        }
        continue;
      }
      EntityPolicy<?> entityRepository = Entity.getEntityRepository(ref.getType());
      EntityInterface asset =
          entityRepository
              .reads()
              .byId(
                  ref.getId(),
                  new EntityReadService.Query(
                      null,
                      entityRepository.fieldPolicy().parse("id"),
                      RelationIncludes.fromInclude(Include.NON_DELETED),
                      false));
      tagAssetRemoval.remove(
          tag.getFullyQualifiedName(),
          asset.getFullyQualifiedName(),
          new Target(asset.getFullyQualifiedName(), ref.getType(), asset.getId()),
          dryRun,
          () -> {
            success.add(new BulkResponse().withRequest(ref));
            result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
          });
    }
    return result.withSuccessRequest(success);
  }

  /**
   * Remove a tag from a column through its parent table.
   */
  private void removeTagFromColumn(
      EntityReference columnRef,
      Tag tag,
      boolean dryRun,
      List<BulkResponse> success,
      BulkOperationResult result) {
    String columnFqn = columnRef.getFullyQualifiedName();
    if (columnFqn == null) {
      throw new IllegalArgumentException("Column FQN is required");
    }
    // Extract table FQN from column FQN (format: service.database.schema.table.column[.nested...])
    String tableFqn = FullyQualifiedName.getTableFQN(columnFqn);
    // Get the table — also validates that the column's parent table exists
    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    Table table =
        tableRepository.getByName(null, tableFqn, tableRepository.fieldPolicy().parse("columns"));
    tagAssetRemoval.remove(
        tag.getFullyQualifiedName(),
        columnFqn,
        new Target(table.getFullyQualifiedName(), Entity.TABLE, table.getId()),
        dryRun,
        () -> {
          success.add(new BulkResponse().withRequest(columnRef));
          result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
        });
  }

  @Override
  public EntityUpdater<Tag> getUpdater(
      Tag original, Tag updated, EntityOperation operation, ChangeSource changeSource) {
    return new TagUpdater(original, updated, operation).mutation();
  }

  @Override
  public void entityRelationshipReindex(Tag original, Tag updated) {
    EntityPolicy.super.entityRelationshipReindex(original, updated);
    if (!Objects.equals(original.getFullyQualifiedName(), updated.getFullyQualifiedName())
        || !Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      EntityReference originalRef = original.getEntityReference();
      context()
          .dependencies()
          .search()
          .deferIfFlushScopeActive(
              () ->
                  context()
                      .dependencies()
                      .search()
                      .getSearchClient()
                      .reindexAcrossIndices("tags.tagFQN", originalRef),
              "reindexAcrossIndices",
              originalRef.getId() != null ? originalRef.getId().toString() : null,
              originalRef.getFullyQualifiedName(),
              TAG);
    }
  }

  @Override
  public void postDelete(Tag entity, boolean hardDelete) {
    EntityPolicy.super.postDelete(entity, hardDelete);
    // Cleanup all the tag labels using this tag
    context()
        .dependencies()
        .daos()
        .tagUsageDAO()
        .deleteTagLabels(TagSource.CLASSIFICATION.ordinal(), entity.getFullyQualifiedName());
    // Remove this tag from policy rule conditions
    PolicyConditionUpdater.updateAllPolicyConditions(
        condition ->
            PolicyConditionUpdater.removeFromCondition(
                condition, entity.getFullyQualifiedName(), PolicyConditionUpdater.TAG_FUNCTIONS));
  }

  @Override
  public void setFields(Tag tag, Fields fields, RelationIncludes relationIncludes) {
    tag.withClassification(getClassification(tag)).withParent(getParent(tag));
    if (fields.contains("usageCount")) {
      tag.withUsageCount(getUsageCount(tag));
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Tag> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    // Batch fetch classifications and parents for all tags
    var classificationsMap = batchFetchClassifications(entities);
    var parentsMap = batchFetchParents(entities);
    // Set default fields (classification and parent) for all entities first
    entities.forEach(
        entity ->
            entity
                .withClassification(classificationsMap.get(entity.getId()))
                .withParent(parentsMap.get(entity.getId())));
    // Batch fetch usage counts if requested
    if (fields.contains("usageCount")) {
      var usageCountMap = batchFetchUsageCounts(entities);
      entities.forEach(
          entity ->
              entity.withUsageCount(usageCountMap.getOrDefault(entity.getFullyQualifiedName(), 0)));
    }
    // Process other fields using the standard bulk processing
    fieldLoading().populate(entities, fields);
    setInheritedFields(entities, fields);
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  private Map<UUID, EntityReference> batchFetchClassifications(List<Tag> tags) {
    // Classification -> CONTAINS -> Tag relationship
    // We need to find classifications that contain these tags
    if (tags == null || tags.isEmpty()) {
      return Map.of();
    }
    var entityIds = tags.stream().map(e -> e.getId().toString()).toList();
    // Find all CONTAINS relationships where tags are on the "to" side and from entity is
    // CLASSIFICATION
    var records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(
                entityIds, Relationship.CONTAINS.ordinal(), Entity.CLASSIFICATION, NON_DELETED);
    if (records.isEmpty()) {
      return Map.of();
    }
    // Get unique classification IDs and batch fetch references
    var classificationIds =
        records.stream().map(r -> UUID.fromString(r.getFromId())).distinct().toList();
    var classificationRefs =
        Entity.getEntityReferencesByIds(Entity.CLASSIFICATION, classificationIds, NON_DELETED);
    var idToRefMap =
        classificationRefs.stream()
            .collect(Collectors.toMap(ref -> ref.getId().toString(), ref -> ref));
    // Map tags to their classifications
    return records.stream()
        .collect(
            Collectors.toMap(
                r -> UUID.fromString(r.getToId()), // In case of duplicates, keep first
                r -> idToRefMap.get(r.getFromId()),
                (existing, replacement) -> existing))
        .entrySet()
        .stream()
        .filter(e -> e.getValue() != null)
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  private Map<UUID, EntityReference> batchFetchParents(List<Tag> tags) {
    // Parent Tag -> CONTAINS -> Child Tag relationship
    if (tags == null || tags.isEmpty()) {
      return Map.of();
    }
    var entityIds = tags.stream().map(e -> e.getId().toString()).toList();
    // For parent tags, we need to find where current tags are the "to" side of CONTAINS
    // relationship
    var records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(entityIds, Relationship.CONTAINS.ordinal(), TAG, NON_DELETED);
    if (records.isEmpty()) {
      return Map.of();
    }
    // Get unique parent IDs and batch fetch references
    var parentIds = records.stream().map(r -> UUID.fromString(r.getFromId())).distinct().toList();
    var parentRefs = Entity.getEntityReferencesByIds(TAG, parentIds, NON_DELETED);
    var idToRefMap =
        parentRefs.stream().collect(Collectors.toMap(ref -> ref.getId().toString(), ref -> ref));
    // Map tags to their parents
    return records.stream()
        .collect(
            Collectors.toMap(
                r -> UUID.fromString(r.getToId()),
                r -> idToRefMap.get(r.getFromId()),
                (existing, replacement) -> existing))
        .entrySet()
        .stream()
        .filter(e -> e.getValue() != null)
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  private Map<String, Integer> batchFetchUsageCounts(List<Tag> tags) {
    if (tags == null || tags.isEmpty()) {
      return Map.of();
    }
    // Build and execute a single query for all tags
    var tagFQNs = tags.stream().map(Tag::getFullyQualifiedName).toList();
    // Build UNION query that gets counts for all tags in one go
    var queryBuilder = new StringBuilder();
    tagFQNs.forEach(
        tagFQN -> {
          if (!queryBuilder.isEmpty()) {
            queryBuilder.append(" UNION ALL ");
          }
          var escapedFQN = tagFQN.replace("'", "''");
          queryBuilder.append(
              """
                SELECT '%s' as tagFQN,
                COUNT(DISTINCT targetFQNHash) as count
                FROM tag_usage
                WHERE source = %d
                AND (tagFQNHash = MD5('%s') OR tagFQNHash LIKE CONCAT(MD5('%s'), '.%%'))
                """
                  .formatted(
                      escapedFQN, TagSource.CLASSIFICATION.ordinal(), escapedFQN, escapedFQN));
        });
    try {
      var results =
          Entity.getJdbi()
              .withHandle(handle -> handle.createQuery(queryBuilder.toString()).mapToMap().list());
      return results.stream()
          .filter(row -> row.get("tagFQN") != null)
          .collect(
              Collectors.toMap(
                  row -> (String) row.get("tagFQN"),
                  row -> {
                    var count = (Number) row.get("count");
                    return count != null ? count.intValue() : 0;
                  }));
    } catch (Exception e) {
      LOG.error("Error batch fetching usage counts", e);
      // Fall back to individual queries
      return context()
          .dependencies()
          .daos()
          .tagUsageDAO()
          .getTagCountsBulk(TagSource.CLASSIFICATION.ordinal(), tagFQNs);
    }
  }

  @Override
  public void clearFields(Tag tag, Fields fields) {
    tag.withUsageCount(fields.contains("usageCount") ? tag.getUsageCount() : null);
  }

  private Integer getUsageCount(Tag tag) {
    return tag.getUsageCount() != null
        ? tag.getUsageCount()
        : context()
            .dependencies()
            .daos()
            .tagUsageDAO()
            .getTagCount(TagSource.CLASSIFICATION.ordinal(), tag.getFullyQualifiedName());
  }

  private EntityReference getClassification(Tag tag) {
    return relationships()
        .singleFrom(tag.getId(), Relationship.CONTAINS, Entity.CLASSIFICATION, true);
  }

  private void addClassificationRelationship(Tag term) {
    relationshipWrites()
        .add(
            new EntityRelationshipWriter.Edge(
                term.getClassification().getId(),
                term.getId(),
                Entity.CLASSIFICATION,
                TAG,
                Relationship.CONTAINS),
            EntityRelationshipWriter.Value.EMPTY,
            false);
  }

  private void addParentRelationship(Tag term) {
    if (term.getParent() != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  term.getParent().getId(), term.getId(), TAG, TAG, Relationship.CONTAINS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  public class TagUpdater implements EntitySpecificMutation<Tag> {

    private boolean renameProcessed = false;

    public TagUpdater(Tag original, Tag updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void reset() {
      renameProcessed = false;
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Tag> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.restrictSystemProviderChange(entityUpdate.getUpdated()::setProvider);
      preserveRecognizerConfigOnPut();
      entityUpdate.compareAndUpdate("mutuallyExclusive", this::run);
      entityUpdate.compareAndUpdate(
          "disabled",
          () ->
              entityUpdate.recordChange(
                  "disabled",
                  entityUpdate.getOriginal().getDisabled(),
                  entityUpdate.getUpdated().getDisabled()));
      entityUpdate.compareAndUpdate(
          "recognizers",
          () ->
              entityUpdate.recordChange(
                  "recognizers",
                  entityUpdate.getOriginal().getRecognizers(),
                  entityUpdate.getUpdated().getRecognizers(),
                  true));
      entityUpdate.compareAndUpdate(
          "autoClassificationEnabled",
          () ->
              entityUpdate.recordChange(
                  "autoClassificationEnabled",
                  entityUpdate.getOriginal().getAutoClassificationEnabled(),
                  entityUpdate.getUpdated().getAutoClassificationEnabled()));
      entityUpdate.compareAndUpdate(
          "autoClassificationPriority",
          () ->
              entityUpdate.recordChange(
                  "autoClassificationPriority",
                  entityUpdate.getOriginal().getAutoClassificationPriority(),
                  entityUpdate.getUpdated().getAutoClassificationPriority()));
      entityUpdate.compareAndUpdateAny(
          () -> updateNameAndParent(entityUpdate.getUpdated()), "name", "parent", "classification");
    }

    // CreateTag defaults recognizers to empty and autoClassificationEnabled to false, so a PUT
    // that never mentions them is indistinguishable from one clearing them. Clear via PATCH.
    private void preserveRecognizerConfigOnPut() {
      if (entityUpdate.getOperation() != EntityOperation.PUT
          || !nullOrEmpty(entityUpdate.getUpdated().getRecognizers())) {
        return;
      }
      entityUpdate.getUpdated().setRecognizers(entityUpdate.getOriginal().getRecognizers());
      entityUpdate
          .getUpdated()
          .setAutoClassificationEnabled(entityUpdate.getOriginal().getAutoClassificationEnabled());
      entityUpdate
          .getUpdated()
          .setAutoClassificationPriority(
              entityUpdate.getOriginal().getAutoClassificationPriority());
    }

    /**
     * Handle name and parent changes together using getOriginalFqn() for correct FQN tracking.
     */
    public void updateNameAndParent(Tag updated) {
      // Use getOriginalFqn() which was captured at EntityUpdater construction time.
      String oldFqn = entityUpdate.getOriginalFqn();
      setFullyQualifiedName(updated);
      String newFqn = updated.getFullyQualifiedName();
      // Check if this is a name change
      String[] oldParts = FullyQualifiedName.split(oldFqn);
      String oldTagName = oldParts.length > 0 ? oldParts[oldParts.length - 1] : "";
      boolean nameChanged = !oldTagName.equals(updated.getName());
      // Check for parent/classification changes
      UUID oldParentId = getId(entityUpdate.getOriginal().getParent());
      UUID newParentId = getId(updated.getParent());
      boolean parentChanged = !Objects.equals(oldParentId, newParentId);
      UUID oldCategoryId = getId(entityUpdate.getOriginal().getClassification());
      UUID newCategoryId = getId(updated.getClassification());
      boolean classificationChanged = !Objects.equals(oldCategoryId, newCategoryId);
      boolean fqnChanged = !oldFqn.equals(newFqn);
      if (fqnChanged && !renameProcessed) {
        renameProcessed = true;
        if (nameChanged && ProviderType.SYSTEM.equals(entityUpdate.getOriginal().getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(
                  entityUpdate.getOriginal().getName(), context().schema().entityType()));
        }
        LOG.info("Tag FQN changed from {} to {}", oldFqn, newFqn);
        // Drop cache entries for every child tag under this renamed tag BEFORE the DB rewrite.
        // Capture the descendants so the post-write pass can re-evict any entry a racing reader
        // re-populated with the pre-rename row between this call and tagDAO.updateFqn below.
        // The pass below runs after updateFqn but inside this transaction — see
        // EntityCaches.targets().beforeRename for the residual pre-commit
        // window.
        List<EntityDAO.EntityIdFqnPair> renamedTags =
            EntityCaches.targets().beforeRename(Entity.TAG, oldFqn);
        // Drop cached entity JSON / bundle for every entity tagged with this tag (or any
        // descendant). Done BEFORE the DB rename so the search lookup still matches by old FQN.
        EntityCaches.targets().taggedDescendants(Entity.TAG, oldFqn);
        context().dependencies().daos().tagDAO().updateFqn(oldFqn, newFqn);
        context()
            .dependencies()
            .daos()
            .tagUsageDAO()
            .rename(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);
        if (nameChanged) {
          entityUpdate.recordChange("name", oldTagName, updated.getName());
        }
        updateEntityLinks(oldFqn, newFqn, updated);
        PolicyConditionUpdater.updateAllPolicyConditions(
            condition ->
                PolicyConditionUpdater.renamePrefixInCondition(
                    condition, oldFqn, newFqn, PolicyConditionUpdater.TAG_FUNCTIONS));
        EntityCaches.targets().afterRename(Entity.TAG, renamedTags);
      }
      if (classificationChanged) {
        updateClassificationRelationship(entityUpdate.getOriginal(), updated);
        entityUpdate.recordChange(
            "Classification",
            entityUpdate.getOriginal().getClassification(),
            updated.getClassification(),
            true,
            entityReferenceMatch);
        invalidateTags(updated.getId());
      }
      if (parentChanged) {
        updateParentRelationship(entityUpdate.getOriginal(), updated);
        entityUpdate.recordChange(
            "parent",
            entityUpdate.getOriginal().getParent(),
            updated.getParent(),
            true,
            entityReferenceMatch);
        invalidateTags(updated.getId());
      }
      // Populate response fields
      invalidateTags(updated.getId());
      getChildren(updated);
    }

    private void updateClassificationRelationship(Tag orig, Tag updated) {
      deleteClassificationRelationship(orig);
      addClassificationRelationship(updated);
    }

    private void deleteClassificationRelationship(Tag term) {
      relationshipWrites()
          .delete(
              new EntityRelationshipWriter.Edge(
                  term.getClassification().getId(),
                  term.getId(),
                  Entity.CLASSIFICATION,
                  TAG,
                  Relationship.CONTAINS));
    }

    private void updateParentRelationship(Tag orig, Tag updated) {
      deleteParentRelationship(orig);
      addParentRelationship(updated);
    }

    private void deleteParentRelationship(Tag term) {
      if (term.getParent() != null) {
        relationshipWrites()
            .delete(
                new EntityRelationshipWriter.Edge(
                    term.getParent().getId(), term.getId(), TAG, TAG, Relationship.CONTAINS));
      }
    }

    private void updateEntityLinks(String oldFqn, String newFqn, Tag updated) {
      context().dependencies().daos().fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);
      ConversationRepository conversations = Entity.getConversationRepository();
      conversations.updateEntityReference(updated.getEntityReference(), oldFqn);
      List<EntityReference> childTags =
          relationships()
              .to(
                  new EntityRelationshipReader.Selection(
                      updated.getId(), TAG, Relationship.CONTAINS, TAG),
                  Include.NON_DELETED);
      for (EntityReference child : childTags) {
        String childNewFqn = child.getFullyQualifiedName();
        String childOldFqn = oldFqn + childNewFqn.substring(newFqn.length());
        conversations.updateEntityReference(child, childOldFqn);
      }
    }

    private void invalidateTags(UUID tagId) {
      // The name of the tag changed. Invalidate that tag and all the children from the cache
      List<EntityRelationshipRecord> tagRecords =
          relationships()
              .toRecords(
                  new EntityRelationshipReader.Selection(tagId, TAG, Relationship.CONTAINS, TAG));
      EntityCaches.byId().invalidate(new ImmutablePair<>(TAG, tagId));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTags(tagRecord.getId());
      }
    }

    private void run() {
      entityUpdate.recordChange(
          "mutuallyExclusive",
          entityUpdate.getOriginal().getMutuallyExclusive(),
          entityUpdate.getUpdated().getMutuallyExclusive());
    }

    private final EntityUpdater<Tag> entityUpdate;

    public EntityUpdater<Tag> mutation() {
      return entityUpdate;
    }
  }

  @Override
  public void postUpdate(Tag original, Tag updated) {
    EntityPolicy.super.postUpdate(original, updated);
    if (EntityStatus.IN_REVIEW.equals(original.getEntityStatus())) {
      if (EntityStatus.APPROVED.equals(updated.getEntityStatus())) {
        closeApprovalTask(updated, "Approved the tag");
      } else if (EntityStatus.REJECTED.equals(updated.getEntityStatus())) {
        closeApprovalTask(updated, "Rejected the tag");
      }
    }
    // TODO: It might happen that a task went from DRAFT to IN_REVIEW to DRAFT fairly quickly
    // Due to ChangesConsolidation, the postUpdate will be called as from DRAFT to DRAFT, but there
    // will be a Task created.
    // This if handles this case scenario, by guaranteeing that we are any Approval Task if the
    // Tag goes back to DRAFT.
    if (!EntityStatus.DRAFT.equals(original.getEntityStatus())
        && EntityStatus.DRAFT.equals(updated.getEntityStatus())) {
      try {
        closeApprovalTask(updated, "Closed due to tag going back to DRAFT.");
      } catch (EntityNotFoundException ignored) {
      }
      // No ApprovalTask is present, and thus we don't need to worry about this.
    }
  }

  @Override
  public void preDelete(Tag entity, String deletedBy) {
    if (EntityStatus.IN_REVIEW.equals(entity.getEntityStatus())) {
      checkUpdatedByReviewer(entity, deletedBy);
    }
  }

  private void closeApprovalTask(Tag entity, String comment) {
    if (entity.getUpdatedBy() == null) {
      LOG.debug(
          "Skipping task closure for tag {} - updatedBy is null", entity.getFullyQualifiedName());
      return;
    }
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    taskRepository.closeApprovalTaskForEntity(
        entity.getFullyQualifiedName(), entity.getUpdatedBy(), comment);
  }

  public static void checkUpdatedByReviewer(Tag tag, String updatedBy) {
    // Only list of allowed reviewers can change the status from DRAFT to APPROVED
    List<EntityReference> reviewers = tag.getReviewers();
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

  private String getRecognizerCursorValue(Recognizer recognizer) {
    Map<String, String> map =
        Map.of("id", recognizer.getId().toString(), "name", recognizer.getName());
    return JsonUtils.pojoToJson(map);
  }

  public ResultList<Recognizer> getRecognizersOfTagById(
      UUID tagId, String before, String after, int limit) {
    Tag tag =
        reads()
            .byId(
                tagId,
                new EntityReadService.Query(
                    null,
                    fieldPolicy().parse("recognizers"),
                    RelationIncludes.fromInclude(Include.NON_DELETED),
                    false));
    return getRecognizersOfTag(tag, before, after, limit);
  }

  public ResultList<Recognizer> getRecognizersOfTagByFQN(
      String tagFqn, String before, String after, int limit) {
    Tag tag = getByName(null, tagFqn, fieldPolicy().parse("recognizers"));
    return getRecognizersOfTag(tag, before, after, limit);
  }

  public ResultList<Recognizer> getRecognizersOfTag(
      Tag tag, String before, String after, int limit) {
    ResultList<Recognizer> result;
    if (tag.getRecognizers() == null || tag.getRecognizers().isEmpty()) {
      return new ResultList<>(Collections.emptyList(), null, null, 0);
    }
    if (before != null) {
      result = listRecognizersBeforeCursor(tag.getRecognizers(), before, limit);
    } else {
      result = listRecognizersAfterCursor(tag.getRecognizers(), after, limit);
    }
    return result;
  }

  private UUID extractIdFromCursor(String cursor) {
    UUID id = null;
    if (cursor != null) {
      try {
        Map<String, String> map = EntityCursor.parse(RestUtil.decodeCursor(cursor));
        String idString = map.get("id");
        if (idString == null) {
          throw new BadCursorException();
        }
        id = UUID.fromString(idString);
      } catch (Exception e) {
        throw new BadCursorException();
      }
    }
    return id;
  }

  private ResultList<Recognizer> listRecognizersAfterCursor(
      List<Recognizer> recognizers, String after, int limit) {
    UUID afterId;
    try {
      afterId = extractIdFromCursor(after);
    } catch (BadCursorException ignored) {
      throw new BadCursorException("Invalid `after` cursor");
    }
    return listRecognizersAfter(recognizers, afterId, limit);
  }

  private ResultList<Recognizer> listRecognizersBeforeCursor(
      List<Recognizer> recognizers, String before, int limit) {
    UUID beforeId;
    try {
      beforeId = extractIdFromCursor(before);
    } catch (BadCursorException ignored) {
      throw new BadCursorException("Invalid `before` cursor");
    }
    return listRecognizersAfter(recognizers.reversed(), beforeId, limit);
  }

  private ResultList<Recognizer> listRecognizersAfter(
      List<Recognizer> recognizers, UUID startId, int limit) {
    int total = recognizers.size();
    boolean append = startId == null;
    limit = limit > 0 ? Math.min(total, limit) : total;
    List<Recognizer> result = new ArrayList<>(limit);
    int startIndex = 0;
    int endIndex = -1;
    for (int i = 0; i < recognizers.size(); i++) {
      Recognizer recognizer = recognizers.get(i);
      if (result.size() >= limit) {
        break;
      }
      if (!append) {
        append = startId.equals(recognizer.getId());
        continue;
      }
      if (result.isEmpty()) {
        startIndex = i;
      }
      endIndex = i;
      result.add(recognizer);
    }
    if (result.isEmpty()) {
      return new ResultList<>(result, null, null, total);
    }
    String newBefore = (startIndex == 0) ? null : getRecognizerCursorValue(result.getFirst());
    String newAfter =
        (endIndex == recognizers.size() - 1) ? null : getRecognizerCursorValue(result.getLast());
    return new ResultList<>(result, newBefore, newAfter, total);
  }

  private final EntityPolicyContext<Tag> entityContext;

  @Override
  public final EntityPolicyContext<Tag> context() {
    return entityContext;
  }
}
