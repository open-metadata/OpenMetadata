package org.openmetadata.service.security.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.AzureSSOClientConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;

@Slf4j
public class AzureAuthenticator extends SSOAuthenticator {
  private AzureSSOClientConfig azureConfig;
  protected TeamRepository teamRepository;
  protected RoleRepository roleRepository;
  protected UserRepository userRepository;
  private boolean isSelfSignUpAvailable;
  private boolean isGroupMappingEnabled;
  private boolean isRoleMappingEnabled;

  @Override
  public void init(OpenMetadataApplicationConfig config) {
    super.init(config);
    this.azureConfig = (AzureSSOClientConfig) ssoAuthMechanism.getAuthConfig();
    this.teamRepository = (TeamRepository) Entity.getEntityRepository(Entity.TEAM);
    this.roleRepository = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
    this.userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    this.isSelfSignUpAvailable = config.getAuthenticationConfiguration().getEnableSelfSignup();
    this.isGroupMappingEnabled = config.getAuthenticationConfiguration().getEnableGroupMapping();
    this.isRoleMappingEnabled = config.getAuthenticationConfiguration().getEnableRoleMapping();
  }

  @Override
  public User lookUserInProvider(String email, String name) throws AuthenticationException {
    try {
      return userRepository.getByEmail(
          null, email, userRepository.getFields("id,name,email,teams,roles"));
    } catch (EntityNotFoundException ex) {
      if (!isSelfSignUpAvailable) {
        throw new AuthenticationException(
            "User account does not exist and self signup is disabled");
      }
      // Create user if it does not exist
      User user = new User();
      user.setId(UUID.randomUUID());
      user.setEmail(email);
      user.setName(name != null ? name : email);
      user.setUpdatedAt(System.currentTimeMillis());
      user.setUpdatedBy(email);
      return userRepository.create(null, user);
    } catch (Exception ex) {
      throw new AuthenticationException("Failed to lookup user");
    }
  }

  @Override
  public void validateGroupAndRoleMapping(JWT jwt, String accessToken)
      throws AuthenticationException {
    try {
      JWTClaimsSet claims;
      if (!isSelfSignUpAvailable) {
        return;
      }

      if (jwt instanceof SignedJWT signedJWT) {
        claims = signedJWT.getJWTClaimsSet();
      } else {
        claims = jwt.getJWTClaimsSet();
      }

      List<String> azureGroups = claims.getStringListClaim("groups");
      List<String> roles = claims.getStringListClaim("roles");
      String userEmail = claims.getStringClaim("email");

      if (userEmail == null) {
        // Fallback to preferred_username if email claim is not present
        userEmail = claims.getStringClaim("preferred_username");
        if (userEmail == null) {
          LOG.error("Neither email nor preferred_username claim found in token");
          throw new AuthenticationException("Invalid token payload - no email identifier found");
        }
      }

      String displayName = claims.getStringClaim("name");
      if (displayName == null || displayName.trim().isEmpty()) {
        displayName = userEmail;
      }

      User user = lookUserInProvider(userEmail, displayName);

      // Handle Azure AD group mapping if enabled
      if (isGroupMappingEnabled) {
        LOG.debug("Processing group mapping for user {}", userEmail);
        List<String> groupsToSync = (azureGroups != null) ? azureGroups : new ArrayList<>();
        syncUserTeams(user, groupsToSync, accessToken);
      }

      // Handle Azure AD role mapping if enabled
      if (isRoleMappingEnabled) {
        LOG.debug("Processing role mapping for user {}", userEmail);
        List<String> rolesToSync = (roles != null) ? roles : new ArrayList<>();
        syncUserRoles(user, rolesToSync, accessToken);
      }

    } catch (AuthenticationException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Failed to validate Azure JWT or sync user teams/roles", e);
      throw new AuthenticationException("Azure JWT validation or team/role sync failed", e);
    }
  }

