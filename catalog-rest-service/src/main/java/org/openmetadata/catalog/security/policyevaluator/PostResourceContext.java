package org.openmetadata.catalog.security.policyevaluator;

import java.io.IOException;
import java.util.List;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;

/** Posts that are part of conversation threads require special handling */
public class PostResourceContext implements ResourceContextInterface {
  private EntityReference owner;

  public PostResourceContext(EntityReference owner) {
    this.owner = owner;
  }

  @Override
  public EntityReference getOwner() throws IOException {
    return owner;
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
