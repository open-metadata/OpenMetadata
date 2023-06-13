package org.openmetadata.service.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.util.JsonUtils;

public class TestCaseIndex implements ElasticSearchIndex {
  TestCase testCase;

  public TestCaseIndex(TestCase testCase) {
    this.testCase = testCase;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(testCase);
    return doc;
  }

  public Map<String, Object> buildESDocForCreate() {
    EntityReference testSuiteEntityReference = testCase.getTestSuite();
    List<EntityReference> testSuiteArray = new ArrayList<EntityReference>();
    testSuiteArray.add(testSuiteEntityReference);
    Map<String, Object> doc = JsonUtils.getMap(testCase);
    doc.put("testSuite", testSuiteArray);
    return doc;
  }
}
