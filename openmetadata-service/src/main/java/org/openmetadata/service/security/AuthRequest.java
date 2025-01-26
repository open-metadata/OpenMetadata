package org.openmetadata.service.security;

import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

public record AuthRequest(
    OperationContext operationContext, ResourceContextInterface resourceContext) {}
