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
import static org.openmetadata.csv.CsvUtil.addDomains;
import static org.openmetadata.csv.CsvUtil.addEntityReference;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addReviewers;
import static org.openmetadata.service.Entity.CLASSIFICATION;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.TAG_SEARCH_INDEX;
import static org.openmetadata.service.search.SearchConstants.TAGS_FQN;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.resources.tags.ClassificationResource;
import org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository()
public class ClassificationRepository implements EntityPolicy<Classification> {

  public ClassificationRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                ClassificationResource.TAG_COLLECTION_PATH,
                Entity.CLASSIFICATION,
                Classification.class,
                Entity.getCollectionDAO().classificationDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setQuoteFqn(true);
    context().options().setSupportsSearch(true);
    context().options().setRenameAllowed(true);
  }

  @Override
  public void postDelete(Classification entity, boolean hardDelete) {
    EntityPolicy.super.postDelete(entity, hardDelete);
    PolicyConditionUpdater.updateAllPolicyConditions(
        condition ->
            PolicyConditionUpdater.removeByPrefixFromCondition(
                condition, entity.getFullyQualifiedName(), PolicyConditionUpdater.TAG_FUNCTIONS));
  }

  @Override
  public EntityUpdater<Classification> getUpdater(
      Classification original,
      Classification updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new ClassificationUpdater(original, updated, operation).mutation();
  }

  @Override
  public void setFields(
      Classification classification, Fields fields, RelationIncludes relationIncludes) {
    classification.withTermCount(
        fields.contains("termCount") ? getTermCount(classification) : null);
    classification.withUsageCount(
        fields.contains("usageCount") ? getUsageCount(classification) : null);
  }

  @Override
  public void clearFields(Classification classification, Fields fields) {
    classification.withTermCount(
        fields.contains("termCount") ? classification.getTermCount() : null);
    classification.withUsageCount(
        fields.contains("usageCount") ? classification.getUsageCount() : null);
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Classification> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    fieldLoading().populate(entities, fields);
    fetchAndSetClassificationSpecificFields(entities, fields);
    setInheritedFields(entities, fields);
    for (Classification entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  private void fetchAndSetClassificationSpecificFields(
      List<Classification> classifications, Fields fields) {
    if (classifications == null || classifications.isEmpty()) {
      return;
    }
    if (fields.contains("termCount")) {
      fetchAndSetTermCounts(classifications);
    }
    if (fields.contains("usageCount")) {
      fetchAndSetUsageCounts(classifications);
    }
  }

  private void fetchAndSetTermCounts(List<Classification> classifications) {
    // Batch fetch term counts for all classifications
    Map<String, Integer> termCountMap = batchFetchTermCounts(classifications);
    for (Classification classification : classifications) {
      classification.withTermCount(
          termCountMap.getOrDefault(classification.getFullyQualifiedName(), 0));
    }
  }

  private void fetchAndSetUsageCounts(List<Classification> classifications) {
    Map<String, Integer> usageCountMap = batchFetchUsageCounts(classifications);
    for (Classification classification : classifications) {
      classification.withUsageCount(
          usageCountMap.getOrDefault(classification.getFullyQualifiedName(), 0));
    }
  }

  private Map<String, Integer> batchFetchTermCounts(List<Classification> classifications) {
    Map<String, Integer> termCountMap = new HashMap<>();
    if (classifications == null || classifications.isEmpty()) {
      return termCountMap;
    }
    try {
      // Convert classifications to their hash representations
      List<String> classificationHashes = new ArrayList<>();
      Map<String, String> hashToFqnMap = new HashMap<>();
      for (Classification classification : classifications) {
        String fqn = classification.getFullyQualifiedName();
        String hash = FullyQualifiedName.buildHash(fqn);
        classificationHashes.add(hash);
        hashToFqnMap.put(hash, fqn);
      }
      // Use the DAO method with simple IN clause - much more efficient
      List<Pair<String, Integer>> results =
          context()
              .dependencies()
              .daos()
              .classificationDAO()
              .bulkGetTermCounts(classificationHashes);
      // Process results
      for (Pair<String, Integer> result : results) {
        String classificationHash = result.getLeft();
        Integer count = result.getRight();
        String fqn = hashToFqnMap.get(classificationHash);
        if (fqn != null) {
          termCountMap.put(fqn, count);
        }
      }
      // Set 0 for classifications with no tags
      for (Classification classification : classifications) {
        termCountMap.putIfAbsent(classification.getFullyQualifiedName(), 0);
      }
      return termCountMap;
    } catch (Exception e) {
      LOG.error("Error batch fetching term counts, falling back to individual queries", e);
      // Fall back to individual queries
      for (Classification classification : classifications) {
        ListFilter filterWithParent =
            new ListFilter(Include.NON_DELETED)
                .addQueryParam("parent", classification.getFullyQualifiedName());
        int count = context().dependencies().daos().tagDAO().listCount(filterWithParent);
        termCountMap.put(classification.getFullyQualifiedName(), count);
      }
      return termCountMap;
    }
  }

  private Map<String, Integer> batchFetchUsageCounts(List<Classification> classifications) {
    Map<String, Integer> usageCountMap = new HashMap<>();
    if (classifications == null || classifications.isEmpty()) {
      return usageCountMap;
    }
    // Batch fetch usage counts for all classifications at once
    List<String> classificationFQNs =
        classifications.stream()
            .map(Classification::getFullyQualifiedName)
            .collect(Collectors.toList());
    Map<String, Integer> counts =
        context()
            .dependencies()
            .daos()
            .tagUsageDAO()
            .getTagCountsBulk(TagSource.CLASSIFICATION.ordinal(), classificationFQNs);
    return counts != null ? counts : usageCountMap;
  }

  @Override
  public void prepare(Classification entity, boolean update) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(Classification classification, boolean update) {
    persistence().store(classification, update);
  }

  @Override
  public void storeRelationships(Classification entity) {
    // No relationships to store beyond what is stored in the super class
  }

  private int getTermCount(Classification classification) {
    ListFilter filter =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("parent", classification.getFullyQualifiedName());
    return context().dependencies().daos().tagDAO().listCount(filter);
  }

  private Integer getUsageCount(Classification classification) {
    return context()
        .dependencies()
        .daos()
        .tagUsageDAO()
        .getTagCount(TagSource.CLASSIFICATION.ordinal(), classification.getFullyQualifiedName());
  }

  /**
   * Export a classification with all its tags as CSV
   */
  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    return exportToCsv(name, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    Classification classification = getByName(null, name, Fields.EMPTY_FIELDS);
    validateNotSystemClassification(classification);
    return new ClassificationCsv(classification, user)
        .exportCsv(listTagsForCsv(classification), callback);
  }

  /**
   * Import tags into a classification from CSV
   */
  @Override
  public CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      CsvImportProgressCallback callback)
      throws IOException {
    Classification classification = getByName(null, name, Fields.EMPTY_FIELDS);
    validateNotSystemClassification(classification);
    return new ClassificationCsv(classification, user).importCsv(csv, dryRun, callback);
  }

  /**
   * System-generated classifications (e.g. Tier, Certification) are managed by the platform, so
   * their tags cannot be bulk imported or exported - matching how the UI hides these actions.
   */
  private void validateNotSystemClassification(Classification classification) {
    if (ProviderType.SYSTEM.equals(classification.getProvider())) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityModifyNotAllowed(
              classification.getName(), CLASSIFICATION));
    }
  }

  private List<Tag> listTagsForCsv(Classification classification) {
    TagRepository repository = (TagRepository) Entity.getEntityRepository(TAG);
    List<Tag> tags =
        repository
            .collections()
            .forCsv(
                repository.fieldPolicy().parse("owners,reviewers,parent,domains"),
                classification.getFullyQualifiedName());
    tags.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return tags;
  }

  public static class ClassificationCsv extends EntityCsv<Tag> {

    public static final CsvDocumentation DOCUMENTATION =
        getCsvDocumentation(Entity.CLASSIFICATION, false);

    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();

    private final Classification classification;

    ClassificationCsv(Classification classification, String user) {
      super(TAG, HEADERS, user);
      this.classification = classification;
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      if (csvRecord == null) {
        return;
      }
      String parentFqn = csvRecord.get(0);
      String tagFqn =
          nullOrEmpty(parentFqn)
              ? FullyQualifiedName.build(classification.getFullyQualifiedName(), csvRecord.get(1))
              : FullyQualifiedName.add(parentFqn, csvRecord.get(1));
      Tag existingTag =
          ((TagRepository) Entity.getEntityRepository(TAG))
              .lookup()
              .byNameOrNull(tagFqn, Include.ALL);
      // On update, start from the stored tag so fields the CSV does not carry (recognizers,
      // auto-classification, deprecated, ...) are retained instead of reset to their defaults.
      // Any field added to the tag schema later is preserved automatically - no per-field handling.
      Tag tag = existingTag != null ? existingTag : new Tag();
      tag.withClassification(classification.getEntityReference())
          .withParent(getParentReference(printer, csvRecord, parentFqn))
          .withName(csvRecord.get(1))
          .withFullyQualifiedName(tagFqn)
          .withDisplayName(csvRecord.get(2))
          .withDescription(csvRecord.get(3))
          .withReviewers(getReviewers(printer, csvRecord, 4))
          .withOwners(getOwners(printer, csvRecord, 5))
          .withEntityStatus(getTagStatus(printer, csvRecord, existingTag))
          .withStyle(getStyle(csvRecord, existingTag))
          .withDomains(getDomains(printer, csvRecord, 9))
          .withMutuallyExclusive(getMutuallyExclusive(csvRecord, existingTag));
      if (processRecord) {
        createEntity(printer, csvRecord, tag, TAG);
      }
    }

    private EntityReference getParentReference(
        CSVPrinter printer, CSVRecord csvRecord, String parentFqn) throws IOException {
      EntityReference parentRef = null;
      if (!nullOrEmpty(parentFqn)) {
        try {
          Tag parentTag =
              getEntityWithDependencyResolution(TAG, parentFqn, "*", Include.NON_DELETED);
          parentRef = parentTag.getEntityReference();
        } catch (EntityNotFoundException ex) {
          parentRef = getEntityReference(printer, csvRecord, 0, TAG);
        }
      }
      return parentRef;
    }

    private EntityStatus getTagStatus(CSVPrinter printer, CSVRecord csvRecord, Tag existingTag)
        throws IOException {
      EntityStatus status = null;
      if (processRecord) {
        String tagStatus = csvRecord.get(6);
        try {
          status = existingTag == null ? EntityStatus.DRAFT : existingTag.getEntityStatus();
          if (!nullOrEmpty(tagStatus)) {
            status = EntityFieldUtils.parseEntityStatus(tagStatus);
          }
        } catch (IllegalArgumentException ex) {
          importFailure(
              printer,
              invalidField(6, String.format("Tag status %s is invalid", tagStatus)),
              csvRecord);
          processRecord = false;
        }
      }
      return status;
    }

    private Style getStyle(CSVRecord csvRecord, Tag existingTag) {
      Style style = null;
      if (processRecord) {
        String color = csvRecord.get(7);
        String iconURL = csvRecord.get(8);
        if (!nullOrEmpty(color) || !nullOrEmpty(iconURL)) {
          style = new Style();
          if (!nullOrEmpty(color)) {
            style.setColor(color);
          }
          if (!nullOrEmpty(iconURL)) {
            style.setIconURL(iconURL);
          }
        } else if (existingTag != null) {
          style = existingTag.getStyle();
        }
      }
      return style;
    }

    private Boolean getMutuallyExclusive(CSVRecord csvRecord, Tag existingTag) {
      String value = csvRecord.get(10);
      if (nullOrEmpty(value)) {
        // An empty cell must not silently flip the flag: keep the existing value
        // when updating a tag, and only default to false when creating a new one.
        return existingTag != null ? existingTag.getMutuallyExclusive() : Boolean.FALSE;
      }
      return Boolean.parseBoolean(value);
    }

    @Override
    protected void addRecord(CsvFile csvFile, Tag entity) {
      List<String> recordList = new ArrayList<>();
      addEntityReference(recordList, entity.getParent());
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addReviewers(recordList, entity.getReviewers());
      addOwners(recordList, entity.getOwners());
      addField(
          recordList, entity.getEntityStatus() != null ? entity.getEntityStatus().value() : null);
      addField(recordList, entity.getStyle() != null ? entity.getStyle().getColor() : null);
      addField(recordList, entity.getStyle() != null ? entity.getStyle().getIconURL() : null);
      addDomains(recordList, getDirectDomains(entity.getDomains()));
      addField(recordList, entity.getMutuallyExclusive());
      addRecord(csvFile, recordList);
    }

    private static List<EntityReference> getDirectDomains(List<EntityReference> domains) {
      return listOrEmpty(domains).stream()
          .filter(domain -> !Boolean.TRUE.equals(domain.getInherited()))
          .toList();
    }
  }

  public static class TagLabelMapper implements RowMapper<TagLabel> {

    @Override
    public TagLabel map(ResultSet r, org.jdbi.v3.core.statement.StatementContext ctx)
        throws SQLException {
      return new TagLabel()
          .withLabelType(TagLabel.LabelType.values()[r.getInt("labelType")])
          .withState(TagLabel.State.values()[r.getInt("state")])
          .withTagFQN(r.getString("tagFQN"));
    }
  }

  @Override
  public void entityRelationshipReindex(Classification original, Classification updated) {
    EntityPolicy.super.entityRelationshipReindex(original, updated);
    if (!Objects.equals(original.getFullyQualifiedName(), updated.getFullyQualifiedName())
        || !Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      updateAssetIndexes(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
    }
  }

  private void updateAssetIndexes(String oldFqn, String newFqn) {
    context()
        .dependencies()
        .search()
        .deferIfFlushScopeActive(
            () -> runAssetIndexRewrite(oldFqn, newFqn),
            "classificationUpdateAssetIndexes",
            null,
            newFqn,
            Entity.TAG);
  }

  private void runAssetIndexRewrite(String oldFqn, String newFqn) {
    context()
        .dependencies()
        .search()
        .getSearchClient()
        .updateClassificationTagByFqnPrefix(GLOBAL_SEARCH_ALIAS, oldFqn, newFqn, TAGS_FQN);
    context()
        .dependencies()
        .search()
        .getSearchClient()
        .updateByFqnPrefix(TAG_SEARCH_INDEX, oldFqn, newFqn, "fullyQualifiedName");
  }

  private List<Tag> getAllTagsByClassification(Classification classification) {
    // Get all the tags under the specified classification
    List<String> jsons =
        context()
            .dependencies()
            .daos()
            .tagDAO()
            .getTagsStartingWithPrefix(classification.getFullyQualifiedName());
    return JsonUtils.readObjects(jsons, Tag.class);
  }

  public class ClassificationUpdater implements EntitySpecificMutation<Classification> {

    private boolean renameProcessed = false;

    public ClassificationUpdater(
        Classification original, Classification updated, EntityOperation operation) {
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
    public void update(EntityUpdater<Classification> entityUpdate, boolean consolidatingChanges) {
      // Mutually exclusive cannot be updated
      entityUpdate
          .getUpdated()
          .setMutuallyExclusive(entityUpdate.getOriginal().getMutuallyExclusive());
      entityUpdate.restrictSystemProviderChange(entityUpdate.getUpdated()::setProvider);
      preserveAutoClassificationConfigOnPut();
      entityUpdate.compareAndUpdate(
          "disabled",
          () ->
              entityUpdate.recordChange(
                  "disabled",
                  entityUpdate.getOriginal().getDisabled(),
                  entityUpdate.getUpdated().getDisabled()));
      entityUpdate.compareAndUpdate(
          "autoClassificationConfig",
          () ->
              entityUpdate.recordChange(
                  "autoClassificationConfig",
                  entityUpdate.getOriginal().getAutoClassificationConfig(),
                  entityUpdate.getUpdated().getAutoClassificationConfig(),
                  true));
      entityUpdate.compareAndUpdate("name", () -> updateName(entityUpdate.getUpdated()));
    }

    private void preserveAutoClassificationConfigOnPut() {
      if (entityUpdate.getOperation() == EntityOperation.PUT
          && entityUpdate.getUpdated().getAutoClassificationConfig() == null) {
        entityUpdate
            .getUpdated()
            .setAutoClassificationConfig(entityUpdate.getOriginal().getAutoClassificationConfig());
      }
    }

    public void updateName(Classification updated) {
      // Use getOriginalFqn() which was captured at EntityUpdater construction time.
      String oldFqn = entityUpdate.getOriginalFqn();
      setFullyQualifiedName(updated);
      String newFqn = updated.getFullyQualifiedName();
      if (oldFqn.equals(newFqn)) {
        return;
      }
      // Only process the rename once per update operation.
      if (renameProcessed) {
        return;
      }
      renameProcessed = true;
      if (ProviderType.SYSTEM.equals(entityUpdate.getOriginal().getProvider())) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.systemEntityRenameNotAllowed(
                entityUpdate.getOriginal().getName(), context().schema().entityType()));
      }
      // on Classification name change - update tag's name under classification
      LOG.info("Classification FQN changed from {} to {}", oldFqn, newFqn);
      // Drop cache entries for every tag under this classification BEFORE we rewrite the DB.
      // Capture the descendants so the post-write pass can re-evict any entry a racing reader
      // re-populated with the pre-rename row between this call and tagDAO.updateFqn below. The
      // pass below runs after updateFqn but inside this transaction — see
      // EntityCaches.targets().beforeRename for the residual pre-commit window.
      List<EntityDAO.EntityIdFqnPair> renamedTags =
          EntityCaches.targets().beforeRename(Entity.TAG, oldFqn);
      // Drop cached entity JSON / bundle for every entity tagged with any tag under this
      // classification. Tags live in the TAG entity table with FQNs starting with the
      // classification FQN, so the descendant helper finds them correctly.
      EntityCaches.targets().taggedDescendants(Entity.TAG, oldFqn);
      context().dependencies().daos().tagDAO().updateFqn(oldFqn, newFqn);
      context()
          .dependencies()
          .daos()
          .tagUsageDAO()
          .updateTagPrefix(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);
      entityUpdate.recordChange("name", FullyQualifiedName.unquoteName(oldFqn), updated.getName());
      updateEntityLinks(oldFqn, newFqn, updated);
      updateAssetIndexes(oldFqn, newFqn);
      PolicyConditionUpdater.updateAllPolicyConditions(
          condition ->
              PolicyConditionUpdater.renamePrefixInCondition(
                  condition, oldFqn, newFqn, PolicyConditionUpdater.TAG_FUNCTIONS));
      invalidateClassification(updated.getId());
      EntityCaches.targets().afterRename(Entity.TAG, renamedTags);
    }

    private void updateEntityLinks(String oldFqn, String newFqn, Classification updated) {
      context().dependencies().daos().fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);
      ConversationRepository conversations = Entity.getConversationRepository();
      conversations.updateEntityReference(updated.getEntityReference(), oldFqn);
      List<Tag> childTags = getAllTagsByClassification(updated);
      for (Tag child : childTags) {
        String childNewFqn = child.getFullyQualifiedName();
        String childOldFqn = oldFqn + childNewFqn.substring(newFqn.length());
        conversations.updateEntityReference(child.getEntityReference(), childOldFqn);
      }
    }

    private void invalidateClassification(UUID classificationId) {
      // Name of the classification changed. Invalidate the classification and all the children tags
      EntityCaches.byId().invalidate(new ImmutablePair<>(CLASSIFICATION, classificationId));
      List<EntityRelationshipRecord> tagRecords =
          relationships()
              .toRecords(
                  new EntityRelationshipReader.Selection(
                      classificationId, CLASSIFICATION, Relationship.CONTAINS, TAG));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTags(tagRecord.getId());
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

    private final EntityUpdater<Classification> entityUpdate;

    public EntityUpdater<Classification> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Classification> entityContext;

  @Override
  public final EntityPolicyContext<Classification> context() {
    return entityContext;
  }
}
