package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;

class PolicyEvaluatorTest {
  @Test
  public void test_AccessOrderOfPrecedence() {
    //
    // Order of precedence for access Deny > Allow > ConditionalDeny > ConditionalAllow > NotAllow
    //

    // newAccess (Deny|Allow|ConditionDeny|ConditionalAllow|NotAllow) and currentAccess Deny takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.DENY, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.ALLOW, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.DENY));

    // newAccess (Deny) and currentAccess Allow - newAccess Deny takes precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.ALLOW));

    // newAccess (Allow|ConditionDeny|ConditionalAllow|NotAllow) and currentAccess Allow takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.ALLOW, Access.ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.ALLOW));

    // newAccess (Deny|Allow) and currentAccess ConditionalDeny - newAccess takes precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.CONDITIONAL_DENY));
    assertTrue(CompiledRule.overrideAccess(Access.ALLOW, Access.CONDITIONAL_DENY));

    // newAccess (ConditionDeny|ConditionalAllow|NotAllow) and currentAccess ConditionalDeny takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.CONDITIONAL_DENY));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.CONDITIONAL_DENY));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.CONDITIONAL_DENY));

    // newAccess (Deny|Allow|ConditionalDeny) and currentAccess ConditionalAllow - newAccess takes precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.CONDITIONAL_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.ALLOW, Access.CONDITIONAL_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.CONDITIONAL_ALLOW));

    // newAccess (ConditionalAllow|NotAllow) and currentAccess ConditionalDeny takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.CONDITIONAL_ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.CONDITIONAL_ALLOW));

    // newAccess (Deny|Allow|ConditionalDeny|ConditionalAllow) and currentAccess notAllow - newAccess takes precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.NOT_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.ALLOW, Access.NOT_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.NOT_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.NOT_ALLOW));

    // newAccess (ConditionalAllow|NotAllow) and currentAccess ConditionalDeny takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.NOT_ALLOW));
  }

  @Test
  void trimResourcePermissions() {
    MetadataOperation[] op1 = {
      MetadataOperation.ALL,
      MetadataOperation.VIEW_ALL,
      MetadataOperation.VIEW_BASIC,
      MetadataOperation.VIEW_QUERIES,
      MetadataOperation.EDIT_ALL,
      MetadataOperation.EDIT_LINEAGE,
      MetadataOperation.EDIT_CUSTOM_FIELDS
    };
    ResourcePermission rp1 = getResourcePermission("r1", Access.DENY, op1);
    List<MetadataOperation> expectedOp1 =
        new ArrayList(List.of(MetadataOperation.ALL, MetadataOperation.VIEW_ALL, MetadataOperation.EDIT_ALL));

    MetadataOperation[] op2 = {
      MetadataOperation.ALL,
      MetadataOperation.VIEW_BASIC,
      MetadataOperation.VIEW_USAGE,
      MetadataOperation.EDIT_ALL,
      MetadataOperation.EDIT_LINEAGE,
      MetadataOperation.EDIT_CUSTOM_FIELDS,
      MetadataOperation.EDIT_DISPLAY_NAME
    };
    ResourcePermission rp2 = getResourcePermission("r2", Access.ALLOW, op2);
    List<MetadataOperation> expectedOp2 =
        new ArrayList(
            List.of(
                MetadataOperation.ALL,
                MetadataOperation.VIEW_BASIC,
                MetadataOperation.VIEW_USAGE,
                MetadataOperation.EDIT_ALL));

    List<ResourcePermission> rpList = List.of(rp1, rp2);
    PolicyEvaluator.trimResourcePermissions(rpList);
    assertEqualsPermissions(expectedOp1, rpList.get(0).getPermissions());
    assertEqualsPermissions(expectedOp2, rpList.get(1).getPermissions());
  }

  @Test
  void trimResourcePermission() {
    MetadataOperation[] operations = {
      MetadataOperation.ALL,
      MetadataOperation.VIEW_ALL,
      MetadataOperation.VIEW_BASIC,
      MetadataOperation.VIEW_QUERIES,
      MetadataOperation.EDIT_ALL,
      MetadataOperation.EDIT_LINEAGE,
      MetadataOperation.EDIT_CUSTOM_FIELDS
    };
    ResourcePermission rp = getResourcePermission("testResource", Access.ALLOW, operations);
    ResourcePermission trimmedRp = PolicyEvaluator.trimResourcePermission(rp);
    List<MetadataOperation> expectedOperations =
        new ArrayList(List.of(MetadataOperation.ALL, MetadataOperation.VIEW_ALL, MetadataOperation.EDIT_ALL));
    assertEqualsPermissions(expectedOperations, trimmedRp.getPermissions());
  }

