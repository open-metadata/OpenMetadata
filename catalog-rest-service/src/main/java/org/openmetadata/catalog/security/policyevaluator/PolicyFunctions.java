package org.openmetadata.catalog.security.policyevaluator;

import java.util.List;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.type.MetadataOperation;

/** Functions to be used in SpEL expressions in the rules */
public class PolicyFunctions {
  public static boolean matchResource(String resource, Rule rule) {
    return (rule.getResources().get(0).equalsIgnoreCase("all") || rule.getResources().contains(resource));
  }

  public static boolean matchOperations(List<MetadataOperation> operations, Rule rule) {
    if (rule.getOperations().get(0).equals(MetadataOperation.ALL) || rule.getOperations().containsAll(operations)) {
      return true;
    }
    if (rule.getOperations().contains(MetadataOperation.EDIT_ALL) && OperationContext.isEditOperation(operations)) {
      return true;
    }
    if (rule.getOperations().contains(MetadataOperation.VIEW_ALL) && OperationContext.isViewOperation(operations)) {
      return true;
    }
    return false;
  }
}
