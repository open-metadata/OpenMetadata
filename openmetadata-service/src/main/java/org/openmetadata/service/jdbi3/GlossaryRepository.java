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
import static org.openmetadata.csv.CsvUtil.addDomains;
import static org.openmetadata.csv.CsvUtil.addEntityReference;
import static org.openmetadata.csv.CsvUtil.addExtension;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addReviewers;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.csv.CsvUtil.addTermRelations;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchConstants.TAGS_FQN;
import static org.openmetadata.service.util.EntityUtil.compareTagLabel;

import java.io.IOException;
import java.net.URI;
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
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.TermRelation;
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
import org.openmetadata.service.entity.metadata.EntityTagWriter;
import org.openmetadata.service.entity.metadata.EntityWorkflowReferences;
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
import org.openmetadata.service.ontology.OntologyLayerValidator;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.resources.glossary.GlossaryResource;
import org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository()
public class GlossaryRepository implements EntityPolicy<Glossary> {

  private static final String ONTOLOGY_CONFIGURATION = "ontologyConfiguration";

  private static final String UPDATE_FIELDS = ONTOLOGY_CONFIGURATION;

  private static final String PATCH_FIELDS = ONTOLOGY_CONFIGURATION;

  private final OntologyLayerValidator ontologyLayerValidator;

