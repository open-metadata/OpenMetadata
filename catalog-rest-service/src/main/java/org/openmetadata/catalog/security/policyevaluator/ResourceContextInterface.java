package org.openmetadata.catalog.security.policyevaluator;

import java.io.IOException;
import java.util.List;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;

public interface ResourceContextInterface {
  // Get owner of a resource. If the resource does not support owner or has no owner, return null
  EntityReference getOwner() throws IOException;

  // Get Tags associated with a resource. If the resource does not support tags or has no tags, return null
  List<TagLabel> getTags() throws IOException;

  EntityInterface getEntity() throws IOException;
}
