package org.openmetadata.service.limits;

import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.configuration.LimitsConfiguration;
import org.openmetadata.schema.system.LimitsResponse;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;

public interface Limits {
  void init(LimitsConfiguration limitsConfiguration, Jdbi jdbi);

  void enforceLimits(SecurityContext securityContext, OperationContext operationContext,
                     ResourceContextInterface resourceContext);

  LimitsResponse getLimits();
}
