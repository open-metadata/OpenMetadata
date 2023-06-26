package org.openmetadata.service.elasticsearch.indexes;

import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.service.util.JsonUtils;

import java.util.Map;

public class TestSuiteIndex implements ElasticSearchIndex {
  TestSuite testSuite;

  public TestSuiteIndex(TestSuite testSuite) {
    this.testSuite = testSuite;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(testSuite);
    if (doc.containsKey("testSuite")) {
      doc.remove("testSuite"); // we won't update testSuite on testCase update
    }
    return doc;
  }
}
