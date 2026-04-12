package org.openmetadata.service.security.policyevaluator;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;

public interface ResourceContextInterface {
  enum Operation {
    PATCH,
    PUT,
    DELETE,
    NONE
  }

  String getResource();

  // Get owner of a resource. If the resource does not support owner or has no owner, return null
  List<EntityReference> getOwners();

  // Get Tags associated with a resource. If the resource does not support tags or has no tags,
  // return null
  List<TagLabel> getTags();

  EntityInterface getEntity();

  List<EntityReference> getDomains();

  // Get custom properties of a resource as a map for use in SpEL policy conditions.
  // Returns an empty map if the resource has no custom properties.
  default Map<String, Object> getCustomProperties() {
    return Collections.emptyMap();
  }
}
