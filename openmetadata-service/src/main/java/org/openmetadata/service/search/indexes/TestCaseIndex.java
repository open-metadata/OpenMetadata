package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.SneakyThrows;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchIndexUtils;

public record TestCaseIndex(TestCase testCase) implements TaggableIndex {
  private static final Set<String> excludeFields =
      Set.of("changeDescription", "failedRowsSample", "incrementalChangeDescription");

  @Override
  public Object getEntity() {
    return testCase;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.TEST_CASE;
  }

  @Override
  public void removeNonIndexableFields(Map<String, Object> esDoc) {
    TaggableIndex.super.removeNonIndexableFields(esDoc);
    List<Map<String, Object>> testSuites = (List<Map<String, Object>>) esDoc.get("testSuites");
    if (testSuites != null) {
      for (Map<String, Object> testSuite : testSuites) {
        SearchIndexUtils.removeNonIndexableFields(testSuite, excludeFields);
      }
    }
  }

  @SneakyThrows
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put(
        "originEntityFQN", MessageParser.EntityLink.parse(testCase.getEntityLink()).getEntityFQN());
    try {
      TestDefinition testDefinition =
          Entity.getEntity(
              Entity.TEST_DEFINITION, testCase.getTestDefinition().getId(), "", Include.ALL);
      doc.put("testPlatforms", testDefinition.getTestPlatforms());
      doc.put("dataQualityDimension", testDefinition.getDataQualityDimension());
      doc.put("testCaseType", testDefinition.getEntityType());
    } catch (EntityNotFoundException ex) {
      LOG.warn(
          "TestDefinition not found for TestCase [{}]: {}",
          testCase.getFullyQualifiedName(),
          ex.getMessage());
    }
    setParentRelationships(doc, testCase);
    return doc;
  }

  private void setParentRelationships(Map<String, Object> doc, TestCase testCase) {
    // Denormalize parent relationships and inherit domains from the linked table.
    // addTestSuiteParentEntityRelations already fetches the Table with "domains",
    // so we reuse it to avoid an extra DB query per test case.
    EntityInterface linkedTable = denormalizeTestSuiteParents(doc, testCase);

    if (nullOrEmpty(testCase.getDomains())
        && linkedTable != null
        && !nullOrEmpty(linkedTable.getDomains())) {
      doc.put("domains", getEntitiesWithDisplayName(linkedTable.getDomains()));
    }
  }

  private EntityInterface denormalizeTestSuiteParents(Map<String, Object> doc, TestCase testCase) {
    EntityReference testSuiteRef = testCase.getTestSuite();
    if (testSuiteRef == null) {
      return null;
    }
    TestSuite testSuite = Entity.getEntityOrNull(testSuiteRef, "", Include.ALL);
    if (testSuite == null) {
      return null;
    }
    EntityReference entityReference = testSuite.getBasicEntityReference();
    if (entityReference == null) {
      return null;
    }
    return TestSuiteIndex.addTestSuiteParentEntityRelations(entityReference, doc);
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("testSuite.fullyQualifiedName", 10.0f);
    fields.put("testSuite.name", 10.0f);
    fields.put("testSuite.description", 1.0f);
    fields.put("entityLink", 3.0f);
    fields.put("entityFQN", 10.0f);
    return fields;
  }
}
