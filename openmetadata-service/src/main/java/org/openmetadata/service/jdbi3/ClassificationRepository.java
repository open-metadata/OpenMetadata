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
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.tags.ClassificationResource;
import org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class ClassificationRepository extends EntityRepository<Classification> {
  public ClassificationRepository() {
    super(
        ClassificationResource.TAG_COLLECTION_PATH,
        Entity.CLASSIFICATION,
        Classification.class,
        Entity.getCollectionDAO().classificationDAO(),
        "",
        "");
    quoteFqn = true;
    supportsSearch = true;
    renameAllowed = true;
  }

  @Override
  protected void postDelete(Classification entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    PolicyConditionUpdater.updateAllPolicyConditions(
        condition ->
            PolicyConditionUpdater.removeByPrefixFromCondition(
                condition, entity.getFullyQualifiedName(), PolicyConditionUpdater.TAG_FUNCTIONS));
  }

  @Override
  public EntityRepository<Classification>.EntityUpdater getUpdater(
      Classification original,
      Classification updated,
      Operation operation,
      ChangeSource changeSource) {
    return new ClassificationUpdater(original, updated, operation);
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
    fetchAndSetFields(entities, fields);
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
          daoCollection.classificationDAO().bulkGetTermCounts(classificationHashes);

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
        int count = daoCollection.tagDAO().listCount(filterWithParent);
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
        daoCollection
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
    store(classification, update);
  }

  @Override
  public void storeRelationships(Classification entity) {
    // No relationships to store beyond what is stored in the super class
  }

  private int getTermCount(Classification classification) {
    ListFilter filter =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("parent", classification.getFullyQualifiedName());
    return daoCollection.tagDAO().listCount(filter);
  }

  private Integer getUsageCount(Classification classification) {
    return daoCollection
        .tagUsageDAO()
        .getTagCount(TagSource.CLASSIFICATION.ordinal(), classification.getFullyQualifiedName());
  }

  /** Export a classification with all its tags as CSV */
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

  /** Import tags into a classification from CSV */
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
        repository.listAllForCSV(
            repository.getFields("owners,reviewers,parent,domains"),
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
          ((TagRepository) Entity.getEntityRepository(TAG)).findByNameOrNull(tagFqn, Include.ALL);
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
    super.entityRelationshipReindex(original, updated);

    if (!Objects.equals(original.getFullyQualifiedName(), updated.getFullyQualifiedName())
        || !Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      updateAssetIndexes(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
    }
  }

  private void updateAssetIndexes(String oldFqn, String newFqn) {
    searchRepository.deferIfFlushScopeActive(
        () -> runAssetIndexRewrite(oldFqn, newFqn),
        "classificationUpdateAssetIndexes",
        null,
        newFqn,
        Entity.TAG);
  }

  private void runAssetIndexRewrite(String oldFqn, String newFqn) {
    searchRepository
        .getSearchClient()
        .updateClassificationTagByFqnPrefix(GLOBAL_SEARCH_ALIAS, oldFqn, newFqn, TAGS_FQN);
    searchRepository
        .getSearchClient()
        .updateByFqnPrefix(TAG_SEARCH_INDEX, oldFqn, newFqn, "fullyQualifiedName");
  }

  private List<Tag> getAllTagsByClassification(Classification classification) {
    // Get all the tags under the specified classification
    List<String> jsons =
        daoCollection.tagDAO().getTagsStartingWithPrefix(classification.getFullyQualifiedName());
    return JsonUtils.readObjects(jsons, Tag.class);
  }

  public class ClassificationUpdater extends EntityUpdater {
    private boolean renameProcessed = false;

    public ClassificationUpdater(
        Classification original, Classification updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    protected void resetForRetryAttempt() {
      renameProcessed = false;
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      // Mutually exclusive cannot be updated
      updated.setMutuallyExclusive(original.getMutuallyExclusive());
      preserveAutoClassificationConfigOnPut();
      compareAndUpdate(
          "disabled",
          () -> recordChange("disabled", original.getDisabled(), updated.getDisabled()));
      compareAndUpdate(
          "autoClassificationConfig",
          () ->
              recordChange(
                  "autoClassificationConfig",
                  original.getAutoClassificationConfig(),
                  updated.getAutoClassificationConfig(),
                  true));
      compareAndUpdate("name", () -> updateName(updated));
    }

    private void preserveAutoClassificationConfigOnPut() {
      if (operation == Operation.PUT && updated.getAutoClassificationConfig() == null) {
        updated.setAutoClassificationConfig(original.getAutoClassificationConfig());
      }
    }

    public void updateName(Classification updated) {
      // Use getOriginalFqn() which was captured at EntityUpdater construction time.
      String oldFqn = getOriginalFqn();
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

      if (ProviderType.SYSTEM.equals(original.getProvider())) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
      }

      // on Classification name change - update tag's name under classification
      LOG.info("Classification FQN changed from {} to {}", oldFqn, newFqn);
      // Drop cache entries for every tag under this classification BEFORE we rewrite the DB.
      // Capture the descendants so the post-write pass can re-evict any entry a racing reader
      // re-populated with the pre-rename row between this call and tagDAO.updateFqn below. The
      // pass below runs after updateFqn but inside this transaction — see
      // EntityRepository.invalidateCacheForRenameCascade for the residual pre-commit window.
      List<EntityDAO.EntityIdFqnPair> renamedTags =
          invalidateCacheForRenameCascade(Entity.TAG, oldFqn);
      // Drop cached entity JSON / bundle for every entity tagged with any tag under this
      // classification. Tags live in the TAG entity table with FQNs starting with the
      // classification FQN, so the descendant helper finds them correctly.
      invalidateCacheForTaggedEntitiesAndDescendants(Entity.TAG, oldFqn);
      daoCollection.tagDAO().updateFqn(oldFqn, newFqn);
      daoCollection
          .tagUsageDAO()
          .updateTagPrefix(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);
      recordChange("name", FullyQualifiedName.unquoteName(oldFqn), updated.getName());

      updateEntityLinks(oldFqn, newFqn, updated);
      updateAssetIndexes(oldFqn, newFqn);

      PolicyConditionUpdater.updateAllPolicyConditions(
          condition ->
              PolicyConditionUpdater.renamePrefixInCondition(
                  condition, oldFqn, newFqn, PolicyConditionUpdater.TAG_FUNCTIONS));

      invalidateClassification(updated.getId());
      finishInvalidateCacheForRenameCascade(Entity.TAG, renamedTags);
    }

    private void updateEntityLinks(String oldFqn, String newFqn, Classification updated) {
      daoCollection.fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);

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
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(CLASSIFICATION, classificationId));
      List<EntityRelationshipRecord> tagRecords =
          findToRecords(classificationId, CLASSIFICATION, Relationship.CONTAINS, TAG);
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTags(tagRecord.getId());
      }
    }

    private void invalidateTags(UUID tagId) {
      // The name of the tag changed. Invalidate that tag and all the children from the cache
      List<EntityRelationshipRecord> tagRecords =
          findToRecords(tagId, TAG, Relationship.CONTAINS, TAG);
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(TAG, tagId));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTags(tagRecord.getId());
      }
    }
  }
}