  @Test
  void trimPermissions_withAllowAccess_trimmed() {
    List<Permission> permissions = getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<MetadataOperation> expectedOperations =
        Arrays.asList(
            MetadataOperation.ALL,
            MetadataOperation.DELETE,
            MetadataOperation.CREATE,
            MetadataOperation.VIEW_ALL,
            MetadataOperation.EDIT_ALL);
    List<Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withDenyAccess_trimmed() {
    List<Permission> permissions = getPermissions(OperationContext.getAllOperations(), Access.DENY);
    List<MetadataOperation> expectedOperations =
        Arrays.asList(
            MetadataOperation.ALL,
            MetadataOperation.DELETE,
            MetadataOperation.CREATE,
            MetadataOperation.VIEW_ALL,
            MetadataOperation.EDIT_ALL);
    List<Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withNotAllowAccessToViewAll_viewOpsNotTrimmed() {
    List<Permission> permissions = getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<MetadataOperation> expectedOperations =
        Arrays.stream(MetadataOperation.values())
            .filter(operation -> (!operation.value().startsWith("Edit")))
            .collect(Collectors.toList());
    expectedOperations.add(MetadataOperation.EDIT_ALL);
    updateAccess(permissions, MetadataOperation.VIEW_ALL, Access.NOT_ALLOW);

    List<Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withConditionalAllowAccessToEditAll_editOpsNotTrimmed() {
    List<Permission> permissions = getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<MetadataOperation> expectedOperations =
        Arrays.stream(MetadataOperation.values())
            .filter(operation -> (!operation.value().startsWith("View")))
            .collect(Collectors.toList());
    expectedOperations.add(MetadataOperation.VIEW_ALL);
    updateAccess(permissions, MetadataOperation.EDIT_ALL, Access.CONDITIONAL_ALLOW);

    List<Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withConditionalAccess_notTrimmed() {
    List<Permission> permissions = getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<MetadataOperation> expectedOperations = OperationContext.getAllOperations();
    updateAccess(permissions, MetadataOperation.VIEW_ALL, Access.CONDITIONAL_ALLOW);
    updateAccess(permissions, MetadataOperation.EDIT_ALL, Access.CONDITIONAL_DENY);

    List<Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  public static void assertEqualsPermissions(List<MetadataOperation> expectedOperations, List<Permission> actual) {
    assertEquals(expectedOperations.size(), actual.size());

    Comparator<Permission> comparator = Comparator.comparing(Permission::getOperation);
    actual.sort(comparator);
    Collections.sort(expectedOperations);
    for (int i = 0; i < expectedOperations.size(); i++) {
      assertEquals(expectedOperations.get(i).value(), actual.get(i).getOperation().value());
    }
  }

  public static List<Permission> getPermissions(List<MetadataOperation> operations, Access access) {
    ArrayList<Permission> permissions = new ArrayList<>();
    operations.stream().forEach(operation -> permissions.add(getPermission(operation, access)));
    return permissions;
  }

  public static List<Permission> updateAccess(
      List<Permission> permissions, final MetadataOperation operation, Access access) {
    permissions.stream()
        .forEach(
            permission -> {
              if (permission.getOperation().equals(operation)) permission.setAccess(access);
            });
    return permissions;
  }

  public static ResourcePermission getResourcePermission(
      String resourceName, Access access, MetadataOperation... operations) {
    ResourcePermission rp = new ResourcePermission();
    List<Permission> permissions = new ArrayList<>();
    rp.setResource(resourceName);
    for (int i = 0; i < operations.length; i++) {
      permissions.add(new Permission().withAccess(access).withOperation(operations[i]));
    }
    rp.setPermissions(permissions);
    return rp;
  }

  public static Permission getPermission(MetadataOperation operation, Access access) {
    Permission permission = new Permission().withOperation(operation);
    permission.setAccess(access);
    return permission;
  }
}
