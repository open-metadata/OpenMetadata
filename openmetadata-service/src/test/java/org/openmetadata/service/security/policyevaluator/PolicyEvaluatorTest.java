package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.MetadataOperation.ALL;
import static org.openmetadata.schema.type.MetadataOperation.CREATE;
import static org.openmetadata.schema.type.MetadataOperation.CREATE_INGESTION_PIPELINE_AUTOMATOR;
import static org.openmetadata.schema.type.MetadataOperation.DELETE;
import static org.openmetadata.schema.type.MetadataOperation.DELETE_TEST_CASE_FAILED_ROWS_SAMPLE;
import static org.openmetadata.schema.type.MetadataOperation.DEPLOY;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_ALL;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_CUSTOM_FIELDS;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_DISPLAY_NAME;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_LINEAGE;
import static org.openmetadata.schema.type.MetadataOperation.GENERATE_TOKEN;
import static org.openmetadata.schema.type.MetadataOperation.KILL;
import static org.openmetadata.schema.type.MetadataOperation.TRIGGER;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_QUERIES;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_USAGE;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
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

    // newAccess (Deny|Allow|ConditionDeny|ConditionalAllow|NotAllow) and currentAccess Deny takes
    // precedence
    assertFalse(CompiledRule.overrideAccess(Access.DENY, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.ALLOW, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.DENY));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.DENY));

    // newAccess (Deny) and currentAccess Allow - newAccess Deny takes precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.ALLOW));

    // newAccess (Allow|ConditionDeny|ConditionalAllow|NotAllow) and currentAccess Allow takes
    // precedence
    assertFalse(CompiledRule.overrideAccess(Access.ALLOW, Access.ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.ALLOW));

    // newAccess (Deny|Allow) and currentAccess ConditionalDeny - newAccess takes precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.CONDITIONAL_DENY));
    assertTrue(CompiledRule.overrideAccess(Access.ALLOW, Access.CONDITIONAL_DENY));

    // newAccess (ConditionDeny|ConditionalAllow|NotAllow) and currentAccess ConditionalDeny takes
    // precedence
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.CONDITIONAL_DENY));
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.CONDITIONAL_DENY));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.CONDITIONAL_DENY));

    // newAccess (Deny|Allow|ConditionalDeny) and currentAccess ConditionalAllow - newAccess takes
    // precedence
    assertTrue(CompiledRule.overrideAccess(Access.DENY, Access.CONDITIONAL_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.ALLOW, Access.CONDITIONAL_ALLOW));
    assertTrue(CompiledRule.overrideAccess(Access.CONDITIONAL_DENY, Access.CONDITIONAL_ALLOW));

    // newAccess (ConditionalAllow|NotAllow) and currentAccess ConditionalDeny takes precedence
    assertFalse(CompiledRule.overrideAccess(Access.CONDITIONAL_ALLOW, Access.CONDITIONAL_ALLOW));
    assertFalse(CompiledRule.overrideAccess(Access.NOT_ALLOW, Access.CONDITIONAL_ALLOW));

    // newAccess (Deny|Allow|ConditionalDeny|ConditionalAllow) and currentAccess notAllow -
    // newAccess takes precedence
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
      ALL, VIEW_ALL, VIEW_BASIC, VIEW_QUERIES, EDIT_ALL, EDIT_LINEAGE, EDIT_CUSTOM_FIELDS
    };
    ResourcePermission rp1 = getResourcePermission("r1", Access.DENY, op1);
    List<MetadataOperation> expectedOp1 = new ArrayList<>(List.of(ALL, VIEW_ALL, EDIT_ALL));

    MetadataOperation[] op2 = {
      ALL, VIEW_BASIC, VIEW_USAGE, EDIT_ALL, EDIT_LINEAGE, EDIT_CUSTOM_FIELDS, EDIT_DISPLAY_NAME
    };
    ResourcePermission rp2 = getResourcePermission("r2", Access.ALLOW, op2);
    List<MetadataOperation> expectedOp2 =
        new ArrayList<>(List.of(ALL, VIEW_BASIC, VIEW_USAGE, EDIT_ALL));

    List<ResourcePermission> rpList = List.of(rp1, rp2);
    PolicyEvaluator.trimResourcePermissions(rpList);
    assertEqualsPermissions(expectedOp1, rpList.get(0).getPermissions());
    assertEqualsPermissions(expectedOp2, rpList.get(1).getPermissions());
  }

  @Test
  void trimResourcePermission() {
    MetadataOperation[] operations = {
      ALL, VIEW_ALL, VIEW_BASIC, VIEW_QUERIES, EDIT_ALL, EDIT_LINEAGE, EDIT_CUSTOM_FIELDS
    };
    ResourcePermission rp = getResourcePermission("testResource", Access.ALLOW, operations);
    ResourcePermission trimmedRp = PolicyEvaluator.trimResourcePermission(rp);
    List<MetadataOperation> expectedOperations = new ArrayList<>(List.of(ALL, VIEW_ALL, EDIT_ALL));
    assertEqualsPermissions(expectedOperations, trimmedRp.getPermissions());
  }

  @Test
  void trimPermissions_withAllowAccess_trimmed() {
    List<Permission> permissions =
        getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    // trim works only for permissions starting with "EDIT" or "VIEW"
    List<MetadataOperation> expectedOperations =
        Arrays.asList(
            ALL,
            DELETE,
            CREATE,
            CREATE_INGESTION_PIPELINE_AUTOMATOR,
            VIEW_ALL,
            EDIT_ALL,
            DELETE_TEST_CASE_FAILED_ROWS_SAMPLE,
            DEPLOY,
            TRIGGER,
            KILL,
            GENERATE_TOKEN);
    List<Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withDenyAccess_trimmed() {
    List<Permission> permissions = getPermissions(OperationContext.getAllOperations(), Access.DENY);
    // trim works only for permissions starting with "EDIT" or "VIEW"
    List<MetadataOperation> expectedOperations =
        Arrays.asList(
            ALL,
            DELETE,
            CREATE,
            CREATE_INGESTION_PIPELINE_AUTOMATOR,
            VIEW_ALL,
            EDIT_ALL,
            DELETE_TEST_CASE_FAILED_ROWS_SAMPLE,
            DEPLOY,
            TRIGGER,
            KILL,
            GENERATE_TOKEN);
    List<Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withNotAllowAccessToViewAll_viewOpsNotTrimmed() {
    List<Permission> permissions =
        getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<MetadataOperation> expectedOperations =
        Arrays.stream(MetadataOperation.values())
            .filter(operation -> (!operation.value().startsWith("Edit")))
            .collect(Collectors.toList());
    expectedOperations.add(EDIT_ALL);
    updateAccess(permissions, VIEW_ALL, Access.NOT_ALLOW);

    List<Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withConditionalAllowAccessToEditAll_editOpsNotTrimmed() {
    List<Permission> permissions =
        getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<MetadataOperation> expectedOperations =
        Arrays.stream(MetadataOperation.values())
            .filter(operation -> (!operation.value().startsWith("View")))
            .collect(Collectors.toList());
    expectedOperations.add(VIEW_ALL);
    updateAccess(permissions, EDIT_ALL, Access.CONDITIONAL_ALLOW);

    List<Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  @Test
  void trimPermissions_withConditionalAccess_notTrimmed() {
    List<Permission> permissions =
        getPermissions(OperationContext.getAllOperations(), Access.ALLOW);
    List<MetadataOperation> expectedOperations = OperationContext.getAllOperations();
    updateAccess(permissions, VIEW_ALL, Access.CONDITIONAL_ALLOW);
    updateAccess(permissions, EDIT_ALL, Access.CONDITIONAL_DENY);

    List<Permission> actual = PolicyEvaluator.trimPermissions(permissions);
    assertEqualsPermissions(expectedOperations, actual);
  }

  public static void assertEqualsPermissions(
      List<MetadataOperation> expectedOperations, List<Permission> actual) {
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
    operations.forEach(operation -> permissions.add(getPermission(operation, access)));
    return permissions;
  }

  public static void updateAccess(
      List<Permission> permissions, final MetadataOperation operation, Access access) {
    permissions.forEach(
        permission -> {
          if (permission.getOperation().equals(operation)) permission.setAccess(access);
        });
  }

  public static ResourcePermission getResourcePermission(
      String resourceName, Access access, MetadataOperation... operations) {
    ResourcePermission rp = new ResourcePermission();
    List<Permission> permissions = new ArrayList<>();
    rp.setResource(resourceName);
    for (MetadataOperation operation : operations) {
      permissions.add(new Permission().withAccess(access).withOperation(operation));
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
