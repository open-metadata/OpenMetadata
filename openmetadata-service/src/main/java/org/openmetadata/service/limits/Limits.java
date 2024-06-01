package org.openmetadata.service.limits;

import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.system.LimitsConfig;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

public interface Limits {
  void init(OpenMetadataApplicationConfig serverConfig, Jdbi jdbi);

  void enforceLimits(
      SecurityContext securityContext,
      ResourceContextInterface resourceContext,
      OperationContext operationContext);

  LimitsConfig getLimitsConfig();

  Response getLimitsForaFeature(String entityType, boolean cache);

  void invalidateCache(String entityType);
}
