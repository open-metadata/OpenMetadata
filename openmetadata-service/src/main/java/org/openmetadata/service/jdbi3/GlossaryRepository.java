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
import static org.openmetadata.csv.CsvUtil.FIELD_SEPARATOR;
import static org.openmetadata.csv.CsvUtil.addEntityReference;
import static org.openmetadata.csv.CsvUtil.addEntityReferences;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addOwner;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.ImmutablePair;
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
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
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
  }

  @Override
  public Glossary setFields(Glossary glossary, Fields fields) {
    glossary.setTermCount(fields.contains("termCount") ? getTermCount(glossary) : glossary.getTermCount());
    return glossary.withUsageCount(fields.contains("usageCount") ? getUsageCount(glossary) : glossary.getUsageCount());
  }

  @Override
  public Glossary clearFields(Glossary glossary, Fields fields) {
    glossary.setTermCount(fields.contains("termCount") ? glossary.getTermCount() : null);
    return glossary.withUsageCount(fields.contains("usageCount") ? glossary.getUsageCount() : null);
  }

  @Override
  public void prepare(Glossary glossary, boolean update) {
    validateUsers(glossary.getReviewers());
  }

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
    for (EntityReference reviewer : listOrEmpty(glossary.getReviewers())) {
      addRelationship(reviewer.getId(), glossary.getId(), Entity.USER, Entity.GLOSSARY, Relationship.REVIEWS);
    }
  }

  private Integer getUsageCount(Glossary glossary) {
    return daoCollection.tagUsageDAO().getTagCount(TagSource.GLOSSARY.ordinal(), glossary.getName());
  }

  private Integer getTermCount(Glossary glossary) {
    ListFilter filter =
        new ListFilter(Include.NON_DELETED).addQueryParam("parent", FullyQualifiedName.build(glossary.getName()));
    return daoCollection.glossaryTermDAO().listCount(filter);
  }

  @Override
  public EntityUpdater getUpdater(Glossary original, Glossary updated, Operation operation) {
    return new GlossaryUpdater(original, updated, operation);
  }

  /** Export glossary as CSV */
  @Override
  public String exportToCsv(String name, String user) throws IOException {
    Glossary glossary = getByName(null, name, Fields.EMPTY_FIELDS); // Validate glossary name
    GlossaryTermRepository repository = (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
    ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("parent", name);
    List<GlossaryTerm> terms = repository.listAll(repository.getFields("owner,reviewers,tags,relatedTerms"), filter);
    terms.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return new GlossaryCsv(glossary, user).exportCsv(terms);
  }

  /** Load CSV provided for bulk upload */
  @Override
  public CsvImportResult importFromCsv(String name, String csv, boolean dryRun, String user) throws IOException {
    Glossary glossary = getByName(null, name, Fields.EMPTY_FIELDS); // Validate glossary name
    GlossaryCsv glossaryCsv = new GlossaryCsv(glossary, user);
    return glossaryCsv.importCsv(csv, dryRun);
  }

  public static class GlossaryCsv extends EntityCsv<GlossaryTerm> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(Entity.GLOSSARY);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();
    private final Glossary glossary;

    GlossaryCsv(Glossary glossary, String user) {
      super(GLOSSARY_TERM, DOCUMENTATION.getHeaders(), user);
      this.glossary = glossary;
    }

    @Override
    protected GlossaryTerm toEntity(CSVPrinter printer, CSVRecord csvRecord) throws IOException {
      GlossaryTerm glossaryTerm = new GlossaryTerm().withGlossary(glossary.getEntityReference());

      // Field 1 - parent term
      glossaryTerm.withParent(getEntityReference(printer, csvRecord, 0, GLOSSARY_TERM));
      if (!processRecord) {
        return null;
      }

      // Field 2,3,4 - Glossary name, displayName, description
      glossaryTerm.withName(csvRecord.get(1)).withDisplayName(csvRecord.get(2)).withDescription(csvRecord.get(3));

      // Field 5 - Synonym list
      glossaryTerm.withSynonyms(CsvUtil.fieldToStrings(csvRecord.get(4)));

      // Field 6 - Related terms
      glossaryTerm.withRelatedTerms(getEntityReferences(printer, csvRecord, 5, GLOSSARY_TERM));
      if (!processRecord) {
        return null;
      }

      // Field 7 - TermReferences
      glossaryTerm.withReferences(getTermReferences(printer, csvRecord));
      if (!processRecord) {
        return null;
      }

      // Field 8 - tags
      glossaryTerm.withTags(getTagLabels(printer, csvRecord, 7));
      if (!processRecord) {
        return null;
      }

      // Field 9 - reviewers
      glossaryTerm.withReviewers(getUserOrTeamEntityReferences(printer, csvRecord, 8, Entity.USER));
      if (!processRecord) {
        return null;
      }
      // Field 10 - owner
      glossaryTerm.withOwner(getOwner(printer, csvRecord, 9));

      // Field 11 - status
      glossaryTerm.withStatus(getTermStatus(printer, csvRecord));
      return glossaryTerm;
    }

    private List<TermReference> getTermReferences(CSVPrinter printer, CSVRecord csvRecord) throws IOException {
      String termRefs = csvRecord.get(6);
      if (nullOrEmpty(termRefs)) {
        return null;
      }
      List<String> termRefList = CsvUtil.fieldToStrings(termRefs);
      if (termRefList.size() % 2 != 0) {
        // List should have even numbered terms - termName and endPoint
        importFailure(printer, invalidField(6, "Term references should termName;endpoint"), csvRecord);
        processRecord = false;
        return null;
      }
      List<TermReference> list = new ArrayList<>();
      for (int i = 0; i < termRefList.size(); ) {
        list.add(new TermReference().withName(termRefList.get(i++)).withEndpoint(URI.create(termRefList.get(i++))));
      }
      return list;
    }

    private Status getTermStatus(CSVPrinter printer, CSVRecord csvRecord) throws IOException {
      String termStatus = csvRecord.get(10);
      try {
        return nullOrEmpty(termStatus) ? Status.DRAFT : Status.fromValue(termStatus);
      } catch (Exception ex) {
        // List should have even numbered terms - termName and endPoint
        importFailure(
            printer, invalidField(10, String.format("Glossary term status %s is invalid", termStatus)), csvRecord);
        processRecord = false;
        return null;
      }
    }

    @Override
    protected List<String> toRecord(GlossaryTerm entity) {
      List<String> recordList = new ArrayList<>();
      addEntityReference(recordList, entity.getParent());
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      CsvUtil.addFieldList(recordList, entity.getSynonyms());
      addEntityReferences(recordList, entity.getRelatedTerms());
      addField(recordList, termReferencesToRecord(entity.getReferences()));
      addTagLabels(recordList, entity.getTags());
      addField(recordList, reviewerReferencesToRecord(entity.getReviewers()));
      addOwner(recordList, entity.getOwner());
      addField(recordList, entity.getStatus().value());
      return recordList;
    }

    private String termReferencesToRecord(List<TermReference> list) {
      return nullOrEmpty(list)
          ? null
          : list.stream()
              .map(termReference -> termReference.getName() + CsvUtil.FIELD_SEPARATOR + termReference.getEndpoint())
              .collect(Collectors.joining(FIELD_SEPARATOR));
    }

    private String reviewerReferencesToRecord(List<EntityReference> reviewers) {
      return nullOrEmpty(reviewers)
          ? null
          : reviewers.stream().map(EntityReference::getName).collect(Collectors.joining(FIELD_SEPARATOR));
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class GlossaryUpdater extends EntityUpdater {
    public GlossaryUpdater(Glossary original, Glossary updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate() {
      updateName(original, updated);
    }

    public void updateName(Glossary original, Glossary updated) {
      if (!original.getName().equals(updated.getName())) {
        if (ProviderType.SYSTEM.equals(original.getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
        }
        // Glossary name changed - update tag names starting from glossary and all the children tags
        LOG.info("Glossary name changed from {} to {}", original.getName(), updated.getName());
        daoCollection.glossaryTermDAO().updateFqn(original.getName(), updated.getName());
        daoCollection
            .tagUsageDAO()
            .updateTagPrefix(TagSource.GLOSSARY.ordinal(), original.getName(), updated.getName());
        recordChange("name", original.getName(), updated.getName());
        invalidateGlossary(original.getId());
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
      // The name of the glossary changed or parent changed. Invalidate that tag and all the children from the cache
      List<EntityRelationshipRecord> tagRecords =
          findToRecords(termId, GLOSSARY_TERM, Relationship.CONTAINS, GLOSSARY_TERM);
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(GLOSSARY_TERM, termId));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTerms(tagRecord.getId());
      }
    }
  }
}