  protected List<String> getAzureGroupHierarchyPath(String groupId, String accessToken)
      throws IOException, InterruptedException {
    List<String> hierarchy = new ArrayList<>();
    String currentGroupId = groupId;

    while (currentGroupId != null) {
      // Get current group's info
      HttpRequest groupRequest =
          HttpRequest.newBuilder()
              .uri(URI.create("https://graph.microsoft.com/v1.0/groups/" + currentGroupId))
              .header("Authorization", "Bearer " + accessToken)
              .header("Content-Type", "application/json")
              .GET()
              .build();

      HttpClient client = HttpClient.newHttpClient();
      HttpResponse<String> groupResponse =
          client.send(groupRequest, HttpResponse.BodyHandlers.ofString());

      if (groupResponse.statusCode() != 200) {
        LOG.warn("Failed to fetch group info from Azure: {}", groupResponse.body());
        break;
      }

      ObjectMapper mapper = new ObjectMapper();
      JsonNode groupNode = mapper.readTree(groupResponse.body());
      String groupName = groupNode.get("displayName").asText();
      hierarchy.add(0, groupName); // Add to start of list to maintain child->parent order

      // Get immediate parent using memberOf (not transitiveMemberOf)
      HttpRequest parentRequest =
          HttpRequest.newBuilder()
              .uri(
                  URI.create(
                      "https://graph.microsoft.com/v1.0/groups/" + currentGroupId + "/memberOf"))
              .header("Authorization", "Bearer " + accessToken)
              .header("Content-Type", "application/json")
              .GET()
              .build();

      HttpResponse<String> parentResponse =
          client.send(parentRequest, HttpResponse.BodyHandlers.ofString());

      if (parentResponse.statusCode() != 200) {
        LOG.warn("Failed to fetch parent group from Azure: {}", parentResponse.body());
        break;
      }

      JsonNode parentJson = mapper.readTree(parentResponse.body());
      JsonNode values = parentJson.get("value");

      // Look for the next parent group
      currentGroupId = null;
      if (values != null && values.isArray() && values.size() > 0) {
        for (JsonNode parent : values) {
          if (parent.has("@odata.type")
              && parent.get("@odata.type").asText().equals("#microsoft.graph.group")) {
            currentGroupId = parent.get("id").asText();
            break; // Take the first parent group we find
          }
        }
      }
    }

    LOG.debug("Found Azure AD group hierarchy: {}", hierarchy);
    return hierarchy;
  }

  protected void syncUserTeams(User user, List<String> azureGroups, String accessToken)
      throws IOException {
    // Get all Azure group names first with their IDs
    Map<String, String> groupNameToId = new HashMap<>();
    for (String groupId : azureGroups) {
      try {
        String azureGroupName = getAzureGroupName(groupId, accessToken);
        groupNameToId.put(azureGroupName, groupId);
      } catch (Exception e) {
        LOG.debug("Failed to get Azure group name for ID {}", groupId, e);
      }
    }

    // Get all existing team memberships
    Set<EntityReference> currentTeams = new HashSet<>();
    if (user.getTeams() != null) {
      currentTeams.addAll(user.getTeams());
    }

    // Track teams to add and remove
    Set<EntityReference> teamsToKeep = new HashSet<>();

    // Process Azure groups and add user to corresponding teams
    for (Map.Entry<String, String> group : groupNameToId.entrySet()) {
      String azureGroupName = group.getKey();
      String groupId = group.getValue();

      try {
        Team team =
            teamRepository.getByName(
                null, azureGroupName, teamRepository.getFields("parents,children"));

        // Only proceed if this is a leaf team (no children)
        if (team.getChildren() == null || team.getChildren().isEmpty()) {
          // Get the full hierarchy path of this team
          List<String> teamHierarchy = getTeamHierarchyPath(team);

          // Get Azure AD group hierarchy
          List<String> azureHierarchy = getAzureGroupHierarchyPath(groupId, accessToken);

          // Check if the Azure group hierarchy matches the team hierarchy
          if (doHierarchiesMatch(teamHierarchy, azureHierarchy)) {
            EntityReference teamRef = team.getEntityReference();
            teamsToKeep.add(teamRef);

            if (!isUserInTeam(user, team)) {
              // Add user to the team if not already a member
              if (user.getTeams() == null) {
                user.setTeams(new ArrayList<>());
              }
              user.getTeams().add(teamRef);
              LOG.info(
                  "Added user {} to team {} based on Azure AD group",
                  user.getEmail(),
                  azureGroupName);
            }
          } else {
            LOG.debug(
                "Hierarchy mismatch for group {} - Azure AD: {}, OpenMetadata: {}",
                azureGroupName,
                azureHierarchy,
                teamHierarchy);
          }
        } else {
          LOG.debug("Team {} is not a leaf team, skipping", azureGroupName);
        }
      } catch (EntityNotFoundException | InterruptedException e) {
        LOG.debug("No matching OM team found for Azure group {}", azureGroupName);
      }
    }

    // Remove user from teams that don't correspond to Azure groups
    if (user.getTeams() != null) {
      List<EntityReference> updatedTeams =
          user.getTeams().stream()
              .filter(teamRef -> teamsToKeep.contains(teamRef))
              .collect(Collectors.toList());

      // If there are teams to remove, update the user
      if (updatedTeams.size() != user.getTeams().size()) {
        Set<String> removedTeams =
            user.getTeams().stream()
                .filter(team -> !teamsToKeep.contains(team))
                .map(EntityReference::getName)
                .collect(Collectors.toSet());

        user.setTeams(updatedTeams);
        LOG.info(
            "Removed user {} from teams {} as they are not in corresponding Azure AD groups",
            user.getEmail(),
            removedTeams);
      }
    }

    // Update the user if there were any changes
    if (!currentTeams.equals(
        user.getTeams() == null ? new HashSet<>() : new HashSet<>(user.getTeams()))) {
      userRepository.createOrUpdate(null, user, user.getName());
    }
  }

