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

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
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
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm.Status;
import org.openmetadata.schema.type.EntityReference;
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
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.glossary.GlossaryResource;
import org.openmetadata.service.util.EntityUtil.Fields;
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
  public void setFields(Glossary glossary, Fields fields) {
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
    Glossary glossary = getByName(null, name, Fields.EMPTY_FIELDS); // Validate glossary name
    GlossaryTermRepository repository =
        (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
    List<GlossaryTerm> terms =
        repository.listAllForCSV(
            repository.getFields("owners,reviewers,tags,relatedTerms,synonyms,extension,parent"),
            glossary.getFullyQualifiedName());
    terms.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return new GlossaryCsv(glossary, user).exportCsv(terms);
  }

  /** Load CSV provided for bulk upload */
  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    Glossary glossary = getByName(null, name, Fields.EMPTY_FIELDS); // Validate glossary name
    GlossaryCsv glossaryCsv = new GlossaryCsv(glossary, user);
    return glossaryCsv.importCsv(csv, dryRun);
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
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      GlossaryTerm glossaryTerm = new GlossaryTerm().withGlossary(glossary.getEntityReference());
      String glossaryTermFqn =
          nullOrEmpty(csvRecord.get(0))
              ? FullyQualifiedName.build(glossary.getFullyQualifiedName(), csvRecord.get(1))
              : FullyQualifiedName.add(csvRecord.get(0), csvRecord.get(1));

      // TODO add header
      glossaryTerm
          .withParent(getEntityReference(printer, csvRecord, 0, GLOSSARY_TERM))
          .withName(csvRecord.get(1))
          .withFullyQualifiedName(glossaryTermFqn)
          .withDisplayName(csvRecord.get(2))
          .withDescription(csvRecord.get(3))
          .withSynonyms(CsvUtil.fieldToStrings(csvRecord.get(4)))
          .withRelatedTerms(getEntityReferences(printer, csvRecord, 5, GLOSSARY_TERM))
          .withReferences(getTermReferences(printer, csvRecord))
          .withTags(
              getTagLabels(
                  printer, csvRecord, List.of(Pair.of(7, TagLabel.TagSource.CLASSIFICATION))))
          .withReviewers(getReviewers(printer, csvRecord, 8))
          .withOwners(getOwners(printer, csvRecord, 9))
          .withStatus(getTermStatus(printer, csvRecord))
          .withExtension(getExtension(printer, csvRecord, 11));
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

    private Status getTermStatus(CSVPrinter printer, CSVRecord csvRecord) throws IOException {
      if (!processRecord) {
        return null;
      }
      String termStatus = csvRecord.get(10);
      try {
        return nullOrEmpty(termStatus) ? Status.DRAFT : Status.fromValue(termStatus);
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
      addField(recordList, entity.getStatus().value());
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

  private void updateEntityLinksOnGlossaryRename(Glossary original, Glossary updated) {
    // update field relationships for feed
    daoCollection
        .fieldRelationshipDAO()
        .renameByToFQN(original.getFullyQualifiedName(), updated.getFullyQualifiedName());

    MessageParser.EntityLink about =
        new MessageParser.EntityLink(GLOSSARY_TERM, original.getFullyQualifiedName());

    MessageParser.EntityLink newAbout =
        new MessageParser.EntityLink(entityType, updated.getFullyQualifiedName());

    daoCollection.feedDAO().updateByEntityId(newAbout.getLinkString(), original.getId().toString());

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
    public GlossaryUpdater(Glossary original, Glossary updated, Operation operation) {
      super(original, updated, operation);
      renameAllowed = true;
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateName(original, updated);
      // Mutually exclusive cannot be updated
      updated.setMutuallyExclusive(original.getMutuallyExclusive());
    }

    public void updateName(Glossary original, Glossary updated) {
      if (!original.getName().equals(updated.getName())) {
        if (ProviderType.SYSTEM.equals(original.getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
        }
        // Glossary name changed - update tag names starting from glossary and all the children tags
        LOG.info("Glossary name changed from {} to {}", original.getName(), updated.getName());
        setFullyQualifiedName(updated);
        daoCollection
            .glossaryTermDAO()
            .updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
        daoCollection
            .tagUsageDAO()
            .updateTagPrefix(
                TagSource.GLOSSARY.ordinal(),
                original.getFullyQualifiedName(),
                updated.getFullyQualifiedName());
        recordChange("name", original.getName(), updated.getName());
        invalidateGlossary(original.getId());

        // update Tags Of Glossary On Rename
        daoCollection.tagUsageDAO().deleteTagsByTarget(original.getFullyQualifiedName());
        List<TagLabel> updatedTags = updated.getTags();
        updatedTags.sort(compareTagLabel);
        applyTags(updatedTags, updated.getFullyQualifiedName());
        daoCollection
            .tagUsageDAO()
            .renameByTargetFQNHash(
                TagSource.CLASSIFICATION.ordinal(),
                original.getFullyQualifiedName(),
                updated.getFullyQualifiedName());
        updateEntityLinksOnGlossaryRename(original, updated);
      }
    }

    @Override
    public void updateReviewers() {
      super.updateReviewers();
      GlossaryTermRepository repository =
          (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);

      // adding the reviewer in glossary  should add the person as assignee to the task - for all
      // draft terms present in glossary
      if (!original.getReviewers().equals(updated.getReviewers())) {

        List<GlossaryTerm> childTerms = getAllTerms(updated);
        for (GlossaryTerm term : childTerms) {
          if (term.getStatus().equals(Status.IN_REVIEW)) {
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
