/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.listOrEmptyMutable;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addEntityReferences;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.BUSINESS_UNIT;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.DEPARTMENT;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.DIVISION;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.GROUP;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.ORGANIZATION;
import static org.openmetadata.schema.type.EventType.ENTITY_FIELDS_CHANGED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.ORGANIZATION_NAME;
import static org.openmetadata.service.Entity.POLICY;
import static org.openmetadata.service.Entity.ROLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.CREATE_GROUP;
import static org.openmetadata.service.exception.CatalogExceptionMessage.DELETE_ORGANIZATION;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_GROUP_TEAM_CHILDREN_UPDATE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_GROUP_TEAM_UPDATE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.UNEXPECTED_PARENT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidChild;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidParent;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidParentCount;
import static org.openmetadata.service.util.EntityUtil.*;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.TeamHierarchy;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvErrorType;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.feeds.FeedUtil;
import org.openmetadata.service.resources.teams.TeamResource;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class TeamRepository extends EntityRepository<Team> {
  static final String PARENTS_FIELD = "parents";
  static final String USERS_FIELD = "users";
  static final String TEAM_UPDATE_FIELDS =
      "profile,users,defaultRoles,parents,children,policies,teamType,email,domains";
  static final String TEAM_PATCH_FIELDS =
      "profile,users,defaultRoles,parents,children,policies,teamType,email,domains";
  private static final String DEFAULT_ROLES = "defaultRoles";
  private Team organization = null;

  public TeamRepository() {
    super(
        TeamResource.COLLECTION_PATH,
        TEAM,
        Team.class,
        Entity.getCollectionDAO().teamDAO(),
        TEAM_PATCH_FIELDS,
        TEAM_UPDATE_FIELDS);
    this.quoteFqn = true;
    supportsSearch = true;

    this.fieldFetchers.put("users", this::fetchAndSetUsers);
    this.fieldFetchers.put("defaultRoles", this::fetchAndSetDefaultRoles);
    this.fieldFetchers.put("parents", this::fetchAndSetParents);
    this.fieldFetchers.put("policies", this::fetchAndSetPolicies);
    this.fieldFetchers.put("childrenCount", this::fetchAndSetChildrenCount);
    this.fieldFetchers.put("userCount", this::fetchAndSetUserCount);
    this.fieldFetchers.put("owns", this::fetchAndSetOwns);
  }

  @Override
  public void setFields(Team team, Fields fields) {
    team.setUsers(fields.contains("users") ? getUsers(team) : team.getUsers());
    team.setOwns(fields.contains("owns") ? getOwns(team) : team.getOwns());
    team.setDefaultRoles(
        fields.contains(DEFAULT_ROLES) ? getDefaultRoles(team) : team.getDefaultRoles());
    team.setInheritedRoles(
        fields.contains(DEFAULT_ROLES) ? getInheritedRoles(team) : team.getInheritedRoles());
    team.setParents(fields.contains(PARENTS_FIELD) ? getParents(team) : team.getParents());
    team.setPolicies(fields.contains("policies") ? getPolicies(team) : team.getPolicies());
    team.setChildrenCount(
        fields.contains("childrenCount") ? getChildrenCount(team) : team.getChildrenCount());
    team.setUserCount(
        fields.contains("userCount") ? getUserCount(team.getId()) : team.getUserCount());
    team.setDomains(fields.contains(FIELD_DOMAINS) ? getDomains(team.getId()) : team.getDomains());
  }

  @Override
  public void clearFields(Team team, Fields fields) {
    team.setProfile(fields.contains("profile") ? team.getProfile() : null);
    team.setUsers(fields.contains("users") ? team.getUsers() : null);
    team.setOwns(fields.contains("owns") ? team.getOwns() : null);
    team.setDefaultRoles(fields.contains(DEFAULT_ROLES) ? team.getDefaultRoles() : null);
    team.setInheritedRoles(fields.contains(DEFAULT_ROLES) ? team.getInheritedRoles() : null);
    team.setParents(fields.contains(PARENTS_FIELD) ? team.getParents() : null);
    team.setPolicies(fields.contains("policies") ? team.getPolicies() : null);
    if (!fields.contains("childrenCount")) {
      team.setChildrenCount(0);
    }
    if (!fields.contains("userCount")) {
      team.setUserCount(0);
    }
  }

  private void fetchAndSetUsers(List<Team> teams, Fields fields) {
    if (!fields.contains("users") || teams == null || teams.isEmpty()) {
      return;
    }

    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> userRecords =
        daoCollection
            .relationshipDAO()
            .findToBatch(teamIds, Relationship.HAS.ordinal(), TEAM, Entity.USER);

    Map<UUID, List<EntityReference>> teamToUsers = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : userRecords) {
      UUID teamId = UUID.fromString(record.getFromId());
      EntityReference userRef =
          Entity.getEntityReferenceById(
              Entity.USER, UUID.fromString(record.getToId()), Include.ALL);
      teamToUsers.computeIfAbsent(teamId, k -> new ArrayList<>()).add(userRef);
    }

    for (Team team : teams) {
      List<EntityReference> userRefs = teamToUsers.get(team.getId());
      team.setUsers(userRefs != null ? userRefs : new ArrayList<>());
    }
  }

  private void fetchAndSetDefaultRoles(List<Team> teams, Fields fields) {
    if (!fields.contains(DEFAULT_ROLES) || teams == null || teams.isEmpty()) {
      return;
    }

    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> roleRecords =
        daoCollection
            .relationshipDAO()
            .findToBatch(teamIds, Relationship.HAS.ordinal(), TEAM, Entity.ROLE);

    Map<UUID, List<EntityReference>> teamToRoles = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : roleRecords) {
      UUID teamId = UUID.fromString(record.getFromId());
      EntityReference roleRef =
          Entity.getEntityReferenceById(
              Entity.ROLE, UUID.fromString(record.getToId()), Include.ALL);
      teamToRoles.computeIfAbsent(teamId, k -> new ArrayList<>()).add(roleRef);
    }

    for (Team team : teams) {
      List<EntityReference> roleRefs = teamToRoles.get(team.getId());
      team.setDefaultRoles(roleRefs != null ? roleRefs : new ArrayList<>());
    }
  }

  private void fetchAndSetParents(List<Team> teams, Fields fields) {
    if (!fields.contains(PARENTS_FIELD) || teams == null || teams.isEmpty()) {
      return;
    }

    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> parentRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(teamIds, Relationship.PARENT_OF.ordinal(), TEAM, TEAM);

    Map<UUID, List<EntityReference>> teamToParents = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : parentRecords) {
      UUID teamId = UUID.fromString(record.getToId());
      EntityReference parentRef =
          Entity.getEntityReferenceById(TEAM, UUID.fromString(record.getFromId()), Include.ALL);
      teamToParents.computeIfAbsent(teamId, k -> new ArrayList<>()).add(parentRef);
    }

    for (Team team : teams) {
      List<EntityReference> parentRefs = teamToParents.get(team.getId());
      if (parentRefs == null || parentRefs.isEmpty()) {
        if (organization != null && !team.getId().equals(organization.getId())) {
          team.setParents(new ArrayList<>(List.of(organization.getEntityReference())));
        } else {
          team.setParents(new ArrayList<>());
        }
      } else {
        team.setParents(parentRefs);
      }
    }
  }

  private void fetchAndSetPolicies(List<Team> teams, Fields fields) {
    if (!fields.contains("policies") || teams == null || teams.isEmpty()) {
      return;
    }

    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> policyRecords =
        daoCollection
            .relationshipDAO()
            .findToBatch(teamIds, Relationship.HAS.ordinal(), TEAM, POLICY);

    Map<UUID, List<EntityReference>> teamToPolicies = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : policyRecords) {
      UUID teamId = UUID.fromString(record.getFromId());
      EntityReference policyRef =
          Entity.getEntityReferenceById(POLICY, UUID.fromString(record.getToId()), Include.ALL);
      teamToPolicies.computeIfAbsent(teamId, k -> new ArrayList<>()).add(policyRef);
    }

    for (Team team : teams) {
      List<EntityReference> policyRefs = teamToPolicies.get(team.getId());
      team.setPolicies(policyRefs != null ? policyRefs : new ArrayList<>());
    }
  }

  private void fetchAndSetChildrenCount(List<Team> teams, Fields fields) {
    if (!fields.contains("childrenCount") || teams == null || teams.isEmpty()) {
      return;
    }
    for (Team team : teams) {
      if (organization != null && team.getId().equals(organization.getId())) {
        List<String> children = daoCollection.teamDAO().listTeamsUnderOrganization(team.getId());
        team.setChildrenCount(children.size());
      } else {
        // For other teams, count direct children
        List<EntityReference> children = findTo(team.getId(), TEAM, Relationship.PARENT_OF, TEAM);
        team.setChildrenCount(children != null ? children.size() : 0);
      }
    }
  }

  private void fetchAndSetUserCount(List<Team> teams, Fields fields) {
    if (!fields.contains("userCount") || teams == null || teams.isEmpty()) {
      return;
    }

    for (Team team : teams) {
      List<String> userIds = new ArrayList<>();
      List<EntityRelationshipRecord> userRecordList = getUsersRelationshipRecords(team.getId());
      for (EntityRelationshipRecord userRecord : userRecordList) {
        userIds.add(userRecord.getId().toString());
      }
      Set<String> userIdsSet = new HashSet<>(userIds);
      team.setUserCount(userIdsSet.size());
    }
  }

  private void fetchAndSetOwns(List<Team> teams, Fields fields) {
    if (!fields.contains("owns") || teams == null || teams.isEmpty()) {
      return;
    }

    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> ownsRecords =
        daoCollection
            .relationshipDAO()
            .findToBatchAllTypes(teamIds, Relationship.OWNS.ordinal(), Include.ALL);

    Map<UUID, List<EntityReference>> teamToOwns = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : ownsRecords) {
      UUID teamId = UUID.fromString(record.getFromId());
      try {
        EntityReference ownedRef =
            Entity.getEntityReferenceById(
                record.getToEntity(), UUID.fromString(record.getToId()), Include.ALL);
        teamToOwns.computeIfAbsent(teamId, k -> new ArrayList<>()).add(ownedRef);
      } catch (Exception e) {
        LOG.warn("Failed to get entity reference for owned entity: {}", record.getToId(), e);
      }
    }

    for (Team team : teams) {
      List<EntityReference> ownsRefs = teamToOwns.get(team.getId());
      team.setOwns(ownsRefs != null ? ownsRefs : new ArrayList<>());
    }
  }

  private List<EntityReference> getDomains(UUID teamId) {
    // Team does not have domain. 'domains' is the field for user as team can belong to multiple
    // domains
    return findFrom(teamId, TEAM, Relationship.HAS, Entity.DOMAIN);
  }

  @Override
  protected void storeDomains(Team entity, List<EntityReference> exclude) {
    for (EntityReference domainRef : listOrEmpty(entity.getDomains())) {
      // Add relationship domain --- has ---> entity
      LOG.info(
          "Adding domain {} for user {}:{}",
          domainRef.getFullyQualifiedName(),
          entityType,
          entity.getId());
      addRelationship(
          domainRef.getId(), entity.getId(), Entity.DOMAIN, entityType, Relationship.HAS);
    }
  }

  @Override
  public void restorePatchAttributes(Team original, Team updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withInheritedRoles(original.getInheritedRoles());
  }

  @Override
  public void prepare(Team team, boolean update) {
    populateParents(team); // Validate parents
    populateChildren(team); // Validate children
    validateUsers(team.getUsers());
    validateRoles(team.getDefaultRoles());
    validatePolicies(team.getPolicies());
  }

  public BulkOperationResult bulkAddAssets(String teamName, BulkAssets request) {
    Team team = getByName(null, teamName, getFields("id"));

    // Validate all to be users
    validateAllRefUsers(request.getAssets());

    for (EntityReference asset : request.getAssets()) {
      if (!Objects.equals(asset.getType(), Entity.USER)) {
        throw new IllegalArgumentException("Only users can be added to a Team");
      }
    }

    return bulkAssetsOperation(team.getId(), TEAM, Relationship.HAS, request, true);
  }

  public BulkOperationResult bulkRemoveAssets(String domainName, BulkAssets request) {
    Team team = getByName(null, domainName, getFields("id"));

    // Validate all to be users
    validateAllRefUsers(request.getAssets());

    return bulkAssetsOperation(team.getId(), TEAM, Relationship.HAS, request, false);
  }

  private void validateAllRefUsers(List<EntityReference> refs) {
    for (EntityReference asset : refs) {
      if (!Objects.equals(asset.getType(), Entity.USER)) {
        throw new IllegalArgumentException("Only users can be added to a Team");
      }
    }
  }

  @Override
  public void storeEntity(Team team, boolean update) {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> users = team.getUsers();
    List<EntityReference> defaultRoles = team.getDefaultRoles();
    List<EntityReference> parents = team.getParents();
    List<EntityReference> policies = team.getPolicies();

    // Don't store users, defaultRoles, href as JSON. Build it on the fly based on relationships
    team.withUsers(null)
        .withDefaultRoles(null)
        .withParents(null)
        .withPolicies(null)
        .withInheritedRoles(null);

    store(team, update);

    // Restore the relationships
    team.withUsers(users)
        .withDefaultRoles(defaultRoles)
        .withParents(parents)
        .withPolicies(policies);
  }

  @Override
  public void storeRelationships(Team team) {
    for (EntityReference user : listOrEmpty(team.getUsers())) {
      addRelationship(team.getId(), user.getId(), TEAM, Entity.USER, Relationship.HAS);
    }
    for (EntityReference defaultRole : listOrEmpty(team.getDefaultRoles())) {
      addRelationship(team.getId(), defaultRole.getId(), TEAM, Entity.ROLE, Relationship.HAS);
    }
    for (EntityReference parent : listOrEmpty(team.getParents())) {
      if (parent.getId().equals(organization.getId())) {
        continue; // When the parent is the default parent - organization, don't store the
        // relationship
      }
      addRelationship(parent.getId(), team.getId(), TEAM, TEAM, Relationship.PARENT_OF);
    }
    for (EntityReference child : listOrEmpty(team.getChildren())) {
      addRelationship(team.getId(), child.getId(), TEAM, TEAM, Relationship.PARENT_OF);
    }
    for (EntityReference policy : listOrEmpty(team.getPolicies())) {
      addRelationship(team.getId(), policy.getId(), TEAM, POLICY, Relationship.HAS);
    }
  }

  @Override
  public void setInheritedFields(Team team, Fields fields) {
    // If user does not have domain, then inherit it from parent Team
    // TODO have default team when a user belongs to multiple teams
    if (fields.contains(FIELD_DOMAINS)) {
      Set<EntityReference> combinedParent = new TreeSet<>(EntityUtil.compareEntityReferenceById);
      List<EntityReference> parents =
          !fields.contains(PARENTS_FIELD) ? getParents(team) : team.getParents();
      if (!nullOrEmpty(parents)) {
        for (EntityReference parentRef : parents) {
          Team parentTeam = Entity.getEntity(TEAM, parentRef.getId(), "domains", ALL);
          combinedParent.addAll(parentTeam.getDomains());
        }
      }
      team.setDomains(
          EntityUtil.mergedInheritedEntityRefs(
              team.getDomains(), combinedParent.stream().toList()));
    }
  }

  @Override
  public EntityRepository<Team>.EntityUpdater getUpdater(
      Team original, Team updated, Operation operation, ChangeSource changeSource) {
    return new TeamUpdater(original, updated, operation);
  }

  @Override
  protected void preDelete(Team entity, String deletedBy) {
    if (entity.getId().equals(organization.getId())) {
      throw new IllegalArgumentException(DELETE_ORGANIZATION);
    }
  }

  @Override
  protected void entitySpecificCleanup(Team team) {
    // When a team is deleted, if the children team don't have another parent, set Organization as
    // the parent
    for (EntityReference child : listOrEmpty(team.getChildren())) {
      Team childTeam = find(child.getId(), NON_DELETED);
      getParents(childTeam);
      if (childTeam.getParents().size()
          == 1) { // Only parent is being deleted, move the parent to Organization
        addRelationship(
            organization.getId(), childTeam.getId(), TEAM, TEAM, Relationship.PARENT_OF);
        LOG.info("Moving parent of team " + childTeam.getId() + " to organization");
      }
    }
  }

  @Override
  public String exportToCsv(String parentTeam, String user, boolean recursive) throws IOException {
    Team team = getByName(null, parentTeam, Fields.EMPTY_FIELDS); // Validate team name
    return new TeamCsv(team, user).exportCsv();
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    Team team = getByName(null, name, Fields.EMPTY_FIELDS); // Validate team name
    TeamCsv teamCsv = new TeamCsv(team, user);
    return teamCsv.importCsv(csv, dryRun);
  }

  private List<EntityReference> getInheritedRoles(Team team) {
    return SubjectContext.getRolesForTeams(getParentsForInheritedRoles(team));
  }

  protected void entitySpecificCleanup(User entityInterface) {
    FeedUtil.cleanUpTaskForAssignees(entityInterface.getId(), TEAM);
  }

  private TeamHierarchy getTeamHierarchy(Team team) {
    return new TeamHierarchy()
        .withId(team.getId())
        .withTeamType(team.getTeamType())
        .withName(team.getName())
        .withDisplayName(team.getDisplayName())
        .withHref(team.getHref())
        .withFullyQualifiedName(team.getFullyQualifiedName())
        .withIsJoinable(team.getIsJoinable())
        .withChildren(new ArrayList<>())
        .withDescription(team.getDescription());
  }

  public List<TeamHierarchy> listHierarchy(ListFilter filter, int limit, Boolean isJoinable) {
    Fields fields = getFields(PARENTS_FIELD);
    ResultList<Team> resultList = listAfter(null, fields, filter, limit, null);
    List<Team> allTeams = resultList.getData();
    List<Team> joinableTeams =
        allTeams.stream()
            .filter(Boolean.TRUE.equals(isJoinable) ? Team::getIsJoinable : t -> true)
            .filter(t -> !t.getName().equals(ORGANIZATION_NAME))
            .toList();

    Map<UUID, TeamHierarchy> hierarchyMap = new HashMap<>();
    for (Team team : joinableTeams) {
      if (!hierarchyMap.containsKey(team.getId())) {
        hierarchyMap.put(team.getId(), getTeamHierarchy(team));
      }
    }

    for (Team team : joinableTeams) {
      if (team.getParents() == null) {
        continue;
      }
      for (EntityReference parentRef : team.getParents()) {
        if (parentRef.getName().equals(ORGANIZATION_NAME)) {
          continue;
        }

        Team parentTeam =
            allTeams.stream()
                .filter(t -> t.getId().equals(parentRef.getId()))
                .findFirst()
                .orElse(null);
        if (parentTeam == null) {
          continue;
        }

        hierarchyMap.putIfAbsent(parentTeam.getId(), getTeamHierarchy(parentTeam));
        TeamHierarchy parentNode = hierarchyMap.get(parentTeam.getId());
        TeamHierarchy childNode = hierarchyMap.get(team.getId());

        if (parentNode.getChildren() == null) {
          parentNode.setChildren(new ArrayList<>());
        }

        boolean childAlreadyAdded =
            parentNode.getChildren().stream()
                .anyMatch(child -> child.getId().equals(childNode.getId()));
        if (!childAlreadyAdded) {
          parentNode.getChildren().add(childNode);
        }
      }
    }

    Set<UUID> childIds = new HashSet<>();
    for (TeamHierarchy node : hierarchyMap.values()) {
      if (node.getChildren() != null) {
        for (TeamHierarchy child : node.getChildren()) {
          childIds.add(child.getId());
        }
      }
    }
    List<TeamHierarchy> topLevelNodes =
        hierarchyMap.values().stream()
            .filter(node -> !childIds.contains(node.getId()))
            .sorted(Comparator.comparing(TeamHierarchy::getName))
            .collect(Collectors.toList());

    return topLevelNodes;
  }

  private List<EntityReference> getUsers(Team team) {
    return findTo(team.getId(), TEAM, Relationship.HAS, Entity.USER);
  }

  private List<EntityRelationshipRecord> getUsersRelationshipRecords(UUID teamId) {
    List<EntityRelationshipRecord> userRecord =
        findToRecords(teamId, TEAM, Relationship.HAS, Entity.USER);
    List<EntityReference> children = getChildren(teamId);
    for (EntityReference child : children) {
      userRecord.addAll(getUsersRelationshipRecords(child.getId()));
    }
    return userRecord;
  }

  private Integer getUserCount(UUID teamId) {
    List<String> userIds = new ArrayList<>();
    List<EntityRelationshipRecord> userRecordList = getUsersRelationshipRecords(teamId);
    for (EntityRelationshipRecord userRecord : userRecordList) {
      userIds.add(userRecord.getId().toString());
    }
    Set<String> userIdsSet = new HashSet<>(userIds);
    userIds.clear();
    userIds.addAll(userIdsSet);
    return userIds.size();
  }

  private List<EntityReference> getOwns(Team team) {
    // Compile entities owned by the team
    return findTo(team.getId(), TEAM, Relationship.OWNS, null);
  }

  private List<EntityReference> getDefaultRoles(Team team) {
    return findTo(team.getId(), TEAM, Relationship.HAS, Entity.ROLE);
  }

  private List<EntityReference> getParents(Team team) {
    List<EntityReference> parents = findFrom(team.getId(), TEAM, Relationship.PARENT_OF, TEAM);
    if (organization != null
        && listOrEmpty(parents).isEmpty()
        && !team.getId().equals(organization.getId())) {
      return new ArrayList<>(List.of(organization.getEntityReference()));
    }
    return parents;
  }

  private List<EntityReference> getParentsForInheritedRoles(Team team) {
    // filter out any deleted teams
    List<EntityReference> parents =
        findFrom(team.getId(), TEAM, Relationship.PARENT_OF, TEAM).stream()
            .filter(e -> !e.getDeleted())
            .collect(Collectors.toList());
    if (organization != null
        && listOrEmpty(parents).isEmpty()
        && !team.getId().equals(organization.getId())) {
      return new ArrayList<>(List.of(organization.getEntityReference()));
    }
    return parents;
  }

  @Override
  protected List<EntityReference> getChildren(Team team) {
    return getChildren(team.getId());
  }

  protected List<EntityReference> getChildren(UUID teamId) {
    if (teamId.equals(
        organization.getId())) { // For organization all the parentless teams are children
      List<String> children = daoCollection.teamDAO().listTeamsUnderOrganization(teamId);
      return EntityUtil.populateEntityReferencesById(EntityUtil.strToIds(children), Entity.TEAM);
    }
    return findTo(teamId, TEAM, Relationship.PARENT_OF, TEAM);
  }

  private Integer getChildrenCount(Team team) {
    if (!nullOrEmpty(team.getChildren())) {
      return team.getChildren().size();
    }
    List<EntityReference> children = getChildren(team);
    return children != null ? children.size() : 0;
  }

  private List<EntityReference> getPolicies(Team team) {
    return findTo(team.getId(), TEAM, Relationship.HAS, POLICY);
  }

  private void populateChildren(Team team) {
    List<EntityReference> childrenRefs = team.getChildren();
    if (childrenRefs == null) {
      return;
    }
    List<Team> children = getTeams(childrenRefs);
    switch (team.getTeamType()) {
      case GROUP:
        if (!children.isEmpty()) {
          throw new IllegalArgumentException(CREATE_GROUP);
        }
        break;
      case DEPARTMENT:
        validateChildren(team, children, DEPARTMENT, GROUP);
        break;
      case DIVISION:
        validateChildren(team, children, DEPARTMENT, DIVISION, GROUP);
        break;
      case BUSINESS_UNIT, ORGANIZATION:
        validateChildren(team, children, BUSINESS_UNIT, DIVISION, DEPARTMENT, GROUP);
        break;
    }
    populateTeamRefs(childrenRefs, children);
  }

  private void populateParents(Team team) {
    // Teams created without parents has the top Organization as the default parent
    List<EntityReference> parentRefs = listOrEmpty(team.getParents());

    // When there are no parents for a team, add organization as the default parent
    if (parentRefs.isEmpty() && !team.getName().equals(ORGANIZATION_NAME)) {
      team.setParents(new ArrayList<>());
      team.getParents().add(organization.getEntityReference());
      return;
    }
    List<Team> parents = getTeams(parentRefs);
    switch (team.getTeamType()) {
      case GROUP, DEPARTMENT:
        validateParents(team, parents, DEPARTMENT, DIVISION, BUSINESS_UNIT, ORGANIZATION);
        break;
      case DIVISION:
        validateSingleParent(team, parentRefs);
        validateParents(team, parents, DIVISION, BUSINESS_UNIT, ORGANIZATION);
        break;
      case BUSINESS_UNIT:
        validateSingleParent(team, parentRefs);
        validateParents(team, parents, BUSINESS_UNIT, ORGANIZATION);
        break;
      case ORGANIZATION:
        if (!parentRefs.isEmpty()) {
          throw new IllegalArgumentException(UNEXPECTED_PARENT);
        }
    }
    populateTeamRefs(parentRefs, parents);
  }

  // Populate team refs from team entity list
  private void populateTeamRefs(List<EntityReference> teamRefs, List<Team> teams) {
    for (int i = 0; i < teams.size(); i++) {
      EntityUtil.copy(teams.get(i).getEntityReference(), teamRefs.get(i));
    }
  }

  private List<Team> getTeams(List<EntityReference> teamRefs) {
    List<Team> teams = new ArrayList<>();
    for (EntityReference teamRef : teamRefs) {
      try {
        Team team = find(teamRef.getId(), NON_DELETED);
        teams.add(team);
      } catch (EntityNotFoundException ex) {
        // Team was soft-deleted
        LOG.debug("Failed to populate team since it might be soft deleted.", ex);
        // Ensure that the team was soft-deleted otherwise throw an exception
        find(teamRef.getId(), Include.DELETED);
      }
    }
    return teams;
  }

  // Validate if the team can have given type of parents
  private void validateParents(Team team, List<Team> relatedTeams, TeamType... allowedTeamTypes) {
    List<TeamType> allowed = Arrays.asList(allowedTeamTypes);
    for (Team relatedTeam : relatedTeams) {
      if (!allowed.contains(relatedTeam.getTeamType())) {
        throw new IllegalArgumentException(
            invalidParent(relatedTeam, team.getName(), team.getTeamType()));
      }
    }
  }

  // Validate if the team can given type of children
  private void validateChildren(Team team, List<Team> children, TeamType... allowedTeamTypes) {
    List<TeamType> allowed = Arrays.asList(allowedTeamTypes);
    for (Team child : children) {
      if (!allowed.contains(child.getTeamType())) {
        throw new IllegalArgumentException(invalidChild(team.getName(), team.getTeamType(), child));
      }
    }
  }

  private void validateSingleParent(Team team, List<EntityReference> parentRefs) {
    if (listOrEmpty(parentRefs).size() != 1) {
      throw new IllegalArgumentException(invalidParentCount(1, team.getTeamType()));
    }
  }

  @Transaction
  public RestUtil.PutResponse<Team> updateTeamUsers(
      String updatedBy, UUID teamId, List<EntityReference> updatedUsers) {

    if (updatedUsers == null) {
      throw new IllegalArgumentException("Users list cannot be null");
    }

    Team team = Entity.getEntity(Entity.TEAM, teamId, USERS_FIELD, Include.NON_DELETED);
    if (!team.getTeamType().equals(CreateTeam.TeamType.GROUP)) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidTeamUpdateUsers(team.getTeamType()));
    }

    List<EntityReference> currentUsers = team.getUsers();

    Set<UUID> oldUserIds =
        currentUsers.stream().map(EntityReference::getId).collect(Collectors.toSet());
    Set<UUID> updatedUserIds =
        updatedUsers.stream().map(EntityReference::getId).collect(Collectors.toSet());
    List<EntityReference> addedUsers =
        updatedUsers.stream()
            .filter(user -> !oldUserIds.contains(user.getId()))
            .collect(Collectors.toList());

    Optional.of(addedUsers).ifPresent(this::validateUsers);

    List<UUID> addedUserIds =
        updatedUsers.stream()
            .map(EntityReference::getId)
            .filter(id -> !oldUserIds.contains(id))
            .collect(Collectors.toList());

    List<UUID> removedUserIds =
        currentUsers.stream()
            .map(EntityReference::getId)
            .filter(id -> !updatedUserIds.contains(id))
            .collect(Collectors.toList());

    Optional.of(addedUserIds)
        .filter(ids -> !ids.isEmpty())
        .ifPresent(
            ids -> bulkAddToRelationship(teamId, ids, Entity.TEAM, Entity.USER, Relationship.HAS));

    Optional.of(removedUserIds)
        .filter(ids -> !ids.isEmpty())
        .ifPresent(
            ids ->
                bulkRemoveToRelationship(teamId, ids, Entity.TEAM, Entity.USER, Relationship.HAS));

    setFieldsInternal(team, new EntityUtil.Fields(allowedFields, USERS_FIELD));
    ChangeDescription change = new ChangeDescription().withPreviousVersion(team.getVersion());
    fieldAdded(change, USERS_FIELD, updatedUsers);

    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEntity(team)
            .withChangeDescription(change)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(entityType)
            .withEntityId(teamId)
            .withEntityFullyQualifiedName(team.getFullyQualifiedName())
            .withUserName(updatedBy)
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(team.getVersion())
            .withPreviousVersion(change.getPreviousVersion());
    team.setChangeDescription(change);

    return new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public final RestUtil.PutResponse<Team> deleteTeamUser(
      String updatedBy, UUID teamId, UUID userId) {
    Team team = find(teamId, NON_DELETED);
    if (!team.getTeamType().equals(CreateTeam.TeamType.GROUP)) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidTeamUpdateUsers(team.getTeamType()));
    }

    // Validate user
    EntityReference user = Entity.getEntityReferenceById(Entity.USER, userId, NON_DELETED);

    deleteRelationship(teamId, Entity.TEAM, userId, Entity.USER, Relationship.HAS);

    ChangeDescription change = new ChangeDescription().withPreviousVersion(team.getVersion());
    fieldDeleted(change, USERS_FIELD, List.of(user));

    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEntity(team)
            .withChangeDescription(change)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityFullyQualifiedName(team.getFullyQualifiedName())
            .withEntityType(entityType)
            .withEntityId(teamId)
            .withUserName(updatedBy)
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(team.getVersion())
            .withPreviousVersion(change.getPreviousVersion());

    return new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public void initOrganization() {
    organization = findByNameOrNull(ORGANIZATION_NAME, ALL);
    if (organization == null) {
      LOG.debug("Organization {} is not initialized", ORGANIZATION_NAME);
      // Teams
      try {
        EntityReference organizationPolicy =
            Entity.getEntityReferenceByName(POLICY, "OrganizationPolicy", Include.ALL);
        EntityReference dataConsumerRole =
            Entity.getEntityReferenceByName(ROLE, "DataConsumer", Include.ALL);
        Team team =
            new Team()
                .withId(UUID.randomUUID())
                .withName(ORGANIZATION_NAME)
                .withDisplayName(ORGANIZATION_NAME)
                .withDescription("Organization under which all the other team hierarchy is created")
                .withTeamType(ORGANIZATION)
                .withUpdatedBy(ADMIN_USER_NAME)
                .withUpdatedAt(System.currentTimeMillis())
                .withPolicies(new ArrayList<>(List.of(organizationPolicy)))
                .withDefaultRoles(new ArrayList<>(List.of(dataConsumerRole)));
        organization = create(null, team);
        LOG.info(
            "Organization {}:{} is successfully initialized",
            ORGANIZATION_NAME,
            organization.getId());
      } catch (Exception e) {
        LOG.error("Failed to initialize organization", e);
        throw e;
      }
    } else {
      LOG.info("Organization is already initialized");
    }
  }

  public static class TeamCsv extends EntityCsv<Team> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(TEAM, false);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();
    private final Team team;

    TeamCsv(Team team, String updatedBy) {
      super(Entity.TEAM, HEADERS, updatedBy);
      this.team = team;
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      // Field 1, 2, 3, 4, 7 - name, displayName, description, teamType, isJoinable
      Team team =
          new Team()
              .withName(csvRecord.get(0))
              .withDisplayName(csvRecord.get(1))
              .withDescription(csvRecord.get(2))
              .withTeamType(TeamType.fromValue(csvRecord.get(3)))
              .withOwners(getOwners(printer, csvRecord, 5))
              .withIsJoinable(getBoolean(printer, csvRecord, 6))
              .withDefaultRoles(getEntityReferences(printer, csvRecord, 7, ROLE))
              .withPolicies(getEntityReferences(printer, csvRecord, 8, POLICY));

      // Field 5 - parent teams
      getParents(printer, csvRecord, team);
      if (processRecord) {
        createEntity(printer, csvRecord, team);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, Team entity) {
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addField(recordList, entity.getTeamType().value());
      addEntityReferences(recordList, entity.getParents());
      addOwners(recordList, entity.getOwners());
      addField(recordList, entity.getIsJoinable());
      addEntityReferences(recordList, entity.getDefaultRoles());
      addEntityReferences(recordList, entity.getPolicies());
      addRecord(csvFile, recordList);
    }

    private void getParents(CSVPrinter printer, CSVRecord csvRecord, Team importedTeam)
        throws IOException {
      if (!processRecord) {
        return;
      }
      List<EntityReference> parentRefs = getEntityReferences(printer, csvRecord, 4, Entity.TEAM);

      // Validate team being created is under the hierarchy of the team for which CSV is being
      // imported to
      for (EntityReference parentRef : listOrEmpty(parentRefs)) {
        if (parentRef.getName().equals(team.getName())) {
          continue; // Parent is same as the team to which CSV is being imported, then it is in the
          // same hierarchy
        }
        if (dryRunCreatedEntities.get(parentRef.getName()) != null) {
          continue; // Parent is being created by CSV import
        }
        // Else the parent should already exist
        if (!SubjectContext.isInTeam(team.getName(), parentRef)) {
          importFailure(
              printer,
              invalidTeam(4, team.getName(), importedTeam.getName(), parentRef.getName()),
              csvRecord);
          processRecord = false;
        }
      }
      importedTeam.setParents(parentRefs);
    }

    public static String invalidTeam(
        int field, String team, String importedTeam, String parentName) {
      String error =
          String.format(
              "Parent %s of imported team %s is not under %s team hierarchy",
              parentName, importedTeam, team);
      return String.format(
          "#%s: Field %d error - %s", CsvErrorType.INVALID_FIELD, field + 1, error);
    }

    private List<Team> listTeams(
        TeamRepository repository, String parentTeam, List<Team> teams, Fields fields) {
      // Export the entire hierarchy of teams
      final ListFilter filter =
          new ListFilter(Include.NON_DELETED).addQueryParam("parentTeam", parentTeam);
      List<Team> list = repository.listAll(fields, filter);
      if (nullOrEmpty(list)) {
        return teams;
      }
      teams.addAll(list);
      for (Team teamEntry : list) {
        listTeams(repository, teamEntry.getFullyQualifiedName(), teams, fields);
      }
      return teams;
    }

    public String exportCsv() throws IOException {
      TeamRepository repository = (TeamRepository) Entity.getEntityRepository(TEAM);
      final Fields fields = repository.getFields("owners,defaultRoles,parents,policies");
      return exportCsv(
          listTeams(repository, team.getFullyQualifiedName(), new ArrayList<>(), fields));
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class TeamUpdater extends EntityUpdater {
    public TeamUpdater(Team original, Team updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      if (original.getTeamType() != updated.getTeamType()) {
        // A team of type 'Group' cannot be updated
        if (GROUP.equals(original.getTeamType())) {
          throw new IllegalArgumentException(INVALID_GROUP_TEAM_UPDATE);
        }
        // A team containing children cannot be updated to Group
        if (!original.getChildren().isEmpty() && GROUP.equals(updated.getTeamType())) {
          throw new IllegalArgumentException(INVALID_GROUP_TEAM_CHILDREN_UPDATE);
        }
      }
      recordChange("profile", original.getProfile(), updated.getProfile(), true);
      recordChange("isJoinable", original.getIsJoinable(), updated.getIsJoinable());
      recordChange("teamType", original.getTeamType(), updated.getTeamType());
      // If the team is empty then email should be null, not be empty
      if (CommonUtil.nullOrEmpty(updated.getEmail())) {
        updated.setEmail(null);
      }
      recordChange("email", original.getEmail(), updated.getEmail());
      updateUsers(original, updated);
      updateDefaultRoles(original, updated);
      updateParents(original, updated);
      updateChildren(original, updated);
      updatePolicies(original, updated);
    }

    private void updateUsers(Team origTeam, Team updatedTeam) {
      List<EntityReference> origUsers = listOrEmpty(origTeam.getUsers());
      List<EntityReference> updatedUsers = listOrEmpty(updatedTeam.getUsers());
      updateToRelationships(
          "users",
          TEAM,
          origTeam.getId(),
          Relationship.HAS,
          Entity.USER,
          origUsers,
          updatedUsers,
          false);

      updatedTeam.setUserCount(updatedUsers.size());
    }

    private void updateDefaultRoles(Team origTeam, Team updatedTeam) {
      List<EntityReference> origDefaultRoles = listOrEmpty(origTeam.getDefaultRoles());
      List<EntityReference> updatedDefaultRoles = listOrEmpty(updatedTeam.getDefaultRoles());
      updateToRelationships(
          DEFAULT_ROLES,
          TEAM,
          origTeam.getId(),
          Relationship.HAS,
          Entity.ROLE,
          origDefaultRoles,
          updatedDefaultRoles,
          false);
    }

    @Override
    protected void updateDomains() {
      if (operation.isPut() && !nullOrEmpty(original.getDomains()) && updatedByBot()) {
        // Revert change to non-empty domain if it is being updated by a bot
        // This is to prevent bots from overwriting the domain. Domain need to be
        // updated with a PATCH request
        updated.setDomains(original.getDomains());
        return;
      }

      List<EntityReference> origDomains =
          EntityUtil.populateEntityReferences(listOrEmptyMutable(original.getDomains()));
      List<EntityReference> updatedDomains =
          EntityUtil.populateEntityReferences(listOrEmptyMutable(updated.getDomains()));

      // Remove Domains for the user
      deleteTo(original.getId(), TEAM, Relationship.HAS, Entity.DOMAIN);

      for (EntityReference domain : updatedDomains) {
        addRelationship(domain.getId(), original.getId(), Entity.DOMAIN, TEAM, Relationship.HAS);
      }

      origDomains.sort(EntityUtil.compareEntityReference);
      updatedDomains.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange(
          FIELD_DOMAINS,
          origDomains,
          updatedDomains,
          added,
          deleted,
          EntityUtil.entityReferenceMatch);
    }

    private void updateParents(Team original, Team updated) {
      List<EntityReference> origParents = listOrEmpty(original.getParents());
      List<EntityReference> updatedParents = listOrEmpty(updated.getParents());
      updateFromRelationships(
          PARENTS_FIELD,
          TEAM,
          origParents,
          updatedParents,
          Relationship.PARENT_OF,
          TEAM,
          original.getId());
    }

    private void updateChildren(Team original, Team updated) {
      List<EntityReference> origParents = listOrEmpty(original.getChildren());
      List<EntityReference> updatedParents = listOrEmpty(updated.getChildren());
      updateToRelationships(
          "children",
          TEAM,
          original.getId(),
          Relationship.PARENT_OF,
          TEAM,
          origParents,
          updatedParents,
          false);
    }

    private void updatePolicies(Team original, Team updated) {
      List<EntityReference> origPolicies = listOrEmpty(original.getPolicies());
      List<EntityReference> updatedPolicies = listOrEmpty(updated.getPolicies());
      updateToRelationships(
          "policies",
          TEAM,
          original.getId(),
          Relationship.HAS,
          POLICY,
          origPolicies,
          updatedPolicies,
          false);
    }
  }
}
