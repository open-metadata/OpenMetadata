package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.ImpersonationCleanupFilter;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;

class ImpersonationCleanupFilterTest {

  @Test
  void filterClearsReadBundleContextThreadLocal() {
    ReadBundleContext.push(new ReadBundle());
    new ImpersonationCleanupFilter().filter(null, null);
    assertNull(ReadBundleContext.getCurrent());
  }

  @Test
  void filterClearsRequestEntityCacheThreadLocal() {
    UUID id = UUID.randomUUID();
    Fields fields = new Fields(Set.of("owners"));
    RelationIncludes includes = RelationIncludes.fromInclude(NON_DELETED);
    Table table = new Table().withId(id).withName("orders");
    RequestEntityCache.putById(Entity.TABLE, id, fields, includes, true, table, Table.class);

    new ImpersonationCleanupFilter().filter(null, null);

    assertNull(RequestEntityCache.getById(Entity.TABLE, id, fields, includes, true, Table.class));
  }
}
