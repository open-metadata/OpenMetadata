package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.SneakyThrows;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record TestCaseIndex(TestCase testCase) implements SearchIndex {
  private static final Set<String> excludeFields =
      Set.of("changeDescription", "failedRowsSample", "incrementalChangeDescription");

  @Override
  public Object getEntity() {
    return testCase;
  }

  @Override
  public void removeNonIndexableFields(Map<String, Object> esDoc) {
    SearchIndex.super.removeNonIndexableFields(esDoc);
    List<Map<String, Object>> testSuites = (List<Map<String, Object>>) esDoc.get("testSuites");
    if (testSuites != null) {
      for (Map<String, Object> testSuite : testSuites) {
        SearchIndexUtils.removeNonIndexableFields(testSuite, excludeFields);
      }
    }
  }

  @SneakyThrows
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    // Build Index Doc
    List<SearchSuggest> suggest = new ArrayList<>();
    TestDefinition testDefinition =
        Entity.getEntity(
            Entity.TEST_DEFINITION, testCase.getTestDefinition().getId(), "", Include.ALL);
    suggest.add(SearchSuggest.builder().input(testCase.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(testCase.getName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            testCase.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.TEST_CASE);
    doc.put("owners", getEntitiesWithDisplayName(testCase.getOwners()));
    doc.put("tags", testCase.getTags());
    doc.put("testPlatforms", testDefinition.getTestPlatforms());
    doc.put("dataQualityDimension", testDefinition.getDataQualityDimension());
    doc.put("followers", SearchIndexUtils.parseFollowers(testCase.getFollowers()));
    doc.put("testCaseType", testDefinition.getEntityType());
    doc.put(
        "originEntityFQN", MessageParser.EntityLink.parse(testCase.getEntityLink()).getEntityFQN());
    setParentRelationships(doc, testCase);
    return doc;
  }

  private void setParentRelationships(Map<String, Object> doc, TestCase testCase) {
    // denormalize the parent relationships for search
    EntityReference testSuiteEntityReference = testCase.getTestSuite();
    if (testSuiteEntityReference == null) {
      return;
    }
    TestSuite testSuite = Entity.getEntityOrNull(testSuiteEntityReference, "", Include.ALL);
    EntityReference entityReference = testSuite.getBasicEntityReference();
    if (entityReference != null) {
      TestSuiteIndex.addTestSuiteParentEntityRelations(entityReference, doc);
    }
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
