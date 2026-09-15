package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_DISPLAY_NAME;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_OWNERS;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;

class EntityMutationPermissionsTest {
  @Test
  void oneMutationUsesOneLazyPermissionSnapshotForBothFieldGuards() {
    final AtomicInteger evaluations = new AtomicInteger();
    final var permissions =
        new EntityMutationPermissions(
            () -> {
              evaluations.incrementAndGet();
              return permission(EDIT_DISPLAY_NAME, Permission.Access.DENY);
            });
    assertEquals(0, evaluations.get());
    assertTrue(permissions.denies(EDIT_DISPLAY_NAME));
    assertFalse(permissions.denies(EDIT_OWNERS));
    assertTrue(permissions.denies(EDIT_DISPLAY_NAME));
    assertEquals(1, evaluations.get(), "Evaluate the actor's policies once for this mutation");
  }

  @Test
  void independentMutationsObserveTheirOwnPolicies() {
    final ResourcePermission source = permission(EDIT_DISPLAY_NAME, Permission.Access.DENY);
    final var first = new EntityMutationPermissions(() -> source);
    assertTrue(first.denies(EDIT_DISPLAY_NAME));
    source.setPermissions(permission(EDIT_OWNERS, Permission.Access.DENY).getPermissions());
    assertTrue(first.denies(EDIT_DISPLAY_NAME));
    assertFalse(first.denies(EDIT_OWNERS));
    final var next = new EntityMutationPermissions(() -> source);
    assertFalse(next.denies(EDIT_DISPLAY_NAME));
    assertTrue(next.denies(EDIT_OWNERS));
  }

  @ParameterizedTest
  @EnumSource(Permission.Access.class)
  void preservesTheExistingExplicitDenySemantics(Permission.Access access) {
    final var permissions =
        new EntityMutationPermissions(() -> permission(EDIT_DISPLAY_NAME, access));
    assertEquals(access == Permission.Access.DENY, permissions.denies(EDIT_DISPLAY_NAME));
    assertFalse(permissions.denies(EDIT_OWNERS));
  }

  @Test
  void absentActorPermissionsDoNotIntroduceADeny() {
    final var permissions = new EntityMutationPermissions(() -> null);
    assertFalse(permissions.denies(EDIT_DISPLAY_NAME));
    assertFalse(permissions.denies(EDIT_OWNERS));
  }

  private ResourcePermission permission(MetadataOperation operation, Permission.Access access) {
    return new ResourcePermission()
        .withPermissions(List.of(new Permission().withOperation(operation).withAccess(access)));
  }
}