  protected List<String> getTeamHierarchyPath(Team team) {
    List<String> hierarchy = new ArrayList<>();
    hierarchy.add(team.getName());

    List<EntityReference> parents = team.getParents();
    while (parents != null && !parents.isEmpty()) {
      EntityReference parent = parents.get(0); // Get first parent
      Team parentTeam =
          teamRepository.getByName(null, parent.getName(), teamRepository.getFields("parents"));
      // Skip adding "Organization" to hierarchy since it's the default root
      if (!parentTeam.getName().equals("Organization")) {
        hierarchy.add(0, parentTeam.getName()); // Add to start of list
      }
      parents = parentTeam.getParents();
    }
    return hierarchy;
  }

  protected void syncUserRoles(User user, List<String> roles, String accessToken)
      throws IOException {
    // Get current roles
    Set<EntityReference> currentRoles = new HashSet<>();
    if (user.getRoles() != null) {
      currentRoles.addAll(user.getRoles());
    }

    // Track roles to keep based on Azure AD roles claim
    Set<EntityReference> rolesToKeep = new HashSet<>();

    // Process roles from JWT claim
    if (roles != null) {
      for (String azureRoleName : roles) {
        try {
          // Transform role name from Azure format (with dots) to OM format (with spaces)
          String omRoleName = azureRoleName.replace('.', ' ');

          Role role = roleRepository.getByName(null, omRoleName, roleRepository.getFields("users"));
          EntityReference roleRef = role.getEntityReference();
          rolesToKeep.add(roleRef);

          if (!hasRole(user, roleRef)) {
            // Add new role
            if (user.getRoles() == null) {
              user.setRoles(new ArrayList<>());
            }
            user.getRoles().add(roleRef);
            LOG.info(
                "Added role {} to user {} based on Azure AD role claim {}",
                omRoleName,
                user.getEmail(),
                azureRoleName);
          }
        } catch (EntityNotFoundException e) {
          LOG.debug(
              "No matching role found for Azure role {} (OM format: {})",
              azureRoleName,
              azureRoleName.replace('.', ' '));
        }
      }
    }

    // Remove roles that don't correspond to Azure AD roles
    if (user.getRoles() != null) {
      List<EntityReference> updatedRoles =
          user.getRoles().stream()
              .filter(roleRef -> rolesToKeep.contains(roleRef))
              .collect(Collectors.toList());

      // If there are roles to remove, update the user
      if (updatedRoles.size() != user.getRoles().size()) {
        Set<String> removedRoles =
            user.getRoles().stream()
                .filter(role -> !rolesToKeep.contains(role))
                .map(EntityReference::getName)
                .collect(Collectors.toSet());

        user.setRoles(updatedRoles);
        LOG.info(
            "Removed roles {} from user {} as they are not in Azure AD role claims",
            removedRoles,
            user.getEmail());
      }
    }

    // Update the user if there were any changes
    if (!currentRoles.equals(
        user.getRoles() == null ? new HashSet<>() : new HashSet<>(user.getRoles()))) {
      userRepository.createOrUpdate(null, user, user.getName());
    }
  }

  protected String getAzureGroupName(String groupId, String bearerToken)
      throws IOException, InterruptedException {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create("https://graph.microsoft.com/v1.0/groups/" + groupId))
            .header("Authorization", "Bearer " + bearerToken)
            .header("Content-Type", "application/json")
            .GET()
            .build();

    HttpClient client = HttpClient.newHttpClient();
    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() == 200) {
      ObjectMapper mapper = new ObjectMapper();
      JsonNode jsonNode = mapper.readTree(response.body());
      return jsonNode.get("displayName").asText();
    } else {
      throw new IOException("Failed to fetch group name from Azure: " + response.body());
    }
  }

  protected boolean isUserInTeam(User user, Team team) {
    if (user.getTeams() != null) {
      return user.getTeams().stream().anyMatch(teamRef -> teamRef.getId().equals(team.getId()));
    }
    return false;
  }

  protected boolean hasRole(User user, EntityReference roleRef) {
    if (user.getRoles() != null) {
      return user.getRoles().stream().anyMatch(ref -> ref.getId().equals(roleRef.getId()));
    }
    return false;
  }

  protected boolean doHierarchiesMatch(List<String> teamHierarchy, List<String> azureHierarchy) {
    // Compare the hierarchies
    if (teamHierarchy.size() != azureHierarchy.size()) {
      LOG.debug(
          "Hierarchy size mismatch - OM: {}, Azure: {}",
          teamHierarchy.size(),
          azureHierarchy.size());
      return false;
    }

    // Compare each level, ignoring case
    for (int i = 0; i < teamHierarchy.size(); i++) {
      if (!teamHierarchy.get(i).equalsIgnoreCase(azureHierarchy.get(i))) {
        LOG.debug(
            "Hierarchy mismatch at level {} - OM: {}, Azure: {}",
            i,
            teamHierarchy.get(i),
            azureHierarchy.get(i));
        return false;
      }
    }

    return true;
  }
}
