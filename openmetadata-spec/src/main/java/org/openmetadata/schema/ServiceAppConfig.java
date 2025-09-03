package org.openmetadata.schema;

import org.openmetadata.schema.type.EntityReference;

public interface ServiceAppConfig extends GlobalAppConfig {
  EntityReference getServiceRef();
}
