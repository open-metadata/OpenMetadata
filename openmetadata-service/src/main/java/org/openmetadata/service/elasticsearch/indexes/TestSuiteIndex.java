package org.openmetadata.service.elasticsearch.indexes;

import java.util.Map;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.service.util.JsonUtils;

public class TestSuiteIndex implements ElasticSearchIndex {
  TestSuite testSuite;

  public TestSuiteIndex(TestSuite testSuite) {
    this.testSuite = testSuite;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(testSuite);
    return doc;
  }
}
