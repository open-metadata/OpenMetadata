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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.FIELD_SEPARATOR;
import static org.openmetadata.csv.CsvUtil.addEntityReference;
import static org.openmetadata.csv.CsvUtil.addEntityReferences;
import static org.openmetadata.csv.CsvUtil.addExtension;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addReviewers;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.search.SearchClient.GLOSSARY_TERM_SEARCH_INDEX;
import static org.openmetadata.service.util.EntityUtil.compareTagLabel;

import com.google.gson.Gson;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
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
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
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
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.glossary.GlossaryResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class GlossaryRepository extends EntityRepository<Glossary> {
  private static final String UPDATE_FIELDS = "";
  private static final String PATCH_FIELDS = "";

  public GlossaryRepository() {
    super(
        GlossaryResource.COLLECTION_PATH,
        Entity.GLOSSARY,
        Glossary.class,
        Entity.getCollectionDAO().glossaryDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    quoteFqn = true;
    supportsSearch = true;
    renameAllowed = true;
  }

  @Override
  public void setFields(Glossary glossary, Fields fields, RelationIncludes relationIncludes) {
    glossary.setTermCount(
        fields.contains("termCount") ? getTermCount(glossary) : glossary.getTermCount());
    glossary.withUsageCount(
        fields.contains("usageCount") ? getUsageCount(glossary) : glossary.getUsageCount());
  }

  @Override
  public void clearFields(Glossary glossary, Fields fields) {
    glossary.setTermCount(fields.contains("termCount") ? glossary.getTermCount() : null);
    glossary.withUsageCount(fields.contains("usageCount") ? glossary.getUsageCount() : null);
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Glossary> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    // Call parent method to handle common fields like owners, tags, etc.
    super.setFieldsInBulk(fields, entities);

    // Bulk fetch term counts if needed
    if (fields.contains("termCount")) {
      Map<String, Integer> termCountMap = batchGetTermCounts(entities);
      for (Glossary glossary : entities) {
        glossary.setTermCount(termCountMap.getOrDefault(glossary.getName(), 0));
      }
    }

    // Bulk fetch usage counts if needed
    if (fields.contains("usageCount")) {
      Map<String, Integer> usageCountMap = batchGetUsageCounts(entities);
      for (Glossary glossary : entities) {
        glossary.withUsageCount(usageCountMap.getOrDefault(glossary.getName(), 0));
      }
    }
  }

  private Map<String, Integer> batchGetTermCounts(List<Glossary> glossaries) {
    Map<String, Integer> termCountMap = new HashMap<>();
    for (Glossary glossary : glossaries) {
      ListFilter filter =
          new ListFilter(Include.NON_DELETED)
              .addQueryParam("parent", FullyQualifiedName.build(glossary.getName()));
      int count = daoCollection.glossaryTermDAO().listCount(filter);
      termCountMap.put(glossary.getName(), count);
    }
    return termCountMap;
  }

  private Map<String, Integer> batchGetUsageCounts(List<Glossary> glossaries) {
    Map<String, Integer> usageCountMap = new HashMap<>();
    for (Glossary glossary : glossaries) {
      int count =
          daoCollection.tagUsageDAO().getTagCount(TagSource.GLOSSARY.ordinal(), glossary.getName());
      usageCountMap.put(glossary.getName(), count);
    }
    return usageCountMap;
  }

  @Override
  public void prepare(Glossary glossary, boolean update) {}

  @Override
  public void storeEntity(Glossary glossary, boolean update) {
    // Relationships and fields such as reviewers are derived and not stored as part of json
    List<EntityReference> reviewers = glossary.getReviewers();
    glossary.withReviewers(null);
    store(glossary, update);
    glossary.withReviewers(reviewers);
  }

  @Override
  public void storeEntities(List<Glossary> entities) {
    List<Glossary> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();

    for (Glossary glossary : entities) {
      List<EntityReference> reviewers = glossary.getReviewers();

      glossary.withReviewers(null);

      String jsonCopy = gson.toJson(glossary);
      entitiesToStore.add(gson.fromJson(jsonCopy, Glossary.class));

      glossary.withReviewers(reviewers);
    }

    storeMany(entitiesToStore);
  }

  @Override
  public void storeRelationships(Glossary glossary) {
    // Nothing to do
  }

  private Integer getUsageCount(Glossary glossary) {
    return daoCollection
        .tagUsageDAO()
        .getTagCount(TagSource.GLOSSARY.ordinal(), glossary.getName());
  }

  private Integer getTermCount(Glossary glossary) {
    ListFilter filter =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("parent", FullyQualifiedName.build(glossary.getName()));
    return daoCollection.glossaryTermDAO().listCount(filter);
  }

  @Override
  public EntityRepository<Glossary>.EntityUpdater getUpdater(
      Glossary original, Glossary updated, Operation operation, ChangeSource changeSource) {
    return new GlossaryUpdater(original, updated, operation);
  }

  @Override
  public void entityRelationshipReindex(Glossary original, Glossary updated) {
    super.entityRelationshipReindex(original, updated);
    if (!Objects.equals(original.getFullyQualifiedName(), updated.getFullyQualifiedName())
        || !Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      updateAssetIndexes(original, updated);
    }
  }

  /** Export glossary as CSV */
  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    return exportToCsv(name, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    Glossary glossary = getByName(null, name, Fields.EMPTY_FIELDS); // Validate glossary name
    GlossaryTermRepository repository =
        (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
    List<GlossaryTerm> terms =
        repository.listAllForCSV(
            repository.getFields("owners,reviewers,tags,relatedTerms,synonyms,extension,parent"),
            glossary.getFullyQualifiedName());
    terms.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return new GlossaryCsv(glossary, user).exportCsv(terms, callback);
  }

  /** Load CSV provided for bulk upload */
  @Override
  public CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      CsvImportProgressCallback callback)
      throws IOException {
    Glossary glossary = getByName(null, name, Fields.EMPTY_FIELDS);
    GlossaryCsv glossaryCsv = new GlossaryCsv(glossary, user);
    return glossaryCsv.importCsv(csv, dryRun, callback);
  }

  public static class GlossaryCsv extends EntityCsv<GlossaryTerm> {
    public static final CsvDocumentation DOCUMENTATION =
        getCsvDocumentation(Entity.GLOSSARY, false);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();
    private final Glossary glossary;

    GlossaryCsv(Glossary glossary, String user) {
      super(GLOSSARY_TERM, HEADERS, user);
      this.glossary = glossary;
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      GlossaryTermRepository repository =
          (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      if (csvRecord == null) return;
      GlossaryTerm glossaryTerm = new GlossaryTerm().withGlossary(glossary.getEntityReference());
      String glossaryTermFqn =
          nullOrEmpty(csvRecord.get(0))
              ? FullyQualifiedName.build(glossary.getFullyQualifiedName(), csvRecord.get(1))
              : FullyQualifiedName.add(csvRecord.get(0), csvRecord.get(1));

      // TODO add header
      // Handle parent GlossaryTerm with dependency resolution
      EntityReference parentRef = null;
      String parentFqn = csvRecord.get(0);
      if (!nullOrEmpty(parentFqn)) {
        try {
          GlossaryTerm parentTerm =
              getEntityWithDependencyResolution(GLOSSARY_TERM, parentFqn, "*", Include.NON_DELETED);
          parentRef = parentTerm.getEntityReference();
        } catch (EntityNotFoundException ex) {
          // Fall back to regular lookup
          parentRef = getEntityReference(printer, csvRecord, 0, GLOSSARY_TERM);
        }
      }

      glossaryTerm
          .withParent(parentRef)
          .withName(csvRecord.get(1))
          .withFullyQualifiedName(glossaryTermFqn)
          .withDisplayName(csvRecord.get(2))
          .withDescription(csvRecord.get(3))
          .withSynonyms(CsvUtil.fieldToStrings(csvRecord.get(4)))
          .withRelatedTerms(getEntityReferencesForGlossaryTerms(printer, csvRecord, 5))
          .withReferences(getTermReferences(printer, csvRecord))
          .withTags(
              getTagLabels(
                  printer, csvRecord, List.of(Pair.of(7, TagLabel.TagSource.CLASSIFICATION))))
          .withReviewers(getReviewers(printer, csvRecord, 8))
          .withOwners(getOwners(printer, csvRecord, 9))
          .withEntityStatus(getTermStatus(printer, csvRecord))
          .withStyle(getStyle(csvRecord))
          .withExtension(getExtension(printer, csvRecord, 13));

      // Validate to catch logical errors for both dry run and actual import
      if (processRecord) {
        try {
          repository.validateForDryRun(glossaryTerm, dryRunCreatedEntities);
        } catch (Exception ex) {
          importFailure(printer, ex.getMessage(), csvRecord);
          processRecord = false;
          return;
        }
      }

      if (processRecord) {
        createEntity(printer, csvRecord, glossaryTerm, GLOSSARY_TERM);
      }
    }

    private List<TermReference> getTermReferences(CSVPrinter printer, CSVRecord csvRecord)
        throws IOException {
      if (!processRecord) {
        return null;
      }
      String termRefs = csvRecord.get(6);
      if (nullOrEmpty(termRefs)) {
        return null;
      }
      List<String> termRefList = CsvUtil.fieldToStrings(termRefs);
      if (termRefList.size() % 2 != 0) {
        // List should have even numbered terms - termName and endPoint
        importFailure(
            printer,
            invalidField(
                6, "Term References should be given in the format referenceName;endpoint url."),
            csvRecord);
        processRecord = false;
        return null;
      }
      List<TermReference> list = new ArrayList<>();
      for (int i = 0; i < termRefList.size(); ) {
        list.add(
            new TermReference()
                .withName(termRefList.get(i++))
                .withEndpoint(URI.create(termRefList.get(i++))));
      }
      return list;
    }

    private EntityStatus getTermStatus(CSVPrinter printer, CSVRecord csvRecord) throws IOException {
      if (!processRecord) {
        return null;
      }
      String termStatus = csvRecord.get(10);
      try {
        return nullOrEmpty(termStatus) ? EntityStatus.DRAFT : EntityStatus.fromValue(termStatus);
      } catch (Exception ex) {
        // List should have even numbered terms - termName and endPoint
        importFailure(
            printer,
            invalidField(10, String.format("Glossary term status %s is invalid", termStatus)),
            csvRecord);
        processRecord = false;
        return null;
      }
    }

    private Style getStyle(CSVRecord csvRecord) {
      if (!processRecord) {
        return null;
      }
      String color = csvRecord.get(11);
      String iconURL = csvRecord.get(12);

      // If both fields are empty, explicitly return null to remove any existing style
      if (nullOrEmpty(color) && nullOrEmpty(iconURL)) {
        return null;
      }

      Style style = new Style();
      if (!nullOrEmpty(color)) {
        style.setColor(color);
      }
      if (!nullOrEmpty(iconURL)) {
        style.setIconURL(iconURL);
      }

      return style;
    }

    @Override
    protected void addRecord(CsvFile csvFile, GlossaryTerm entity) {
      List<String> recordList = new ArrayList<>();
      addEntityReference(recordList, entity.getParent());
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      CsvUtil.addFieldList(recordList, entity.getSynonyms());
      addEntityReferences(recordList, entity.getRelatedTerms());
      addField(recordList, termReferencesToRecord(entity.getReferences()));
      addTagLabels(recordList, entity.getTags());
      addReviewers(recordList, entity.getReviewers());
      addOwners(recordList, entity.getOwners());
      addField(recordList, entity.getEntityStatus().value());
      addField(recordList, entity.getStyle() != null ? entity.getStyle().getColor() : null);
      addField(recordList, entity.getStyle() != null ? entity.getStyle().getIconURL() : null);
      addExtension(recordList, entity.getExtension());
      addRecord(csvFile, recordList);
    }

    private String termReferencesToRecord(List<TermReference> list) {
      return nullOrEmpty(list)
          ? null
          : list.stream()
              .map(
                  termReference ->
                      termReference.getName()
                          + CsvUtil.FIELD_SEPARATOR
                          + termReference.getEndpoint())
              .collect(Collectors.joining(FIELD_SEPARATOR));
    }

    private String reviewerReferencesToRecord(List<EntityReference> reviewers) {
      return nullOrEmpty(reviewers)
          ? null
          : reviewers.stream()
              .map(EntityReference::getName)
              .sorted()
              .collect(Collectors.joining(FIELD_SEPARATOR));
    }

    private String reviewerOwnerReferencesToRecord(List<EntityReference> owners) {
      return nullOrEmpty(owners)
          ? null
          : owners.stream()
              .map(EntityReference::getName)
              .collect(Collectors.joining(FIELD_SEPARATOR));
    }
  }

  private void updateAssetIndexes(Glossary original, Glossary updated) {
    // Update ES indexes of entity tagged with the glossary term and its children terms to reflect
    // its latest value.
    GlossaryTermRepository repository =
        (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
    Set<String> targetFQNHashesFromDb =
        new HashSet<>(
            daoCollection
                .tagUsageDAO()
                .getTargetFQNHashForTagPrefix(updated.getFullyQualifiedName()));
    List<GlossaryTerm> childTerms = getAllTerms(updated);

    for (GlossaryTerm child : childTerms) {
      targetFQNHashesFromDb.addAll( // for each child term find the targetFQNHashes of assets
          daoCollection.tagUsageDAO().getTargetFQNHashForTag(child.getFullyQualifiedName()));
    }

    // List of entity references tagged with the glossary term
    Map<String, EntityReference> targetFQNFromES =
        repository.getGlossaryUsageFromES(
            original.getFullyQualifiedName(), targetFQNHashesFromDb.size(), false);
    List<EntityReference> childrenTerms =
        searchRepository.getEntitiesContainingFQNFromES(
            original.getFullyQualifiedName(),
            getTermCount(updated),
            GLOSSARY_TERM_SEARCH_INDEX); // get old value of children term from ES
    for (EntityReference child : childrenTerms) {
      targetFQNFromES.putAll( // List of entity references tagged with the children term
          repository.getGlossaryUsageFromES(
              child.getFullyQualifiedName(), targetFQNHashesFromDb.size(), false));
      searchRepository.updateEntity(child); // update es index of child term
      searchRepository.getSearchClient().reindexAcrossIndices("tags.tagFQN", child);
    }

    searchRepository.updateEntityIndex(original); // update es index of child term
    searchRepository
        .getSearchClient()
        .reindexAcrossIndices("fullyQualifiedName", original.getEntityReference());
    searchRepository
        .getSearchClient()
        .reindexAcrossIndices("glossary.name", original.getEntityReference());
  }

  private void updateEntityLinksOnGlossaryRename(String oldFqn, String newFqn, Glossary updated) {
    // update field relationships for feed
    daoCollection.fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);

    MessageParser.EntityLink newAbout = new MessageParser.EntityLink(entityType, newFqn);

    daoCollection.feedDAO().updateByEntityId(newAbout.getLinkString(), updated.getId().toString());

    List<GlossaryTerm> childTerms = getAllTerms(updated);

    for (GlossaryTerm child : childTerms) {
      newAbout = new MessageParser.EntityLink(GLOSSARY_TERM, child.getFullyQualifiedName());
      daoCollection.feedDAO().updateByEntityId(newAbout.getLinkString(), child.getId().toString());
    }
  }

  private List<GlossaryTerm> getAllTerms(Glossary glossary) {
    // Get all the hierarchically nested terms of the glossary
    List<String> jsons =
        daoCollection.glossaryTermDAO().getNestedTerms(glossary.getFullyQualifiedName());
    return JsonUtils.readObjects(jsons, GlossaryTerm.class);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class GlossaryUpdater extends EntityUpdater {
    private boolean renameProcessed = false;

    public GlossaryUpdater(Glossary original, Glossary updated, Operation operation) {
      super(original, updated, operation);
      renameAllowed = true;
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateName(updated);
      // Mutually exclusive cannot be updated
      updated.setMutuallyExclusive(original.getMutuallyExclusive());
    }

    public void updateName(Glossary updated) {
      // Use getOriginalFqn() which was captured at EntityUpdater construction time.
      // This is reliable even after revert() reassigns 'original' to 'previous'.
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

      // Glossary name changed - update tag names starting from glossary and all the children tags
      LOG.info("Glossary FQN changed from {} to {}", oldFqn, newFqn);
      daoCollection.glossaryTermDAO().updateFqn(oldFqn, newFqn);
      daoCollection.tagUsageDAO().updateTagPrefix(TagSource.GLOSSARY.ordinal(), oldFqn, newFqn);
      recordChange("name", FullyQualifiedName.unquoteName(oldFqn), updated.getName());
      invalidateGlossary(updated.getId());

      // update Tags Of Glossary On Rename
      daoCollection.tagUsageDAO().deleteTagsByTarget(oldFqn);
      List<TagLabel> updatedTags = updated.getTags();
      updatedTags.sort(compareTagLabel);
      applyTags(updatedTags, newFqn);
      daoCollection
          .tagUsageDAO()
          .renameByTargetFQNHash(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);
      updateEntityLinksOnGlossaryRename(oldFqn, newFqn, updated);
    }

    @Override
    public void updateReviewers() {
      super.updateReviewers();
      GlossaryTermRepository repository =
          (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);

      // adding the reviewer in glossary  should add the person as assignee to the task - for all
      // draft terms present in glossary
      if (original.getReviewers() != null
          && updated.getReviewers() != null
          && !original.getReviewers().equals(updated.getReviewers())) {

        List<GlossaryTerm> childTerms = getAllTerms(updated);
        for (GlossaryTerm term : childTerms) {
          if (term.getEntityStatus().equals(EntityStatus.IN_REVIEW)) {
            repository.updateTaskWithNewReviewers(term);
          }
        }
      }
    }

    public void invalidateGlossary(UUID classificationId) {
      // Glossary name changed. Invalidate the glossary and its children terms
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(GLOSSARY, classificationId));
      List<EntityRelationshipRecord> tags =
          findToRecords(classificationId, GLOSSARY, Relationship.CONTAINS, GLOSSARY_TERM);
      for (EntityRelationshipRecord tagRecord : tags) {
        invalidateTerms(tagRecord.getId());
      }
    }

    private void invalidateTerms(UUID termId) {
      // The name of the glossary changed or parent changed. Invalidate that tag and all the
      // children from the cache
      List<EntityRelationshipRecord> tagRecords =
          findToRecords(termId, GLOSSARY_TERM, Relationship.CONTAINS, GLOSSARY_TERM);
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(GLOSSARY_TERM, termId));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTerms(tagRecord.getId());
      }
    }
  }
}
