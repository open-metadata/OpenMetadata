package org.openmetadata.service.security.policyevaluator;

import java.util.List;
import lombok.Builder;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

@Builder
public class AgentExecutionContext implements ResourceContextInterface {
  @Override
  public String getResource() {
    return Entity.AGENT_EXECUTION;
  }

  @Override
  public List<EntityReference> getOwners() {
    return null;
  }

  @Override
  public List<TagLabel> getTags() {
    return null;
  }

  @Override
  public EntityInterface getEntity() {
    return null;
  }

  @Override
  public List<EntityReference> getDomains() {
    return null;
  }
}
