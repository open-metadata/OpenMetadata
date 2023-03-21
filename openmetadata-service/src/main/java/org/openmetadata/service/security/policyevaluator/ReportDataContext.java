package org.openmetadata.service.security.policyevaluator;

import java.io.IOException;
import java.util.List;
import lombok.Builder;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

@Builder
public class ReportDataContext implements ResourceContextInterface {
  @Override
  public String getResource() {
    return Entity.DATA_INSIGHT_CHART;
  }

  @Override
  public EntityReference getOwner() throws IOException {
    return null;
  }

  @Override
  public List<TagLabel> getTags() throws IOException {
    return null;
  }

  @Override
  public EntityInterface getEntity() throws IOException {
    return null;
  }
}
