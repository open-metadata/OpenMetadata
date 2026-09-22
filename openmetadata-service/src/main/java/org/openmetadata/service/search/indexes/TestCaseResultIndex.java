package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.DataQualityDimensionRepository;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.EntityUtil;

public record TestCaseResultIndex(TestCaseResult testCaseResult) implements SearchIndex {
  private static final Set<String> excludeFields =
      Set.of("changeDescription", "failedRowsSample", "incrementalChangeDescription");

  @Override
  public Object getEntity() {
    return testCaseResult;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.TEST_CASE_RESULT;
  }

  @Override
  public void removeNonIndexableFields(Map<String, Object> esDoc) {
    SearchIndex.super.removeNonIndexableFields(esDoc);
    List<Map<String, Object>> testSuites = (List<Map<String, Object>>) esDoc.get("testSuites");
    Map<String, Object> testDefinition = (Map<String, Object>) esDoc.get("testDefinition");
    Map<String, Object> testCase = (Map<String, Object>) esDoc.get("testCase");
    if (testSuites != null) {
      for (Map<String, Object> testSuite : testSuites) {
        SearchIndexUtils.removeNonIndexableFields(testSuite, excludeFields);
      }
    }
    if (testCase != null) SearchIndexUtils.removeNonIndexableFields(testCase, excludeFields);
    if (testDefinition != null)
      SearchIndexUtils.removeNonIndexableFields(testDefinition, excludeFields);
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
    TestCase testCase;
    try {
      testCase =
          Entity.getEntityByName(
              Entity.TEST_CASE,
              testCaseResult.getTestCaseFQN(),
              "testSuites,testSuite,testDefinition,entityLink,owners,tags,domains",
              Include.ALL);
    } catch (EntityNotFoundException ex) {
      LOG.warn(
          "TestCase [{}] not found during search indexing: {}",
          testCaseResult.getTestCaseFQN(),
          ex.getMessage());
      esDoc.put("@timestamp", testCaseResult.getTimestamp());
      return esDoc;
    }

    TestDefinition testDefinition = null;
    if (testCase.getTestDefinition() != null) {
      try {
        testDefinition =
            Entity.getEntity(
                Entity.TEST_DEFINITION,
                testCase.getTestDefinition().getId(),
                "testPlatforms,dataQualityDimension,entityType",
                Include.ALL);
      } catch (EntityNotFoundException ex) {
        LOG.warn(
            "TestDefinition not found for TestCase [{}]: {}",
            testCaseResult.getTestCaseFQN(),
            ex.getMessage());
      }
    }

    Table parentTable = resolveParentTable(testCase);
    projectParentTerms(testCase, parentTable);
    Map<String, Object> testCaseMap = JsonUtils.getMap(testCase);
    esDoc.put("testSuites", testCaseMap.get("testSuites"));
    esDoc.put("testSuite", testCaseMap.get("testSuite"));
    testCaseMap
        .keySet()
        .removeAll(Set.of("testSuites", "testSuite", "testCaseResult", "testDefinition"));
    esDoc.put("testCase", testCaseMap);
    esDoc.put("@timestamp", testCaseResult.getTimestamp());
    if (testDefinition != null) {
      esDoc.put("testDefinition", buildTestDefinitionMap(testDefinition, testCase));
    }
    if (!nullOrEmpty(testCase.getDomains())) {
      esDoc.put("domains", getEntitiesWithDisplayName(testCase.getDomains()));
    }
    setParentRelationships(parentTable, esDoc);
    return esDoc;
  }

  /**
   * A glossary term on the table is projected onto its children at read time and is never stored, so
   * nothing on the test case itself can reproduce it here. Without this the embedded copy depends
   * entirely on the cascade having patched the document: any later rebuild — a reindex, or simply a
   * result ingested after the table was tagged — writes the term back out of existence. Deriving it
   * while the document is built makes a rebuild reproduce the same value the cascade would have
   * written, which leaves the cascade responsible only for documents that already exist.
   */
  private void projectParentTerms(TestCase testCase, Table parentTable) {
    if (parentTable == null) {
      return;
    }
    List<TagLabel> propagated = Entity.propagatedParentTags(parentTable.getTags());
    if (propagated.isEmpty()) {
      return;
    }
    List<TagLabel> merged = new ArrayList<>(listOrEmpty(testCase.getTags()));
    EntityUtil.mergeTags(merged, propagated);
    testCase.setTags(merged);
  }

  private Table resolveParentTable(TestCase testCase) {
    if (nullOrEmpty(testCase.getEntityLink())) {
      return null;
    }
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(testCase.getEntityLink());
    if (!Entity.TABLE.equals(entityLink.getEntityType())) {
      return null;
    }
    Table table = null;
    try {
      table =
          Entity.getEntityByName(
              Entity.TABLE,
              entityLink.getEntityFQN(),
              "database,databaseSchema,service,certification,tags",
              Include.ALL);
    } catch (EntityNotFoundException ex) {
      LOG.warn(
          "Table [{}] not found during search indexing: {}",
          entityLink.getEntityFQN(),
          ex.getMessage());
    }
    return table;
  }

  /**
   * Denormalizes the test definition, replacing its dimension name with the one the test case
   * carries — a custom dimension or an override of the definition default wins here.
   *
   * <p>The name is written under {@link TestCaseRepository#DATA_QUALITY_DIMENSION_NAME_FIELD} and
   * the definition's own {@code dataQualityDimension} is dropped, so this index and the test case
   * index agree on one key for the denormalized dimension.
   *
   * <p>The dimension is resolved when the result document is indexed and changing it on the test
   * case does not rewrite the documents of results already indexed: historical results keep the
   * dimension they were recorded under. That is intentional for this iteration.
   */
  private Map<String, Object> buildTestDefinitionMap(
      TestDefinition testDefinition, TestCase testCase) {
    Map<String, Object> testDefinitionMap = JsonUtils.getMap(testDefinition);
    Object dimensionName =
        testDefinitionMap.remove(TestCaseRepository.DATA_QUALITY_DIMENSION_FIELD);
    if (testCase.getDataQualityDimension() != null) {
      dimensionName = testCase.getDataQualityDimension().getName();
    }
    // Mirrors TestCaseIndex: the "No Dimension" filter is a must_not-exists on this field, so an
    // effective NoDimension must stay unset instead of being indexed by name. Otherwise the same
    // dataQualityDimension=NoDimension filter answers differently on /testCases/search/list and
    // /testCases/testCaseResults/search/list.
    testDefinitionMap.put(
        TestCaseRepository.DATA_QUALITY_DIMENSION_NAME_FIELD,
        DataQualityDimensionRepository.NO_DIMENSION.equals(dimensionName) ? null : dimensionName);
    return testDefinitionMap;
  }

  /** Denormalizes the parent relationships for search. */
  private void setParentRelationships(Table table, Map<String, Object> esDoc) {
    if (table == null) {
      return;
    }
    esDoc.put("database", table.getDatabase());
    esDoc.put("databaseSchema", table.getDatabaseSchema());
    esDoc.put("service", table.getService());
    if (table.getServiceType() != null) {
      esDoc.put("serviceType", table.getServiceType());
    }
    esDoc.put("table", table.getEntityReference());
    if (table.getCertification() != null) {
      esDoc.put("certification", table.getCertification());
    }
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put("testCase.FullyQualifiedName", 10.0f);
    fields.put("testCase.displayName", 15.0f);
    fields.put("testCase.name", 10.0f);
    fields.put("testCase.description", 5.0f);
    return fields;
  }
}
