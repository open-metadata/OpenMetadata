package org.openmetadata.service.security.policyevaluator;

import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.openmetadata.schema.type.EntityReference;

/**
 * Debug information for user permissions showing where each permission comes from
 */
@Data
@NoArgsConstructor
public class PermissionDebugInfo {

  private EntityReference user;
  private List<DirectRolePermission> directRoles = new ArrayList<>();
  private List<TeamPermission> teamPermissions = new ArrayList<>();
  private List<InheritedPermission> inheritedPermissions = new ArrayList<>();
  private PermissionSummary summary;

  @Data
  @NoArgsConstructor
  public static class DirectRolePermission {
    private EntityReference role;
    private List<PolicyInfo> policies = new ArrayList<>();
    private String source = "DIRECT_ASSIGNMENT";
  }

  @Data
  @NoArgsConstructor
  public static class TeamPermission {
    private EntityReference team;
    private List<EntityReference> teamHierarchy = new ArrayList<>(); // From child to parent
    private List<RolePermission> rolePermissions = new ArrayList<>();
    private List<PolicyInfo> directPolicies = new ArrayList<>();
    private String teamType;
    private int hierarchyLevel; // 0 for direct team, 1 for parent, 2 for grandparent, etc.
  }

  @Data
  @NoArgsConstructor
  public static class RolePermission {
    private EntityReference role;
    private List<PolicyInfo> policies = new ArrayList<>();
    private String inheritedFrom; // Team name from which this role was inherited
    private boolean isDefaultRole;
  }

  @Data
  @NoArgsConstructor
  public static class InheritedPermission {
    private String permissionType; // e.g., "RESOURCE_OWNER", "DOMAIN_ACCESS"
    private EntityReference source; // Team or domain that provides this permission
    private List<PolicyInfo> policies = new ArrayList<>();
    private String description;
  }

  @Data
  @NoArgsConstructor
  public static class PolicyInfo {
    private EntityReference policy;
    private List<RuleInfo> rules = new ArrayList<>();
    private String effect; // "ALLOW" or "DENY"
  }

  @Data
  @NoArgsConstructor
  public static class RuleInfo {
    private String name;
    private String effect; // "ALLOW" or "DENY"
    private List<String> operations = new ArrayList<>();
    private List<String> resources = new ArrayList<>();
    private String condition;
    private boolean matches; // Whether this rule matches the current context
  }

  @Data
  @NoArgsConstructor
  public static class PermissionSummary {
    private int totalRoles;
    private int totalPolicies;
    private int totalRules;
    private int directRoles;
    private int inheritedRoles;
    private int teamCount;
    private int maxHierarchyDepth;
    private List<String> effectiveOperations = new ArrayList<>();
    private List<String> deniedOperations = new ArrayList<>();
  }
}