  public GlossaryRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                GlossaryResource.COLLECTION_PATH,
                Entity.GLOSSARY,
                Glossary.class,
                Entity.getCollectionDAO().glossaryDAO()),
            new EntityPolicyContext.WriteFields(PATCH_FIELDS, UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setQuoteFqn(true);
    context().options().setSupportsSearch(true);
    context().options().setRenameAllowed(true);
    ontologyLayerValidator =
        new OntologyLayerValidator(
            id -> Entity.getEntity(Entity.GLOSSARY, id, "", Include.NON_DELETED));
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
    EntityPolicy.super.setFieldsInBulk(fields, entities);
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
      int count = context().dependencies().daos().glossaryTermDAO().listCount(filter);
      termCountMap.put(glossary.getName(), count);
    }
    return termCountMap;
  }

  private Map<String, Integer> batchGetUsageCounts(List<Glossary> glossaries) {
    Map<String, Integer> usageCountMap = new HashMap<>();
    for (Glossary glossary : glossaries) {
      int count =
          context()
              .dependencies()
              .daos()
              .tagUsageDAO()
              .getTagCount(TagSource.GLOSSARY.ordinal(), glossary.getName());
      usageCountMap.put(glossary.getName(), count);
    }
    return usageCountMap;
  }

  @Override
  public void prepare(Glossary glossary, boolean update) {
    ontologyLayerValidator.applyDefaultsAndValidate(glossary);
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("reviewers");
  }

  @Override
  public void storeEntity(Glossary glossary, boolean update) {
    persistence().store(glossary, update);
  }

  @Override
  public void storeEntities(List<Glossary> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public void storeRelationships(Glossary glossary) {
    // Nothing to do
  }

  private Integer getUsageCount(Glossary glossary) {
    return context()
        .dependencies()
        .daos()
        .tagUsageDAO()
        .getTagCount(TagSource.GLOSSARY.ordinal(), glossary.getName());
  }

  private Integer getTermCount(Glossary glossary) {
    ListFilter filter =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("parent", FullyQualifiedName.build(glossary.getName()));
    return context().dependencies().daos().glossaryTermDAO().listCount(filter);
  }

  @Override
  public void postDelete(Glossary entity, boolean hardDelete) {
    EntityPolicy.super.postDelete(entity, hardDelete);
    PolicyConditionUpdater.updateAllPolicyConditions(
        condition ->
            PolicyConditionUpdater.removeByPrefixFromCondition(
                condition, entity.getFullyQualifiedName(), PolicyConditionUpdater.TAG_FUNCTIONS));
  }

  @Override
  public EntityUpdater<Glossary> getUpdater(
      Glossary original, Glossary updated, EntityOperation operation, ChangeSource changeSource) {
    return new GlossaryUpdater(original, updated, operation).mutation();
  }

  @Override
  public void entityRelationshipReindex(Glossary original, Glossary updated) {
    EntityPolicy.super.entityRelationshipReindex(original, updated);
    if (!Objects.equals(original.getFullyQualifiedName(), updated.getFullyQualifiedName())
        || !Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      updateAssetIndexes(original, updated);
    }
  }

  /**
   * Export glossary as CSV
   */
  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    return exportToCsv(name, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    // Validate glossary name
    Glossary glossary = getByName(null, name, Fields.EMPTY_FIELDS);
    GlossaryTermRepository repository =
        (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
    List<GlossaryTerm> terms =
        repository
            .collections()
            .forCsv(
                repository
                    .fieldPolicy()
                    .parse("owners,reviewers,tags,relatedTerms,synonyms,extension,parent,domains"),
                glossary.getFullyQualifiedName());
    terms.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return new GlossaryCsv(glossary, user).exportCsv(terms, callback);
  }

  /**
   * Load CSV provided for bulk upload
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
    Glossary glossary = getByName(null, name, Fields.EMPTY_FIELDS);
    GlossaryCsv glossaryCsv = new GlossaryCsv(glossary, user);
    return glossaryCsv.importCsv(csv, dryRun, callback);
  }

  public static class GlossaryCsv extends EntityCsv<GlossaryTerm> {

    public static final CsvDocumentation DOCUMENTATION =
        getCsvDocumentation(Entity.GLOSSARY, false);

    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();

    private final Glossary glossary;

    private final Set<String> validRelationTypeNames;

    GlossaryCsv(Glossary glossary, String user) {
      super(GLOSSARY_TERM, HEADERS, user);
      this.glossary = glossary;
      this.validRelationTypeNames = loadValidRelationTypeNames();
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
          .withRelatedTerms(getTermRelationsFromCsv(printer, csvRecord, 5))
          .withReferences(getTermReferences(printer, csvRecord))
          .withTags(
              getTagLabels(
                  printer, csvRecord, List.of(Pair.of(7, TagLabel.TagSource.CLASSIFICATION))))
          .withReviewers(getReviewers(printer, csvRecord, 8))
          .withOwners(getOwners(printer, csvRecord, 9))
          .withEntityStatus(getTermStatus(printer, csvRecord))
          .withStyle(getStyle(csvRecord))
          .withDomains(getDomains(printer, csvRecord, 13))
          .withExtension(getExtension(printer, csvRecord, 14));
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

    /**
     * Parse term relations from CSV field with support for relation type prefix.
     * Format: "relationType:termFQN" or just "termFQN" (defaults to "relatedTo").
     * Example: "synonym:Glossary.Term1;broader:Glossary.Term2;Glossary.Term3"
     */
    private List<TermRelation> getTermRelationsFromCsv(
        CSVPrinter printer, CSVRecord csvRecord, int fieldNumber) throws IOException {
      if (!processRecord) {
        return null;
      }
      String fieldValue = csvRecord.get(fieldNumber);
      if (nullOrEmpty(fieldValue)) {
        return null;
      }
      List<TermRelation> termRelations = new ArrayList<>();
      String[] entries = fieldValue.split(FIELD_SEPARATOR);
      for (String entry : entries) {
        // Default relation type
        String relationType = "relatedTo";
        String termFqn = entry.trim();
        // Check for relationType:fqn format
        int colonIndex = entry.indexOf(':');
        if (colonIndex > 0) {
          String prefix = entry.substring(0, colonIndex).trim();
          String suffix = entry.substring(colonIndex + 1).trim();
          if (isValidRelationType(prefix)) {
            relationType = prefix;
            termFqn = suffix;
          } else if (!prefix.contains(".")) {
            // Prefix has no dots, so it looks like an intended relation type, not part of an FQN
            importFailure(
                printer,
                invalidField(
                    fieldNumber,
                    String.format(
                        "Invalid relation type '%s' in entry '%s'. " + "Valid types: %s",
                        prefix, entry.trim(), getValidRelationTypeNames())),
                csvRecord);
            continue;
          }
          // If prefix contains dots, it's likely part of an FQN — treat entire string as FQN
        }
        // Resolve the term FQN to an EntityReference
        EntityReference termRef =
            getEntityReference(printer, csvRecord, fieldNumber, GLOSSARY_TERM, termFqn);
        if (termRef != null) {
          GlossaryTerm resolvedTerm =
              Entity.getEntity(GLOSSARY_TERM, termRef.getId(), "", Include.NON_DELETED);
          if (resolvedTerm.getEntityStatus() != null
              && resolvedTerm.getEntityStatus() != EntityStatus.APPROVED) {
            importFailure(
                printer,
                invalidField(
                    fieldNumber,
                    String.format(
                        "Glossary term '%s' must have APPROVED status. Current: %s",
                        termFqn, resolvedTerm.getEntityStatus())),
                csvRecord);
            processRecord = false;
            continue;
          }
          termRelations.add(new TermRelation().withTerm(termRef).withRelationType(relationType));
        }
      }
      return termRelations.isEmpty() ? null : termRelations;
    }

    private boolean isValidRelationType(String relationType) {
      return validRelationTypeNames.contains(relationType);
    }

    private String getValidRelationTypeNames() {
      return validRelationTypeNames.stream().sorted().collect(Collectors.joining(", "));
    }

    private static Set<String> loadValidRelationTypeNames() {
      RelationshipTypeResolver resolver =
          new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
      return resolver.list().stream()
          .map(RelationshipType::getName)
          .collect(Collectors.toUnmodifiableSet());
    }

    private EntityStatus getTermStatus(CSVPrinter printer, CSVRecord csvRecord) throws IOException {
      if (!processRecord) {
        return null;
      }
      String termStatus = csvRecord.get(10);
      try {
        return nullOrEmpty(termStatus)
            ? EntityStatus.DRAFT
            : EntityFieldUtils.parseEntityStatus(termStatus);
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
      addTermRelations(recordList, entity.getRelatedTerms());
      addField(recordList, termReferencesToRecord(entity.getReferences()));
      addTagLabels(recordList, entity.getTags());
      addReviewers(recordList, entity.getReviewers());
      addOwners(recordList, entity.getOwners());
      addField(recordList, entity.getEntityStatus().value());
      addField(recordList, entity.getStyle() != null ? entity.getStyle().getColor() : null);
      addField(recordList, entity.getStyle() != null ? entity.getStyle().getIconURL() : null);
      addDomains(recordList, getDirectDomains(entity.getDomains()));
      addExtension(recordList, entity.getExtension());
      addRecord(csvFile, recordList);
    }

    private static List<EntityReference> getDirectDomains(List<EntityReference> domains) {
      return listOrEmpty(domains).stream()
          .filter(domain -> !Boolean.TRUE.equals(domain.getInherited()))
          .toList();
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
    String oldFqn = original.getFullyQualifiedName();
    String newFqn = updated.getFullyQualifiedName();
    // Re-index the glossary and all nested child terms from the renamed DB rows so each doc's own
    // FQN and the glossary/parent denorm reflect the new name. Drained on the request thread
    // post-commit = read-your-write, unlike the previous fire-and-forget reindexAcrossIndices that
    // raced the commit and left child terms stale. Rebuilding from the authoritative rows is
    // boundary-safe — getAllTerms matches on fixed-width fqnHash segments, where an ES
    // prefix-rewrite over the raw FQN would also hit sibling glossaries sharing a name prefix
    // (e.g. "Finance" vs "FinanceReports") and can't refresh glossary.name/fullyQualifiedName at
    // all. The child terms go out as one bulk request, not N individual ES round-trips.
    context().dependencies().search().updateEntity(updated.getEntityReference());
    context()
        .dependencies()
        .search()
        .deferIfFlushScopeActive(
            () ->
                context()
                    .dependencies()
                    .search()
                    .updateEntitiesByReference(
                        getAllTerms(updated).stream()
                            .map(GlossaryTerm::getEntityReference)
                            .toList()),
            "updateEntitiesByReference",
            updated.getId().toString(),
            newFqn,
            GLOSSARY_TERM);
    // Rewrite tags.tagFQN on every asset tagged with this glossary's terms in one synchronous
    // prefix update-by-query (refresh=true) — the same in-line mechanism GlossaryTerm rename uses.
    context()
        .dependencies()
        .search()
        .deferIfFlushScopeActive(
            () ->
                context()
                    .dependencies()
                    .search()
                    .getSearchClient()
                    .updateGlossaryTermByFqnPrefix(GLOBAL_SEARCH_ALIAS, oldFqn, newFqn, TAGS_FQN),
            "updateGlossaryTermByFqnPrefix",
            null,
            newFqn,
            GLOSSARY);
  }

  private void updateEntityLinksOnGlossaryRename(String oldFqn, String newFqn, Glossary updated) {
    // update field relationships for feed
    context().dependencies().daos().fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);
    ConversationRepository conversations = Entity.getConversationRepository();
    conversations.updateEntityReference(updated.getEntityReference(), oldFqn);
    List<GlossaryTerm> childTerms = getAllTerms(updated);
    // A glossary rename cascades the FQN to every child term, so their open approval tasks (keyed
    // by
    // aboutFqnHash) and workflow-instance relatedEntity must follow the rename exactly as a term
    // move/rename does — otherwise the tasks become unfindable at the new FQN and the workflow
    // history card goes stale.
    Map<String, String> taskFqnHashUpdates = new HashMap<>();
    for (GlossaryTerm child : childTerms) {
      String childNewFqn = child.getFullyQualifiedName();
      if (!nullOrEmpty(childNewFqn) && childNewFqn.startsWith(newFqn)) {
        String childOldFqn = oldFqn + childNewFqn.substring(newFqn.length());
        conversations.updateEntityReference(child.getEntityReference(), childOldFqn);
        taskFqnHashUpdates.put(
            FullyQualifiedName.buildHash(childOldFqn), FullyQualifiedName.buildHash(childNewFqn));
      }
    }
    // The glossary FQN is the prefix of every child term's FQN, so one subtree repoint covers them
    // all; child approval tasks (opaque hash) are rewritten per term.
    workflowReferences().renameTasks(taskFqnHashUpdates);
    workflowReferences()
        .renameInstances(new EntityWorkflowReferences.Rename(GLOSSARY_TERM, oldFqn, newFqn));
  }

  private List<GlossaryTerm> getAllTerms(Glossary glossary) {
    // Get all the hierarchically nested terms of the glossary
    List<String> jsons =
        context()
            .dependencies()
            .daos()
            .glossaryTermDAO()
            .getNestedTerms(glossary.getFullyQualifiedName());
    return JsonUtils.readObjects(jsons, GlossaryTerm.class);
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class GlossaryUpdater implements EntitySpecificMutation<Glossary> {

    private boolean renameProcessed = false;

    public GlossaryUpdater(Glossary original, Glossary updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
      context().options().setRenameAllowed(true);
    }

    @Override
    public void reset() {
      renameProcessed = false;
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Glossary> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate("name", () -> updateName(entityUpdate.getUpdated()));
      entityUpdate.recordChange(
          ONTOLOGY_CONFIGURATION,
          entityUpdate.getOriginal().getOntologyConfiguration(),
          entityUpdate.getUpdated().getOntologyConfiguration());
      // Mutually exclusive cannot be updated
      entityUpdate
          .getUpdated()
          .setMutuallyExclusive(entityUpdate.getOriginal().getMutuallyExclusive());
    }

    public void updateName(Glossary updated) {
      // Use getOriginalFqn() which was captured at EntityUpdater construction time.
      // This is reliable even after revert() reassigns 'original' to 'previous'.
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
      // Glossary name changed - update tag names starting from glossary and all the children tags
      LOG.info("Glossary FQN changed from {} to {}", oldFqn, newFqn);
      // Drop cache entries for every glossary term under this glossary BEFORE we rewrite the DB.
      // Capture the descendants so the post-write pass can re-evict any entry a racing reader
      // re-populated with the pre-rename row between this call and glossaryTermDAO.updateFqn.
      // The pass below runs after updateFqn but inside this transaction — see
      // EntityCaches.targets().beforeRename for the residual pre-commit window.
      List<EntityDAO.EntityIdFqnPair> renamedTerms =
          EntityCaches.targets().beforeRename(Entity.GLOSSARY_TERM, oldFqn);
      context().dependencies().daos().glossaryTermDAO().updateFqn(oldFqn, newFqn);
      context()
          .dependencies()
          .daos()
          .tagUsageDAO()
          .updateTagPrefix(TagSource.GLOSSARY.ordinal(), oldFqn, newFqn);
      entityUpdate.recordChange("name", FullyQualifiedName.unquoteName(oldFqn), updated.getName());
      invalidateGlossary(updated.getId());
      // update Tags Of Glossary On Rename
      context().dependencies().daos().tagUsageDAO().deleteTagsByTarget(oldFqn);
      List<TagLabel> updatedTags = updated.getTags();
      updatedTags.sort(compareTagLabel);
      tagWrites().apply(updatedTags, new EntityTagWriter.Target(newFqn));
      context()
          .dependencies()
          .daos()
          .tagUsageDAO()
          .renameByTargetFQNHash(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);
      updateEntityLinksOnGlossaryRename(oldFqn, newFqn, updated);
      PolicyConditionUpdater.updateAllPolicyConditions(
          condition ->
              PolicyConditionUpdater.renamePrefixInCondition(
                  condition, oldFqn, newFqn, PolicyConditionUpdater.TAG_FUNCTIONS));
      // Cascade rename into the search index — child term FQNs and the embedded glossary denorm
      // (glossary.name / glossary.fullyQualifiedName) must reflect the new name. This used to be
      // driven by entityRelationshipReindex, which has no caller since PR #19550, so the call has
      // to happen inline here (mirroring Domain / Classification / GlossaryTerm renames).
      updateAssetIndexes(entityUpdate.getOriginal(), updated);
      EntityCaches.targets().afterRename(Entity.GLOSSARY_TERM, renamedTerms);
    }

    public void invalidateGlossary(UUID classificationId) {
      // Glossary name changed. Invalidate the glossary and its children terms
      EntityCaches.byId().invalidate(new ImmutablePair<>(GLOSSARY, classificationId));
      List<EntityRelationshipRecord> tags =
          relationships()
              .toRecords(
                  new EntityRelationshipReader.Selection(
                      classificationId, GLOSSARY, Relationship.CONTAINS, GLOSSARY_TERM));
      for (EntityRelationshipRecord tagRecord : tags) {
        invalidateTerms(tagRecord.getId());
      }
    }

    private void invalidateTerms(UUID termId) {
      // The name of the glossary changed or parent changed. Invalidate that tag and all the
      // children from the cache
      List<EntityRelationshipRecord> tagRecords =
          relationships()
              .toRecords(
                  new EntityRelationshipReader.Selection(
                      termId, GLOSSARY_TERM, Relationship.CONTAINS, GLOSSARY_TERM));
      EntityCaches.byId().invalidate(new ImmutablePair<>(GLOSSARY_TERM, termId));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTerms(tagRecord.getId());
      }
    }

    private final EntityUpdater<Glossary> entityUpdate;

    public EntityUpdater<Glossary> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Glossary> entityContext;

  @Override
  public final EntityPolicyContext<Glossary> context() {
    return entityContext;
  }
}
