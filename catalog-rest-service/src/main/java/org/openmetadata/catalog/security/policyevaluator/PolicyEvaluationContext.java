package org.openmetadata.catalog.security.policyevaluator;

import java.io.IOException;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class PolicyEvaluationContext {
  private final OperationContext operationContext;
  private final SubjectContext subjectContext;
  private final ResourceContext resourceContext;

  public PolicyEvaluationContext(
      OperationContext operationContext, SubjectContext subjectContext, ResourceContext resourceContext) {
    this.operationContext = operationContext;
    this.subjectContext = subjectContext;
    this.resourceContext = resourceContext;
  }

  public boolean noOwner() throws IOException {
    return resourceContext.getOwner() == null;
  }

  public boolean isOwner() throws IOException {
    return subjectContext.isOwner(resourceContext.getOwner());
  }
}
