package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

class ColumnFieldAccessTest {
  @Test
  void customMetricsFollowTheRegisteredTableOperation() {
    var filter = mock(ViewPermissionFilter.class);
    var caller = mock(SecurityContext.class);
    var table = new ResourceContext<>(Entity.TABLE, new Table(), null);
    // Deliberately different from today's ViewTests mapping: a later mapping change must
    // protect the column endpoint without another change to ColumnFieldAccess.
    var required = List.of(MetadataOperation.VIEW_ALL);
    try (var registry = mockStatic(ResourceRegistry.class)) {
      registry
          .when(() -> ResourceRegistry.getResourceFieldViewOperations(Entity.TABLE))
          .thenReturn(Map.of("customMetrics", MetadataOperation.VIEW_ALL));
      when(filter.isPermitted(caller, Entity.TABLE, required, table)).thenReturn(false);
      assertEquals(
          "tags", ColumnFieldAccess.readableFields(filter, caller, table, "tags,customMetrics"));
      when(filter.isPermitted(caller, Entity.TABLE, required, table)).thenReturn(true);
      assertEquals(
          "tags,customMetrics",
          ColumnFieldAccess.readableFields(filter, caller, table, "tags,customMetrics"));
    }
  }
}
