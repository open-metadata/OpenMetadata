package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.SneakyThrows;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class TestCaseIndex implements ElasticSearchIndex {
  TestCase testCase;

  private static final List<String> excludeFields = List.of("changeDescription");

  public TestCaseIndex(TestCase testCase) {
    this.testCase = testCase;
  }

  @SneakyThrows
  public Map<String, Object> buildESDoc() {
    List<TestSuite> testSuiteArray = new ArrayList<>();
    if (testCase.getTestSuites() != null) {
      for (TestSuite suite : testCase.getTestSuites()) {
        suite.setChangeDescription(null);
        testSuiteArray.add(suite);
      }
    }
    testCase.setTestSuites(testSuiteArray);
    Map<String, Object> doc = JsonUtils.getMap(testCase);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }

  public Map<String, Object> buildESDocForCreate() {
    EntityReference testSuiteEntityReference = testCase.getTestSuite();
    TestSuite testSuite = getTestSuite(testSuiteEntityReference.getId());
    List<TestSuite> testSuiteArray = new ArrayList<>();
    testSuiteArray.add(testSuite);
    Map<String, Object> doc = JsonUtils.getMap(testCase);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    doc.put("testSuites", testSuiteArray);
    return doc;
  }

  private TestSuite getTestSuite(UUID testSuiteId) {
    TestSuite testSuite = Entity.getEntity(Entity.TEST_SUITE, testSuiteId, "", Include.ALL);
    return new TestSuite()
        .withId(testSuite.getId())
        .withName(testSuite.getName())
        .withDisplayName(testSuite.getDisplayName())
        .withDescription(testSuite.getDescription())
        .withFullyQualifiedName(testSuite.getFullyQualifiedName())
        .withDeleted(testSuite.getDeleted())
        .withHref(testSuite.getHref())
        .withExecutable(testSuite.getExecutable())
        .withChangeDescription(null);
  }
}
