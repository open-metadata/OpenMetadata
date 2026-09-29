package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.util.EntityUtil.mergedInheritedEntityRefs;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

final class QueryDomainInheritance {
  private QueryDomainInheritance() {}

  static boolean hasExplicitDomains(Query query) {
    return listOrEmpty(query.getDomains()).stream()
        .anyMatch(reference -> !Boolean.TRUE.equals(reference.getInherited()));
  }

  static List<EntityReference> resolve(Query query, Map<UUID, Table> tablesById) {
    final List<EntityReference> explicitDomains =
        listOrEmpty(query.getDomains()).stream()
            .filter(reference -> !Boolean.TRUE.equals(reference.getInherited()))
            .toList();
    List<EntityReference> result = explicitDomains;
    if (explicitDomains.isEmpty()) {
      result = mergedInheritedEntityRefs(List.of(), getTableDomains(query, tablesById));
    }
    return result;
  }

  private static List<EntityReference> getTableDomains(Query query, Map<UUID, Table> tablesById) {
    return listOrEmpty(query.getQueryUsedIn()).stream()
        .filter(reference -> TABLE.equals(reference.getType()))
        .map(reference -> tablesById.get(reference.getId()))
        .filter(Objects::nonNull)
        .flatMap(table -> listOrEmpty(table.getDomains()).stream())
        .map(QueryDomainInheritance::copy)
        .toList();
  }

  private static EntityReference copy(EntityReference reference) {
    return JsonUtils.deepCopy(reference, EntityReference.class);
  }
}
