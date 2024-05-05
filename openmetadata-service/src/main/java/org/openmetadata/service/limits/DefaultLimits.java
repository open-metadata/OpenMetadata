package org.openmetadata.service.limits;

import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.configuration.LimitsConfiguration;
import org.openmetadata.schema.system.LimitsResponse;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

import javax.ws.rs.core.SecurityContext;

public class DefaultLimits implements Limits {
    private LimitsConfiguration limitsConfiguration = null;
    private Jdbi jdbi = null;

  @Override
    public void init(LimitsConfiguration limitsConfiguration, Jdbi jdbi) {
      this.limitsConfiguration = limitsConfiguration;
      this.jdbi = jdbi;
    }

  @Override
  public void enforceLimits(SecurityContext securityContext, OperationContext operationContext, ResourceContextInterface resourceContext) {
    // do not enforce limits
  }

  @Override
  public LimitsResponse getLimits() {
    LimitsResponse limitsResponse = new LimitsResponse();
    limitsResponse.setEnable(limitsConfiguration.getEnable());
    return limitsResponse;
  }

}
