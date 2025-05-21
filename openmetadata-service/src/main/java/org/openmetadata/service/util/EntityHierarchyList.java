package org.openmetadata.service.util;

import java.util.List;
import org.openmetadata.schema.entity.data.EntityHierarchy;

public class EntityHierarchyList extends ResultList<EntityHierarchy> {
  @SuppressWarnings("unused")
  public EntityHierarchyList() {}

  public EntityHierarchyList(List<EntityHierarchy> data) {
    super(data, null, null, data.size());
  }
}
