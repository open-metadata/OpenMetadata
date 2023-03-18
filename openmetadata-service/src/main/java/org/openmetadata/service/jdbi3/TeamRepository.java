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

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addEntityReferences;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.BUSINESS_UNIT;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.DEPARTMENT;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.DIVISION;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.GROUP;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.ORGANIZATION;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.Entity.ORGANIZATION_NAME;
import static org.openmetadata.service.Entity.POLICY;
import static org.openmetadata.service.Entity.ROLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.CREATE_GROUP;
import static org.openmetadata.service.exception.CatalogExceptionMessage.DELETE_ORGANIZATION;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_GROUP_TEAM_CHILDREN_UPDATE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_GROUP_TEAM_UPDATE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.TEAM_HIERARCHY;
import static org.openmetadata.service.exception.CatalogExceptionMessage.UNEXPECTED_PARENT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidChild;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidParent;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidParentCount;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.TeamHierarchy;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvErrorType;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.teams.TeamResource;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class TeamRepository extends EntityRepository<Team> {
  static final String TEAM_UPDATE_FIELDS = "owner,profile,users,defaultRoles,parents,children,policies,teamType";
  static final String TEAM_PATCH_FIELDS = "owner,profile,users,defaultRoles,parents,children,policies,teamType";
  private static final String DEFAULT_ROLES = "defaultRoles";
  private Team organization = null;

  public TeamRepository(CollectionDAO dao) {
    super(TeamResource.COLLECTION_PATH, TEAM, Team.class, dao.teamDAO(), dao, TEAM_PATCH_FIELDS, TEAM_UPDATE_FIELDS);
  }

  @Override
  public Team setFields(Team team, Fields fields) throws IOException {
    if (!fields.contains("profile")) {
      team.setProfile(null); // Clear the profile attribute, if it was not requested
    }
    team.setUsers(fields.contains("users") ? getUsers(team) : null);
    team.setOwns(fields.contains("owns") ? getOwns(team) : null);
    team.setDefaultRoles(fields.contains(DEFAULT_ROLES) ? getDefaultRoles(team) : null);
    team.setInheritedRoles(fields.contains(DEFAULT_ROLES) ? getInheritedRoles(team) : null);
    team.setOwner(fields.contains(FIELD_OWNER) ? getOwner(team) : null);
    team.setParents(fields.contains("parents") ? getParents(team) : null);
    team.setChildren(fields.contains("children") ? getChildren(team.getId()) : null);
    team.setPolicies(fields.contains("policies") ? getPolicies(team) : null);
    team.setChildrenCount(fields.contains("childrenCount") ? getChildrenCount(team) : null);
    team.setUserCount(fields.contains("userCount") ? getUserCount(team.getId()) : null);
    return team;
  }

  @Override
  public void restorePatchAttributes(Team original, Team updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withName(original.getName()).withId(original.getId());
    updated.withInheritedRoles(original.getInheritedRoles());
  }

  @Override
  public void prepare(Team team) throws IOException {
    populateParents(team); // Validate parents
    populateChildren(team); // Validate children
    validateUsers(team.getUsers());
    validateRoles(team.getDefaultRoles());
    validatePolicies(team.getPolicies());
  }

  @Override
  public void storeEntity(Team team, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> users = team.getUsers();
    List<EntityReference> defaultRoles = team.getDefaultRoles();
    List<EntityReference> parents = team.getParents();
    List<EntityReference> children = team.getChildren();
    List<EntityReference> policies = team.getPolicies();

    // Don't store users, defaultRoles, href as JSON. Build it on the fly based on relationships
    team.withUsers(null).withDefaultRoles(null).withInheritedRoles(null);

    store(team, update);

    // Restore the relationships
    team.withUsers(users)
        .withDefaultRoles(defaultRoles)
        .withParents(parents)
        .withChildren(children)
        .withPolicies(policies);
  }

  @Override
  public void storeRelationships(Team team) {
    // Add team owner relationship
    storeOwner(team, team.getOwner());
    for (EntityReference user : listOrEmpty(team.getUsers())) {
      addRelationship(team.getId(), user.getId(), TEAM, Entity.USER, Relationship.HAS);
    }
    for (EntityReference defaultRole : listOrEmpty(team.getDefaultRoles())) {
      addRelationship(team.getId(), defaultRole.getId(), TEAM, Entity.ROLE, Relationship.HAS);
    }
    for (EntityReference parent : listOrEmpty(team.getParents())) {
      if (parent.getId().equals(organization.getId())) {
        continue; // When the parent is the default parent - organization, don't store the relationship
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
  public TeamUpdater getUpdater(Team original, Team updated, Operation operation) {
    return new TeamUpdater(original, updated, operation);
  }

  @Override
  protected void preDelete(Team entity) {
    if (entity.getId().equals(organization.getId())) {
      throw new IllegalArgumentException(DELETE_ORGANIZATION);
    }
  }

  @Override
  protected void cleanup(Team team) throws IOException {
    // When a parent team is deleted, if the children team don't have a parent, set Organization as the parent
    getParents(team);
    for (EntityReference child : listOrEmpty(team.getChildren())) {
      Team childTeam = dao.findEntityById(child.getId());
      getParents(childTeam);
      if (childTeam.getParents().size() == 1) { // Only parent is being deleted, move the parent to Organization
        addRelationship(organization.getId(), childTeam.getId(), TEAM, TEAM, Relationship.PARENT_OF);
        LOG.info("Moving parent of team " + childTeam.getId() + " to organization");
      }
    }
    super.cleanup(team);
    SubjectCache.getInstance().invalidateTeam(team.getId());
  }

  @Override
  public String exportToCsv(String parentTeam, String user) throws IOException {
    Team team = getByName(null, parentTeam, Fields.EMPTY_FIELDS); // Validate team name
    return new TeamCsv(team, user).exportCsv();
  }

  @Override
  public CsvImportResult importFromCsv(String name, String csv, boolean dryRun, String user) throws IOException {
    Team team = getByName(null, name, Fields.EMPTY_FIELDS); // Validate team name
    TeamCsv teamCsv = new TeamCsv(team, user);
    return teamCsv.importCsv(csv, dryRun);
  }

  private List<EntityReference> getInheritedRoles(Team team) throws IOException {
    return SubjectCache.getInstance().getRolesForTeams(getParentsForInheritedRoles(team));
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
        .withChildren(null);
  }

  private TeamHierarchy deepCopy(TeamHierarchy team) {
    TeamHierarchy newTeam =
        new TeamHierarchy()
            .withId(team.getId())
            .withTeamType(team.getTeamType())
            .withName(team.getName())
            .withDisplayName(team.getDisplayName())
            .withHref(team.getHref())
            .withFullyQualifiedName(team.getFullyQualifiedName())
            .withIsJoinable(team.getIsJoinable());
    if (team.getChildren() != null) {
      List<TeamHierarchy> children = new ArrayList<>();
      for (TeamHierarchy n : team.getChildren()) {
        children.add(deepCopy(n));
      }
      newTeam.withChildren(children);
    }
    return newTeam;
  }

  private TeamHierarchy mergeTrees(TeamHierarchy team1, TeamHierarchy team2) {
    List<TeamHierarchy> team1Children = team1.getChildren();
    List<TeamHierarchy> team2Children = team2.getChildren();
    if (team1Children != null && team2Children != null) {
      List<TeamHierarchy> toMerge = new ArrayList<>(team1Children);
      toMerge.retainAll(team2Children);

      for (TeamHierarchy n : toMerge) mergeTrees(n, team2Children.get(team2Children.indexOf(n)));
    }
    if (team2Children != null) {
      List<TeamHierarchy> toAdd = new ArrayList<>(team2Children);
      if (team1Children != null) {
        toAdd.removeAll(team1Children);
      } else {
        team1.setChildren(new ArrayList<>());
      }
      for (TeamHierarchy n : toAdd) team1.getChildren().add(deepCopy(n));
    }

    return team1;
  }

  public List<TeamHierarchy> listHierarchy(ListFilter filter, int limit, Boolean isJoinable) throws IOException {
    Fields fields = getFields("parents");
    Map<UUID, TeamHierarchy> map = new HashMap<>();
    ResultList<Team> resultList = listAfter(null, fields, filter, limit, null);
    List<Team> allTeams = resultList.getData();
    List<Team> joinableTeams =
        allTeams.stream()
            .filter(Boolean.TRUE.equals(isJoinable) ? Team::getIsJoinable : t -> true)
            .filter(t -> !t.getName().equals(ORGANIZATION_NAME))
            .collect(Collectors.toList());
    // build hierarchy of joinable teams
    joinableTeams.forEach(
        team -> {
          Team currentTeam = team;
          TeamHierarchy currentHierarchy = getTeamHierarchy(team);
          while (currentTeam != null
              && currentTeam.getParents().size() > 0
              && !currentTeam.getParents().get(0).getName().equals(ORGANIZATION_NAME)) {
            EntityReference parentRef = currentTeam.getParents().get(0);
            Team parent =
                allTeams.stream()
                    .filter(t -> t.getId().equals(parentRef.getId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException(TEAM_HIERARCHY));
            currentHierarchy = getTeamHierarchy(parent).withChildren(new ArrayList<>(List.of(currentHierarchy)));
            if (map.containsKey(parent.getId())) {
              TeamHierarchy parentTeam = map.get(parent.getId());
              currentHierarchy = mergeTrees(parentTeam, currentHierarchy);
              currentTeam =
                  allTeams.stream()
                      .filter(t -> t.getId().equals(parent.getId()))
                      .findFirst()
                      .orElseThrow(() -> new IllegalArgumentException(TEAM_HIERARCHY));
            } else {
              currentTeam = parent;
            }
          }
          UUID currentId = currentHierarchy.getId();
          if (!map.containsKey(currentId)) {
            map.put(currentId, currentHierarchy);
          } else {
            map.put(currentId, mergeTrees(map.get(currentId), currentHierarchy));
          }
        });
    return new ArrayList<>(map.values());
  }

  private List<EntityReference> getUsers(Team team) throws IOException {
    List<EntityRelationshipRecord> userIds = findTo(team.getId(), TEAM, Relationship.HAS, Entity.USER);
    return EntityUtil.populateEntityReferences(userIds, Entity.USER);
  }

  private List<EntityRelationshipRecord> getUsersRelationshipRecords(UUID teamId) throws IOException {
    List<EntityRelationshipRecord> userRecord = findTo(teamId, TEAM, Relationship.HAS, Entity.USER);
    List<EntityReference> children = getChildren(teamId);
    for (EntityReference child : children) {
      userRecord.addAll(getUsersRelationshipRecords(child.getId()));
    }
    return userRecord;
  }

  private Integer getUserCount(UUID teamId) throws IOException {
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

  private List<EntityReference> getOwns(Team team) throws IOException {
    // Compile entities owned by the team
    return EntityUtil.getEntityReferences(
        daoCollection.relationshipDAO().findTo(team.getId().toString(), TEAM, Relationship.OWNS.ordinal()));
  }

  private List<EntityReference> getDefaultRoles(Team team) throws IOException {
    List<EntityRelationshipRecord> defaultRoleIds = findTo(team.getId(), TEAM, Relationship.HAS, Entity.ROLE);
    return EntityUtil.populateEntityReferences(defaultRoleIds, Entity.ROLE);
  }

  private List<EntityReference> getParents(Team team) throws IOException {
    List<EntityRelationshipRecord> relationshipRecords = findFrom(team.getId(), TEAM, Relationship.PARENT_OF, TEAM);
    List<EntityReference> parents = EntityUtil.populateEntityReferences(relationshipRecords, TEAM);
    if (organization != null && listOrEmpty(parents).isEmpty() && !team.getId().equals(organization.getId())) {
      return new ArrayList<>(List.of(organization.getEntityReference()));
    }
    return parents;
  }

  private List<EntityReference> getParentsForInheritedRoles(Team team) throws IOException {
    List<EntityRelationshipRecord> relationshipRecords = findFrom(team.getId(), TEAM, Relationship.PARENT_OF, TEAM);
    // filter out any deleted teams
    List<EntityReference> parents =
        EntityUtil.populateEntityReferences(relationshipRecords, TEAM).stream()
            .filter(e -> !e.getDeleted())
            .collect(Collectors.toList());
    if (organization != null && listOrEmpty(parents).isEmpty() && !team.getId().equals(organization.getId())) {
      return new ArrayList<>(List.of(organization.getEntityReference()));
    }
    return parents;
  }

  private List<EntityReference> getChildren(UUID teamId) throws IOException {
    if (teamId.equals(organization.getId())) { // For organization all the parentless teams are children
      List<String> children = daoCollection.teamDAO().listTeamsUnderOrganization(teamId.toString());
      return EntityUtil.populateEntityReferencesById(EntityUtil.toIDs(children), Entity.TEAM);
    }
    List<EntityRelationshipRecord> children = findTo(teamId, TEAM, Relationship.PARENT_OF, TEAM);
    return EntityUtil.populateEntityReferences(children, TEAM);
  }

  private Integer getChildrenCount(Team team) throws IOException {
    return getChildren(team.getId()).size();
  }

  private List<EntityReference> getPolicies(Team team) throws IOException {
    List<EntityRelationshipRecord> policies = findTo(team.getId(), TEAM, Relationship.HAS, POLICY);
    return EntityUtil.populateEntityReferences(policies, POLICY);
  }

  private void populateChildren(Team team) throws IOException {
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
      case BUSINESS_UNIT:
      case ORGANIZATION:
        validateChildren(team, children, BUSINESS_UNIT, DIVISION, DEPARTMENT, GROUP);
        break;
    }
    populateTeamRefs(childrenRefs, children);
  }

  private void populateParents(Team team) throws IOException {
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
      case GROUP:
      case DEPARTMENT:
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

  private List<Team> getTeams(List<EntityReference> teamRefs) throws IOException {
    List<Team> teams = new ArrayList<>();
    for (EntityReference teamRef : teamRefs) {
      try {
        Team team = dao.findEntityById(teamRef.getId());
        teams.add(team);
      } catch (EntityNotFoundException ex) {
        // Team was soft-deleted
        LOG.debug("Failed to populate team since it might be soft deleted.", ex);
        // Ensure that the team was soft-deleted otherwise throw an exception
        dao.findEntityById(teamRef.getId(), Include.DELETED);
      }
    }
    return teams;
  }

  // Validate if the team can have given type of parents
  private void validateParents(Team team, List<Team> relatedTeams, TeamType... allowedTeamTypes) {
    List<TeamType> allowed = Arrays.asList(allowedTeamTypes);
    for (Team relatedTeam : relatedTeams) {
      if (!allowed.contains(relatedTeam.getTeamType())) {
        throw new IllegalArgumentException(invalidParent(relatedTeam, team.getName(), team.getTeamType()));
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

  public void initOrganization() throws IOException {
    String json = dao.findJsonByFqn(ORGANIZATION_NAME, Include.ALL);
    if (json == null) {
      LOG.debug("Organization {} is not initialized", ORGANIZATION_NAME);
      // Teams
      try {
        EntityReference organizationPolicy = Entity.getEntityReferenceByName(POLICY, "OrganizationPolicy", Include.ALL);
        EntityReference dataConsumerRole = Entity.getEntityReferenceByName(ROLE, "DataConsumer", Include.ALL);
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
        LOG.info("Organization {}:{} is successfully initialized", ORGANIZATION_NAME, organization.getId());
      } catch (Exception e) {
        LOG.error("Failed to initialize organization", e);
        throw e;
      }
    } else {
      organization = JsonUtils.readValue(json, Team.class);
      LOG.info("Organization is already initialized");
    }
  }

  public static class TeamCsv extends EntityCsv<Team> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(TEAM);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();
    private final Team team;

    TeamCsv(Team team, String updatedBy) {
      super(Entity.TEAM, HEADERS, updatedBy);
      this.team = team;
    }

    @Override
    protected Team toEntity(CSVPrinter printer, CSVRecord record) throws IOException {
      // Field 1, 2, 3, 4, 7 - name, displayName, description, teamType, isJoinable
      Team importedTeam =
          new Team()
              .withName(record.get(0))
              .withDisplayName(record.get(1))
              .withDescription(record.get(2))
              .withTeamType(TeamType.fromValue(record.get(3)))
              .withIsJoinable(getBoolean(printer, record, 6));

      // Field 5 - parent teams
      getParents(printer, record, importedTeam);
      if (!processRecord) {
        return null;
      }

      // Field 6 - Owner
      importedTeam.setOwner(getEntityReference(printer, record, 5, Entity.USER));
      if (!processRecord) {
        return null;
      }

      // Field 8 - defaultRoles
      importedTeam.setDefaultRoles(getEntityReferences(printer, record, 7, ROLE));
      if (!processRecord) {
        return null;
      }

      // Field 9 - policies
      importedTeam.setPolicies(getEntityReferences(printer, record, 8, POLICY));
      if (!processRecord) {
        return null;
      }
      return importedTeam;
    }

    @Override
    protected List<String> toRecord(Team entity) {
      List<String> record = new ArrayList<>();
      addField(record, entity.getName());
      addField(record, entity.getDisplayName());
      addField(record, entity.getDescription());
      addField(record, entity.getTeamType().value());
      addEntityReferences(record, entity.getParents());
      CsvUtil.addEntityReference(record, entity.getOwner());
      addField(record, entity.getIsJoinable());
      addEntityReferences(record, entity.getDefaultRoles());
      addEntityReferences(record, entity.getPolicies());
      return record;
    }

    private void getParents(CSVPrinter printer, CSVRecord record, Team importedTeam) throws IOException {
      List<EntityReference> parentRefs = getEntityReferences(printer, record, 4, Entity.TEAM);

      // Validate team being created is under the hierarchy of the team for which CSV is being imported to
      for (EntityReference parentRef : listOrEmpty(parentRefs)) {
        if (parentRef.getName().equals(team.getName())) {
          continue; // Parent is same as the team to which CSV is being imported, then it is in the same hierarchy
        }
        if (dryRunCreatedEntities.get(parentRef.getName()) != null) {
          continue; // Parent is being created by CSV import
        }
        // Else the parent should already exist
        if (!SubjectCache.getInstance().isInTeam(team.getName(), listOf(parentRef))) {
          importFailure(printer, invalidTeam(4, team.getName(), importedTeam.getName(), parentRef.getName()), record);
          processRecord = false;
        }
      }
      importedTeam.setParents(parentRefs);
    }

    public static String invalidTeam(int field, String team, String importedTeam, String parentName) {
      String error =
          String.format("Parent %s of imported team %s is not under %s team hierarchy", parentName, importedTeam, team);
      return String.format("#%s: Field %d error - %s", CsvErrorType.INVALID_FIELD, field + 1, error);
    }

    private List<Team> listTeams(TeamRepository repository, String parentTeam, List<Team> teams, Fields fields)
        throws IOException {
      // Export the entire hierarchy of teams
      final ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("parentTeam", parentTeam);
      List<Team> list = repository.listAll(fields, filter);
      if (nullOrEmpty(list)) {
        return teams;
      }
      teams.addAll(list);
      for (Team team : list) {
        listTeams(repository, team.getName(), teams, fields);
      }
      return teams;
    }

    public String exportCsv() throws IOException {
      TeamRepository repository = (TeamRepository) Entity.getEntityRepository(TEAM);
      final Fields fields = repository.getFields("owner,defaultRoles,parents,policies");
      return exportCsv(listTeams(repository, team.getName(), new ArrayList<>(), fields));
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class TeamUpdater extends EntityUpdater {
    public TeamUpdater(Team original, Team updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      if (original.getTeamType() != updated.getTeamType()) {
        // A team of type 'Group' cannot be updated
        if (GROUP.equals(original.getTeamType())) {
          throw new IllegalArgumentException(INVALID_GROUP_TEAM_UPDATE);
        }
        // A team containing children cannot be updated to Group
        if (original.getChildren().size() > 0 && GROUP.equals(updated.getTeamType())) {
          throw new IllegalArgumentException(INVALID_GROUP_TEAM_CHILDREN_UPDATE);
        }
      }
      recordChange("profile", original.getProfile(), updated.getProfile());
      recordChange("isJoinable", original.getIsJoinable(), updated.getIsJoinable());
      recordChange("teamType", original.getTeamType(), updated.getTeamType());
      updateUsers(original, updated);
      updateDefaultRoles(original, updated);
      updateParents(original, updated);
      updateChildren(original, updated);
      updatePolicies(original, updated);
    }

    private void updateUsers(Team origTeam, Team updatedTeam) throws JsonProcessingException {
      List<EntityReference> origUsers = listOrEmpty(origTeam.getUsers());
      List<EntityReference> updatedUsers = listOrEmpty(updatedTeam.getUsers());
      updateToRelationships(
          "users", TEAM, origTeam.getId(), Relationship.HAS, Entity.USER, origUsers, updatedUsers, false);
    }

    private void updateDefaultRoles(Team origTeam, Team updatedTeam) throws JsonProcessingException {
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

    private void updateParents(Team original, Team updated) throws JsonProcessingException {
      List<EntityReference> origParents = listOrEmpty(original.getParents());
      List<EntityReference> updatedParents = listOrEmpty(updated.getParents());
      updateFromRelationships(
          "parents", TEAM, origParents, updatedParents, Relationship.PARENT_OF, TEAM, original.getId());
    }

    private void updateChildren(Team original, Team updated) throws JsonProcessingException {
      List<EntityReference> origParents = listOrEmpty(original.getChildren());
      List<EntityReference> updatedParents = listOrEmpty(updated.getChildren());
      updateToRelationships(
          "children", TEAM, original.getId(), Relationship.PARENT_OF, TEAM, origParents, updatedParents, false);
    }

    private void updatePolicies(Team original, Team updated) throws JsonProcessingException {
      List<EntityReference> origPolicies = listOrEmpty(original.getPolicies());
      List<EntityReference> updatedPolicies = listOrEmpty(updated.getPolicies());
      updateToRelationships(
          "policies", TEAM, original.getId(), Relationship.HAS, POLICY, origPolicies, updatedPolicies, false);
    }
  }
}
