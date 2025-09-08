package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public enum UserTaskType {
  USER_APPROVAL_TASK("terminateProcess"),
  CHANGE_REVIEW_TASK("terminateChangeReviewProcess");

  private final String terminationMessageSuffix;

  UserTaskType(String terminationMessageSuffix) {
    this.terminationMessageSuffix = terminationMessageSuffix;
  }

  public String getTerminationMessageSuffix() {
    return terminationMessageSuffix;
  }

  public String getTerminationMessageName(String subProcessId) {
    return subProcessId + "_" + terminationMessageSuffix;
  }

  public static List<String> getAllTerminationPatterns(String subProcessId) {
    return Arrays.stream(values())
        .map(type -> type.getTerminationMessageName(subProcessId))
        .collect(Collectors.toList());
  }

  public static String findTerminationPattern(String messageName) {
    for (UserTaskType type : values()) {
      if (messageName.endsWith("_" + type.getTerminationMessageSuffix())) {
        return type.getTerminationMessageSuffix();
      }
    }
    return null;
  }
}
