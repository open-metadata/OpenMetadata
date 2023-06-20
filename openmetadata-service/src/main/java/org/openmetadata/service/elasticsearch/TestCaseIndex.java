package org.openmetadata.service.elasticsearch;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

public class TestCaseIndex implements ElasticSearchIndex {
  TestCase testCase;

  public TestCaseIndex(TestCase testCase) {
    this.testCase = testCase;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(testCase);
    if (doc.containsKey("testSuite")) {
      doc.remove("testSuite"); // we won't update testSuite on testCase update
    }
    return doc;
  }

  public Map<String, Object> buildESDocForCreate() throws IOException {
    EntityReference testSuiteEntityReference = testCase.getTestSuite();
    TestSuite testSuite = getTestSuite(testSuiteEntityReference.getId());
    List<TestSuite> testSuiteArray = new ArrayList<>();
    testSuiteArray.add(testSuite);
    Map<String, Object> doc = JsonUtils.getMap(testCase);
    doc.put("testSuite", testSuiteArray); // add the executable test suite on creation
    return doc;
  }

  private TestSuite getTestSuite(UUID testSuiteId) throws IOException {
    TestSuite testSuite = Entity.getEntity(Entity.TEST_SUITE, testSuiteId, "", Include.ALL);
    return new TestSuite()
        .withId(testSuite.getId())
        .withName(testSuite.getName())
        .withDisplayName(testSuite.getDisplayName())
        .withDescription(testSuite.getDescription())
        .withFullyQualifiedName(testSuite.getFullyQualifiedName())
        .withDeleted(testSuite.getDeleted())
        .withHref(testSuite.getHref())
        .withExecutable(testSuite.getExecutable());
  }
}
