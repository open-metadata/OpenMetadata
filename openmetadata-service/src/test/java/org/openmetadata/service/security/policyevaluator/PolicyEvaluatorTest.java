package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Permission.Access;

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
    org.openmetadata.schema.type.MetadataOperation[] op1 = {
      org.openmetadata.schema.type.MetadataOperation.ALL,
      org.openmetadata.schema.type.MetadataOperation.VIEW_ALL,
      org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC,
      org.openmetadata.schema.type.MetadataOperation.VIEW_QUERIES,
      org.openmetadata.schema.type.MetadataOperation.EDIT_ALL,
      org.openmetadata.schema.type.MetadataOperation.EDIT_LINEAGE,
      org.openmetadata.schema.type.MetadataOperation.EDIT_CUSTOM_FIELDS
    };
    org.openmetadata.schema.type.ResourcePermission rp1 = getResourcePermission("r1", Access.DENY, op1);
    List<org.openmetadata.schema.type.MetadataOperation> expectedOp1 =
        new ArrayList(
            List.of(
                org.openmetadata.schema.type.MetadataOperation.ALL,
                org.openmetadata.schema.type.MetadataOperation.VIEW_ALL,
                org.openmetadata.schema.type.MetadataOperation.EDIT_ALL));

    org.openmetadata.schema.type.MetadataOperation[] op2 = {
      org.openmetadata.schema.type.MetadataOperation.ALL,
      org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC,
      org.openmetadata.schema.type.MetadataOperation.VIEW_USAGE,
      org.openmetadata.schema.type.MetadataOperation.EDIT_ALL,
      org.openmetadata.schema.type.MetadataOperation.EDIT_LINEAGE,
      org.openmetadata.schema.type.MetadataOperation.EDIT_CUSTOM_FIELDS,
      org.openmetadata.schema.type.MetadataOperation.EDIT_DISPLAY_NAME
    };
    org.openmetadata.schema.type.ResourcePermission rp2 = getResourcePermission("r2", Access.ALLOW, op2);
    List<org.openmetadata.schema.type.MetadataOperation> expectedOp2 =
        new ArrayList(
            List.of(
                org.openmetadata.schema.type.MetadataOperation.ALL,
                org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC,
                org.openmetadata.schema.type.MetadataOperation.VIEW_USAGE,
                org.openmetadata.schema.type.MetadataOperation.EDIT_ALL));

    List<org.openmetadata.schema.type.ResourcePermission> rpList = List.of(rp1, rp2);
    PolicyEvaluator.trimResourcePermissions(rpList);
    assertEqualsPermissions(expectedOp1, rpList.get(0).getPermissions());
    assertEqualsPermissions(expectedOp2, rpList.get(1).getPermissions());
  }

  @Test
  void trimResourcePermission() {
    org.openmetadata.schema.type.MetadataOperation[] operations = {
      org.openmetadata.schema.type.MetadataOperation.ALL,
      org.openmetadata.schema.type.MetadataOperation.VIEW_ALL,
      org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC,
      org.openmetadata.schema.type.MetadataOperation.VIEW_QUERIES,
      org.openmetadata.schema.type.MetadataOperation.EDIT_ALL,
      org.openmetadata.schema.type.MetadataOperation.EDIT_LINEAGE,
      org.openmetadata.schema.type.MetadataOperation.EDIT_CUSTOM_FIELDS
    };
    org.openmetadata.schema.type.ResourcePermission rp =
        getResourcePermission("testResource", Access.ALLOW, operations);
    org.openmetadata.schema.type.ResourcePermission trimmedRp = PolicyEvaluator.trimResourcePermission(rp);
    List<org.openmetadata.schema.type.MetadataOperation> expectedOperations =
        new ArrayList(
            List.of(
                org.openmetadata.schema.type.MetadataOperation.ALL,
                org.openmetadata.schema.type.MetadataOperation.VIEW_ALL,
                org.openmetadata.schema.type.MetadataOperation.EDIT_ALL));
    assertEqualsPermissions(expectedOperations, trimmedRp.getPermissions());
  }

  @Test
  void trimPermissions_withAllowAccess_trimmed() {
    List<org.openmetadata.schema.type.Permission> permissions =
        getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<org.openmetadata.schema.type.MetadataOperation> expectedOperations =
        Arrays.asList(
            org.openmetadata.schema.type.MetadataOperation.ALL,
            org.openmetadata.schema.type.MetadataOperation.DELETE,
            org.openmetadata.schema.type.MetadataOperation.CREATE,
            org.openmetadata.schema.type.MetadataOperation.VIEW_ALL,
            org.openmetadata.schema.type.MetadataOperation.EDIT_ALL);
    List<org.openmetadata.schema.type.Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withDenyAccess_trimmed() {
    List<org.openmetadata.schema.type.Permission> permissions =
        getPermissions(OperationContext.getAllOperations(), Access.DENY);
    List<org.openmetadata.schema.type.MetadataOperation> expectedOperations =
        Arrays.asList(
            org.openmetadata.schema.type.MetadataOperation.ALL,
            org.openmetadata.schema.type.MetadataOperation.DELETE,
            org.openmetadata.schema.type.MetadataOperation.CREATE,
            org.openmetadata.schema.type.MetadataOperation.VIEW_ALL,
            org.openmetadata.schema.type.MetadataOperation.EDIT_ALL);
    List<org.openmetadata.schema.type.Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withNotAllowAccessToViewAll_viewOpsNotTrimmed() {
    List<org.openmetadata.schema.type.Permission> permissions =
        getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<org.openmetadata.schema.type.MetadataOperation> expectedOperations =
        Arrays.stream(org.openmetadata.schema.type.MetadataOperation.values())
            .filter(operation -> (!operation.value().startsWith("Edit")))
            .collect(Collectors.toList());
    expectedOperations.add(org.openmetadata.schema.type.MetadataOperation.EDIT_ALL);
    updateAccess(permissions, org.openmetadata.schema.type.MetadataOperation.VIEW_ALL, Access.NOT_ALLOW);

    List<org.openmetadata.schema.type.Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withConditionalAllowAccessToEditAll_editOpsNotTrimmed() {
    List<org.openmetadata.schema.type.Permission> permissions =
        getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<org.openmetadata.schema.type.MetadataOperation> expectedOperations =
        Arrays.stream(org.openmetadata.schema.type.MetadataOperation.values())
            .filter(operation -> (!operation.value().startsWith("View")))
            .collect(Collectors.toList());
    expectedOperations.add(org.openmetadata.schema.type.MetadataOperation.VIEW_ALL);
    updateAccess(permissions, org.openmetadata.schema.type.MetadataOperation.EDIT_ALL, Access.CONDITIONAL_ALLOW);

    List<org.openmetadata.schema.type.Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withConditionalAccess_notTrimmed() {
    List<org.openmetadata.schema.type.Permission> permissions =
        getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<org.openmetadata.schema.type.MetadataOperation> expectedOperations = OperationContext.getAllOperations();
    updateAccess(permissions, org.openmetadata.schema.type.MetadataOperation.VIEW_ALL, Access.CONDITIONAL_ALLOW);
    updateAccess(permissions, org.openmetadata.schema.type.MetadataOperation.EDIT_ALL, Access.CONDITIONAL_DENY);

    List<org.openmetadata.schema.type.Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  public static void assertEqualsPermissions(
      List<org.openmetadata.schema.type.MetadataOperation> expectedOperations,
      List<org.openmetadata.schema.type.Permission> actual) {
    assertEquals(expectedOperations.size(), actual.size());

    Comparator<org.openmetadata.schema.type.Permission> comparator =
        Comparator.comparing(org.openmetadata.schema.type.Permission::getOperation);
    actual.sort(comparator);
    Collections.sort(expectedOperations);
    for (int i = 0; i < expectedOperations.size(); i++) {
      assertEquals(expectedOperations.get(i).value(), actual.get(i).getOperation().value());
    }
  }

  public static List<org.openmetadata.schema.type.Permission> getPermissions(
      List<org.openmetadata.schema.type.MetadataOperation> operations, Access access) {
    ArrayList<org.openmetadata.schema.type.Permission> permissions = new ArrayList<>();
    operations.stream().forEach(operation -> permissions.add(getPermission(operation, access)));
    return permissions;
  }

  public static List<org.openmetadata.schema.type.Permission> updateAccess(
      List<org.openmetadata.schema.type.Permission> permissions,
      final org.openmetadata.schema.type.MetadataOperation operation,
      Access access) {
    permissions.stream()
        .forEach(
            permission -> {
              if (permission.getOperation().equals(operation)) permission.setAccess(access);
            });
    return permissions;
  }

  public static List<org.openmetadata.schema.type.Permission> getPermissions(
      Access access, org.openmetadata.schema.type.MetadataOperation... operations) {
    ArrayList<org.openmetadata.schema.type.Permission> permissions = new ArrayList<>();
    for (int i = 0; i < operations.length; i++) {
      permissions.add(getPermission(operations[i], access));
    }
    return permissions;
  }

  public static org.openmetadata.schema.type.ResourcePermission getResourcePermission(
      String resourceName, Access access, org.openmetadata.schema.type.MetadataOperation... operations) {
    org.openmetadata.schema.type.ResourcePermission rp = new org.openmetadata.schema.type.ResourcePermission();
    List<org.openmetadata.schema.type.Permission> permissions = new ArrayList<>();
    rp.setResource(resourceName);
    for (int i = 0; i < operations.length; i++) {
      permissions.add(new org.openmetadata.schema.type.Permission().withAccess(access).withOperation(operations[i]));
    }
    rp.setPermissions(permissions);
    return rp;
  }

  public static org.openmetadata.schema.type.Permission getPermission(
      org.openmetadata.schema.type.MetadataOperation operation, Access access) {
    org.openmetadata.schema.type.Permission permission =
        new org.openmetadata.schema.type.Permission().withOperation(operation);
    permission.setAccess(access);
    return permission;
  }
}
