package org.openmetadata.service.entity.write;

import java.util.EnumSet;
import java.util.function.Supplier;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;

/** Holds one lazy policy snapshot per mutation, bounded by the MetadataOperation enum. */
public final class EntityMutationPermissions {
  private final Supplier<ResourcePermission> source;
  private EnumSet<MetadataOperation> denied;

  public EntityMutationPermissions(final Supplier<ResourcePermission> source) {
    this.source = source;
  }

  public boolean denies(final MetadataOperation operation) {
    if (denied == null) {
      denied = load();
    }
    return denied.contains(operation);
  }

  private EnumSet<MetadataOperation> load() {
    final EnumSet<MetadataOperation> operations = EnumSet.noneOf(MetadataOperation.class);
    final ResourcePermission permissions = source.get();
    if (permissions != null) {
      for (final Permission permission : permissions.getPermissions()) {
        if (permission.getOperation() != null && permission.getAccess() == Permission.Access.DENY) {
          operations.add(permission.getOperation());
        }
      }
    }
    return operations;
  }
}
