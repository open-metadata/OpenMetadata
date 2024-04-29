package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public record TestCaseResolutionStatusIndex(TestCaseResolutionStatus testCaseResolutionStatus)
    implements SearchIndex {
  @Override
  public Map<String, Object> buildESDoc() {

    Map<String, Object> doc = JsonUtils.getMap(testCaseResolutionStatus);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(
        SearchSuggest.builder()
            .input(testCaseResolutionStatus.getTestCaseReference().getFullyQualifiedName())
            .weight(5)
            .build());
    suggest.add(
        SearchSuggest.builder()
            .input(testCaseResolutionStatus.getTestCaseReference().getName())
            .weight(10)
            .build());
    doc.put(
        "fqnParts",
        getFQNParts(
            testCaseResolutionStatus.getTestCaseReference().getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    return doc;
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
