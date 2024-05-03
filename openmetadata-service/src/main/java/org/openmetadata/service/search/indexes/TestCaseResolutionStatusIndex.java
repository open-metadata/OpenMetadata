package org.openmetadata.service.search.indexes;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.service.util.JsonUtils;

public record TestCaseResolutionStatusIndex(TestCaseResolutionStatus testCaseResolutionStatus)
    implements SearchIndex {
  @Override
  public Object getEntity() {
    return testCaseResolutionStatus;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return JsonUtils.getMap(testCaseResolutionStatus);
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put("testCaseResolutionStatusType", 1.0f);
    fields.put("testCaseReference.displayName", 15.0f);
    fields.put("testCaseReference.name", 10.0f);
    fields.put("testCaseReference.description", 1.0f);
    fields.put("testCaseResolutionStatusDetails.resolved.testCaseFailureComment", 10.0f);
    return fields;
  }
}
