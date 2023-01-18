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
import static org.openmetadata.csv.CsvUtil.addEntityReference;
import static org.openmetadata.csv.CsvUtil.addEntityReferences;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addTagLabels;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.glossary.GlossaryResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class GlossaryRepository extends EntityRepository<Glossary> {
  private static final String UPDATE_FIELDS = "owner,tags,reviewers";
  private static final String PATCH_FIELDS = "owner,tags,reviewers";

  public GlossaryRepository(CollectionDAO dao) {
    super(
        GlossaryResource.COLLECTION_PATH,
        Entity.GLOSSARY,
        Glossary.class,
        dao.glossaryDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public Glossary setFields(Glossary glossary, Fields fields) throws IOException {
    glossary.setTermCount(fields.contains("termCount") ? getTermCount(glossary) : null);
    glossary.setReviewers(fields.contains("reviewers") ? getReviewers(glossary) : null);
    return glossary.withUsageCount(fields.contains("usageCount") ? getUsageCount(glossary) : null);
  }

  @Override
  public void prepare(Glossary glossary) throws IOException {
    validateUsers(glossary.getReviewers());
  }

  @Override
  public void storeEntity(Glossary glossary, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = glossary.getOwner();
    List<TagLabel> tags = glossary.getTags();
    List<EntityReference> reviewers = glossary.getReviewers();

    // Don't store owner, href and tags as JSON. Build it on the fly based on relationships
    glossary.withOwner(null).withHref(null).withTags(null);

    store(glossary, update);

    // Restore the relationships
    glossary.withOwner(owner).withTags(tags).withReviewers(reviewers);
  }

  @Override
  public void storeRelationships(Glossary glossary) {
    storeOwner(glossary, glossary.getOwner());
    applyTags(glossary);
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

  @Override
  public String exportToCsv(String name, String user) throws IOException {
    Glossary glossary = getByName(null, name, Fields.EMPTY_FIELDS); // Validate glossary name
    EntityRepository<GlossaryTerm> repository = Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("parent", name);
    List<GlossaryTerm> terms = repository.listAll(repository.getFields("reviewers,tags,relatedTerms"), filter);
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
    public static final List<CsvHeader> HEADERS = new ArrayList<>();
    private final Glossary glossary;

    static {
      HEADERS.add(new CsvHeader().withName("parent").withRequired(false));
      HEADERS.add(new CsvHeader().withName("name").withRequired(true));
      HEADERS.add(new CsvHeader().withName("displayName").withRequired(false));
      HEADERS.add(new CsvHeader().withName("description").withRequired(true));
      HEADERS.add(new CsvHeader().withName("synonyms").withRequired(false));
      HEADERS.add(new CsvHeader().withName("relatedTerms").withRequired(false));
      HEADERS.add(new CsvHeader().withName("references").withRequired(false));
      HEADERS.add(new CsvHeader().withName("tags").withRequired(false));
    }

    GlossaryCsv(Glossary glossary, String user) {
      super(Entity.GLOSSARY_TERM, HEADERS, user);
      this.glossary = glossary;
    }

    @Override
    protected GlossaryTerm toEntity(CSVPrinter printer, CSVRecord record) throws IOException {
      GlossaryTerm glossaryTerm = new GlossaryTerm().withGlossary(glossary.getEntityReference());

      // Field 1 - parent term
      glossaryTerm.withParent(getEntityReference(printer, record, 0, Entity.GLOSSARY_TERM));
      if (!processRecord) {
        return null;
      }

      // Field 2,3,4 - Glossary name, displayName, description
      glossaryTerm.withName(record.get(1)).withDisplayName(record.get(2)).withDescription(record.get(3));

      // Field 5 - Synonym list
      glossaryTerm.withSynonyms(CsvUtil.fieldToStrings(record.get(4)));

      // Field 6 - Related terms
      glossaryTerm.withRelatedTerms(getEntityReferences(printer, record, 5, Entity.GLOSSARY_TERM));
      if (!processRecord) {
        return null;
      }

      // Field 7 - TermReferences
      glossaryTerm.withReferences(getTermReferences(printer, record, 6));
      if (!processRecord) {
        return null;
      }

      // Field 8 - tags
      glossaryTerm.withTags(getTagLabels(printer, record, 7));
      if (!processRecord) {
        return null;
      }
      return glossaryTerm;
    }

    private List<TermReference> getTermReferences(CSVPrinter printer, CSVRecord record, int fieldNumber)
        throws IOException {
      String termRefs = record.get(fieldNumber);
      if (nullOrEmpty(termRefs)) {
        return null;
      }
      List<String> termRefList = CsvUtil.fieldToStrings(termRefs);
      if (termRefList.size() % 2 != 0) {
        // List should have even numbered terms - termName and endPoint
        importFailure(printer, invalidField(fieldNumber, "Term references should termName;endpoint"), record);
        processRecord = false;
        return null;
      }
      List<TermReference> list = new ArrayList<>();
      for (int i = 0; i < termRefList.size(); ) {
        list.add(new TermReference().withName(termRefList.get(i++)).withEndpoint(URI.create(termRefList.get(i++))));
      }
      return list;
    }

    @Override
    protected List<String> toRecord(GlossaryTerm entity) {
      List<String> record = new ArrayList<>();
      addEntityReference(record, entity.getParent());
      addField(record, entity.getName());
      addField(record, entity.getDisplayName());
      addField(record, entity.getDescription());
      CsvUtil.addFieldList(record, entity.getSynonyms());
      addEntityReferences(record, entity.getRelatedTerms());
      addField(record, termReferencesToRecord(entity.getReferences()));
      addTagLabels(record, entity.getTags());
      return record;
    }

    private String termReferencesToRecord(List<TermReference> list) {
      return nullOrEmpty(list)
          ? null
          : list.stream()
              .map(termReference -> termReference.getName() + CsvUtil.FIELD_SEPARATOR + termReference.getEndpoint())
              .collect(Collectors.joining(";"));
    }
  }

  private List<EntityReference> getReviewers(Glossary entity) throws IOException {
    List<EntityRelationshipRecord> ids = findFrom(entity.getId(), Entity.GLOSSARY, Relationship.REVIEWS, Entity.USER);
    return EntityUtil.populateEntityReferences(ids, Entity.USER);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class GlossaryUpdater extends EntityUpdater {
    public GlossaryUpdater(Glossary original, Glossary updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateReviewers(original, updated);
      updateName(original, updated);
    }

    private void updateReviewers(Glossary origGlossary, Glossary updatedGlossary) throws JsonProcessingException {
      List<EntityReference> origUsers = listOrEmpty(origGlossary.getReviewers());
      List<EntityReference> updatedUsers = listOrEmpty(updatedGlossary.getReviewers());
      updateFromRelationships(
          "reviewers",
          Entity.USER,
          origUsers,
          updatedUsers,
          Relationship.REVIEWS,
          Entity.GLOSSARY,
          origGlossary.getId());
    }

    public void updateName(Glossary original, Glossary updated) throws IOException {
      if (!original.getName().equals(updated.getName())) {
        if (ProviderType.SYSTEM.equals(original.getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
        }
        // Category name changed - update tag names starting from category and all the children tags
        LOG.info("Glossary name changed from {} to {}", original.getName(), updated.getName());
        daoCollection.glossaryTermDAO().updateFqn(original.getName(), updated.getName());
        daoCollection.tagUsageDAO().updateTagPrefix(original.getName(), updated.getName());
        recordChange("name", original.getName(), updated.getName());
      }
    }
  }
}
