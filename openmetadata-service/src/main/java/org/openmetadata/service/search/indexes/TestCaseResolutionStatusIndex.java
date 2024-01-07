package org.openmetadata.service.search.indexes;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.service.util.JsonUtils;

public record TestCaseResolutionStatusIndex(TestCaseResolutionStatus testCaseResolutionStatus)
    implements SearchIndex {
  @Override
  public Map<String, Object> buildESDoc() {
    return JsonUtils.getMap(testCaseResolutionStatus);
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put("testCaseResolutionStatusType", 1.0f);
    fields.put("testCaseReference.displayName", 15.0f);
    fields.put("testCaseReference.name", 10.0f);
    fields.put("testCaseReference.description", 5.0f);
    fields.put("testCaseReference.description.ngram", 1.0f);
    fields.put("testCaseResolutionStatusDetails.resolved.testCaseFailureComment", 10.0f);
    fields.put("testCaseResolutionStatusDetails.resolved.testCaseFailureComment.ngram", 1.0f);
    return fields;
  }
}
