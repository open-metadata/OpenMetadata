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
import static org.openmetadata.service.Entity.ROLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvErrorType;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.UserUtil;

@Slf4j
public class UserRepository extends EntityRepository<User> {
  static final String USER_PATCH_FIELDS = "profile,roles,teams,authenticationMechanism,isEmailVerified";
  static final String USER_UPDATE_FIELDS = "profile,roles,teams,authenticationMechanism,isEmailVerified";
  private final EntityReference organization;

  public UserRepository(CollectionDAO dao) {
    super(UserResource.COLLECTION_PATH, USER, User.class, dao.userDAO(), dao, USER_PATCH_FIELDS, USER_UPDATE_FIELDS);
    organization = dao.teamDAO().findEntityReferenceByName(Entity.ORGANIZATION_NAME, Include.ALL);
  }

  public final Fields getFieldsWithUserAuth(String fields) {
    List<String> tempFields = getAllowedFieldsCopy();
    if (fields != null && fields.equals("*")) {
      tempFields.add("authenticationMechanism");
      return new Fields(tempFields, String.join(",", tempFields));
    }
    return new Fields(tempFields, fields);
  }

  /** Ensures that the default roles are added for POST, PUT and PATCH operations. */
  @Override
  public void prepare(User user) throws IOException {
    validateTeams(user);
    validateRoles(user.getRoles());
  }

  @Override
  public void restorePatchAttributes(User original, User updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withId(original.getId())
        .withName(original.getName())
        .withInheritedRoles(original.getInheritedRoles())
        .withAuthenticationMechanism(original.getAuthenticationMechanism());
  }

  private List<EntityReference> getInheritedRoles(User user) throws IOException {
    if (Boolean.TRUE.equals(user.getIsBot())) {
      return null; // No inherited roles for bots
    }
    getTeams(user);
    return SubjectCache.getInstance() != null ? SubjectCache.getInstance().getRolesForTeams(getTeams(user)) : null;
  }

  @Override
  public void storeEntity(User user, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> roles = user.getRoles();
    List<EntityReference> teams = user.getTeams();

    // Don't store roles, teams and href as JSON. Build it on the fly based on relationships
    user.withRoles(null).withTeams(null).withHref(null).withInheritedRoles(null);

    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    if (secretsManager != null && Boolean.TRUE.equals(user.getIsBot())) {
      user.withAuthenticationMechanism(
          secretsManager.encryptOrDecryptAuthenticationMechanism(
              user.getName(), user.getAuthenticationMechanism(), true));
    }

    store(user, update);

    // Restore the relationships
    user.withRoles(roles).withTeams(teams);
  }

  @Override
  public void storeRelationships(User user) throws IOException {
    assignRoles(user, user.getRoles());
    assignTeams(user, user.getTeams());
    user.setInheritedRoles(getInheritedRoles(user));
  }

  @Override
  public UserUpdater getUpdater(User original, User updated, Operation operation) {
    return new UserUpdater(original, updated, operation);
  }

  @Override
  protected void postDelete(User entity) {
    SubjectCache.getInstance().invalidateUser(entity.getName());
  }

  @Override
  public User setFields(User user, Fields fields) throws IOException {
    user.setProfile(fields.contains("profile") ? user.getProfile() : null);
    user.setTeams(fields.contains("teams") ? getTeams(user) : null);
    user.setOwns(fields.contains("owns") ? getOwns(user) : null);
    user.setFollows(fields.contains("follows") ? getFollows(user) : null);
    user.setRoles(fields.contains("roles") ? getRoles(user) : null);
    user.setAuthenticationMechanism(
        fields.contains("authenticationMechanism") ? user.getAuthenticationMechanism() : null);
    user.setIsEmailVerified(fields.contains("isEmailVerified") ? user.getIsEmailVerified() : null);
    return user.withInheritedRoles(fields.contains("roles") ? getInheritedRoles(user) : null);
  }

  @Override
  public String exportToCsv(String importingTeam, String user) throws IOException {
    Team team = daoCollection.teamDAO().findEntityByName(importingTeam);
    return new UserCsv(team, user).exportCsv();
  }

  @Override
  public CsvImportResult importFromCsv(String importingTeam, String csv, boolean dryRun, String user)
      throws IOException {
    Team team = daoCollection.teamDAO().findEntityByName(importingTeam);
    UserCsv userCsv = new UserCsv(team, user);
    return userCsv.importCsv(csv, dryRun);
  }

  public boolean isTeamJoinable(String teamId) throws IOException {
    Team team = daoCollection.teamDAO().findEntityById(UUID.fromString(teamId), Include.NON_DELETED);
    return team.getIsJoinable();
  }

  public void validateTeams(User user) throws IOException {
    List<EntityReference> teams = user.getTeams();
    if (teams != null) {
      for (EntityReference entityReference : teams) {
        EntityReference ref = daoCollection.teamDAO().findEntityReferenceById(entityReference.getId());
        EntityUtil.copy(ref, entityReference);
      }
      teams.sort(EntityUtil.compareEntityReference);
    } else {
      user.setTeams(new ArrayList<>(List.of(organization))); // Organization is a default team
    }
  }

  /* Validate if the user is already part of the given team */
  public void validateTeamAddition(UUID userId, UUID teamId) throws IOException {
    User user = dao.findEntityById(userId);
    List<EntityReference> teams = getTeams(user);
    Optional<EntityReference> team = teams.stream().filter(t -> t.getId().equals(teamId)).findFirst();
    if (team.isPresent()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.userAlreadyPartOfTeam(user.getName(), team.get().getDisplayName()));
    }
  }

  public boolean checkEmailAlreadyExists(String emailId) {
    return daoCollection.userDAO().checkEmailExists(emailId) > 0;
  }

  public void initializeUsers(OpenMetadataApplicationConfig config) {
    Set<String> adminUsers = new HashSet<>(config.getAuthorizerConfiguration().getAdminPrincipals());
    LOG.debug("Checking user entries for admin users {}", adminUsers);
    String domain = SecurityUtil.getDomain(config);
    String providerType = config.getAuthenticationConfiguration().getProvider();
    if (providerType.equals(SSOAuthMechanism.SsoServiceType.BASIC.value())) {
      UserUtil.handleBasicAuth(adminUsers, domain);
    } else {
      UserUtil.addUsers(adminUsers, domain, true);
    }

    LOG.debug("Checking user entries for test users");
    Set<String> testUsers = new HashSet<>(config.getAuthorizerConfiguration().getTestPrincipals());
    UserUtil.addUsers(testUsers, domain, null);
  }

  private List<EntityReference> getOwns(User user) throws IOException {
    // Compile entities owned by the user
    List<EntityRelationshipRecord> ownedEntities =
        daoCollection.relationshipDAO().findTo(user.getId().toString(), USER, Relationship.OWNS.ordinal());

    // Compile entities owned by the team the user belongs to
    List<EntityReference> teams = user.getTeams() == null ? getTeams(user) : user.getTeams();
    for (EntityReference team : teams) {
      ownedEntities.addAll(
          daoCollection.relationshipDAO().findTo(team.getId().toString(), Entity.TEAM, Relationship.OWNS.ordinal()));
    }
    // Populate details in entity reference
    return EntityUtil.getEntityReferences(ownedEntities);
  }

  private List<EntityReference> getFollows(User user) throws IOException {
    return EntityUtil.getEntityReferences(
        daoCollection.relationshipDAO().findTo(user.getId().toString(), USER, Relationship.FOLLOWS.ordinal()));
  }

  private List<EntityReference> getTeamChildren(UUID teamId) throws IOException {
    if (teamId.equals(organization.getId())) { // For organization all the parentless teams are children
      List<String> children = daoCollection.teamDAO().listTeamsUnderOrganization(teamId.toString());
      return EntityUtil.populateEntityReferencesById(EntityUtil.toIDs(children), Entity.TEAM);
    }
    List<EntityRelationshipRecord> children = findTo(teamId, TEAM, Relationship.PARENT_OF, TEAM);
    return EntityUtil.populateEntityReferences(children, TEAM);
  }

  public List<EntityReference> getGroupTeams(UriInfo uriInfo, String userName) throws IOException {
    User user = getByName(uriInfo, userName, Fields.EMPTY_FIELDS, Include.ALL);
    List<EntityReference> teams = getTeams(user);
    return getGroupTeams(teams);
  }

  private List<EntityReference> getGroupTeams(List<EntityReference> teams) throws IOException {
    Set<EntityReference> result = new HashSet<>();
    for (EntityReference t : teams) {
      Team team = Entity.getEntity(t, Fields.EMPTY_FIELDS, Include.ALL);
      if (TeamType.GROUP.equals(team.getTeamType())) {
        result.add(t);
      } else {
        List<EntityReference> children = getTeamChildren(team.getId());
        result.addAll(getGroupTeams(children));
      }
    }
    return new ArrayList<>(result);
  }

  /* Get all the roles that user has been assigned and inherited from the team to User entity */
  private List<EntityReference> getRoles(User user) throws IOException {
    List<EntityRelationshipRecord> roleIds = findTo(user.getId(), USER, Relationship.HAS, Entity.ROLE);
    return EntityUtil.populateEntityReferences(roleIds, Entity.ROLE);
  }

  /* Get all the teams that user belongs to User entity */
  private List<EntityReference> getTeams(User user) throws IOException {
    List<EntityRelationshipRecord> records = findFrom(user.getId(), USER, Relationship.HAS, Entity.TEAM);
    List<EntityReference> teams = EntityUtil.populateEntityReferences(records, Entity.TEAM);
    teams = teams.stream().filter(team -> !team.getDeleted()).collect(Collectors.toList()); // Filter deleted teams
    // If there are no teams that a user belongs to then return organization as the default team
    if (listOrEmpty(teams).isEmpty()) {
      return new ArrayList<>(List.of(organization));
    }
    return teams;
  }

  private void assignRoles(User user, List<EntityReference> roles) {
    roles = listOrEmpty(roles);
    for (EntityReference role : roles) {
      addRelationship(user.getId(), role.getId(), USER, Entity.ROLE, Relationship.HAS);
    }
  }

  private void assignTeams(User user, List<EntityReference> teams) {
    teams = listOrEmpty(teams);
    for (EntityReference team : teams) {
      if (team.getId().equals(organization.getId())) {
        continue; // Default relationship user to organization team is not stored
      }
      addRelationship(team.getId(), user.getId(), Entity.TEAM, USER, Relationship.HAS);
    }
    if (teams.size() > 1) {
      // Remove organization team from the response
      teams = teams.stream().filter(t -> !t.getId().equals(organization.getId())).collect(Collectors.toList());
      user.setTeams(teams);
    }
  }

  public static class UserCsv extends EntityCsv<User> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(USER);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();
    public final Team team;

    UserCsv(Team importingTeam, String updatedBy) {
      super(USER, HEADERS, updatedBy);
      this.team = importingTeam;
    }

    @Override
    protected User toEntity(CSVPrinter printer, CSVRecord record) throws IOException {
      // Field 1, 2, 3, 4, 5, 6 - name, displayName, description, email, timezone, isAdmin
      User user =
          new User()
              .withName(record.get(0))
              .withDisplayName(record.get(1))
              .withDescription(record.get(2))
              .withEmail(record.get(3))
              .withTimezone(record.get(4))
              .withIsAdmin(getBoolean(printer, record, 5));

      // Field 7 - team
      user.setTeams(getTeams(printer, record, user.getName()));
      if (!processRecord) {
        return null;
      }

      // Field 8 - roles
      user.setRoles(getEntityReferences(printer, record, 7, ROLE));
      if (!processRecord) {
        return null;
      }

      // TODO authentication mechanism?
      return user;
    }

    @Override
    protected List<String> toRecord(User entity) {
      // Headers - name,displayName,description,email,timezone,isAdmin,team,roles
      List<String> record = new ArrayList<>();
      addField(record, entity.getName());
      addField(record, entity.getDisplayName());
      addField(record, entity.getDescription());
      addField(record, entity.getEmail());
      addField(record, entity.getTimezone());
      addField(record, entity.getIsAdmin());
      addField(record, entity.getTeams().get(0).getFullyQualifiedName());
      addEntityReferences(record, entity.getRoles());
      return record;
    }

    private List<User> listUsers(
        TeamRepository teamRepository,
        UserRepository userRepository,
        String parentTeam,
        List<User> users,
        Fields fields)
        throws IOException {
      // Export the users by listing users for the entire team hierarchy
      ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("team", parentTeam);

      // Add users for the given team
      List<User> userList = userRepository.listAll(fields, filter);
      if (!nullOrEmpty(userList)) {
        users.addAll(userList);
      }

      filter = new ListFilter(Include.NON_DELETED).addQueryParam("parentTeam", parentTeam);
      List<Team> teamList = teamRepository.listAll(Fields.EMPTY_FIELDS, filter);
      for (Team team : teamList) {
        listUsers(teamRepository, userRepository, team.getName(), users, fields);
      }
      return users;
    }

    public String exportCsv() throws IOException {
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(USER);
      TeamRepository teamRepository = (TeamRepository) Entity.getEntityRepository(TEAM);
      final Fields fields = userRepository.getFields("roles,teams");
      return exportCsv(listUsers(teamRepository, userRepository, team.getName(), new ArrayList<>(), fields));
    }

    private List<EntityReference> getTeams(CSVPrinter printer, CSVRecord record, String user) throws IOException {
      List<EntityReference> teams = getEntityReferences(printer, record, 6, Entity.TEAM);

      // Validate team being created is under the hierarchy of the team for which CSV is being imported to
      for (EntityReference teamRef : listOrEmpty(teams)) {
        if (teamRef.getName().equals(team.getName())) {
          continue; // Team is same as the team to which CSV is being imported, then it is in the same hierarchy
        }
        // Else the parent should already exist
        if (!SubjectCache.getInstance().isInTeam(team.getName(), listOf(teamRef))) {
          importFailure(printer, invalidTeam(6, team.getName(), user, teamRef.getName()), record);
          processRecord = false;
        }
      }
      return teams;
    }

    public static String invalidTeam(int field, String team, String user, String userTeam) {
      String error = String.format("Team %s of user %s is not under %s team hierarchy", userTeam, user, team);
      return String.format("#%s: Field %d error - %s", CsvErrorType.INVALID_FIELD, field + 1, error);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class UserUpdater extends EntityUpdater {
    public UserUpdater(User original, User updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateRoles(original, updated);
      updateTeams(original, updated);
      recordChange("profile", original.getProfile(), updated.getProfile(), true);
      recordChange("timezone", original.getTimezone(), updated.getTimezone());
      recordChange("isBot", original.getIsBot(), updated.getIsBot());
      recordChange("isAdmin", original.getIsAdmin(), updated.getIsAdmin());
      recordChange("email", original.getEmail(), updated.getEmail());
      recordChange("isEmailVerified", original.getIsEmailVerified(), updated.getIsEmailVerified());
      updateAuthenticationMechanism(original, updated);
    }

    private void updateRoles(User original, User updated) throws IOException {
      // Remove roles from original and add roles from updated
      deleteFrom(original.getId(), USER, Relationship.HAS, Entity.ROLE);
      assignRoles(updated, updated.getRoles());

      List<EntityReference> origRoles = listOrEmpty(original.getRoles());
      List<EntityReference> updatedRoles = listOrEmpty(updated.getRoles());

      origRoles.sort(EntityUtil.compareEntityReference);
      updatedRoles.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("roles", origRoles, updatedRoles, added, deleted, EntityUtil.entityReferenceMatch);
    }

    private void updateTeams(User original, User updated) throws IOException {
      // Remove teams from original and add teams from updated
      deleteTo(original.getId(), USER, Relationship.HAS, Entity.TEAM);
      assignTeams(updated, updated.getTeams());

      List<EntityReference> origTeams = listOrEmpty(original.getTeams());
      List<EntityReference> updatedTeams = listOrEmpty(updated.getTeams());

      origTeams.sort(EntityUtil.compareEntityReference);
      updatedTeams.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("teams", origTeams, updatedTeams, added, deleted, EntityUtil.entityReferenceMatch);
    }

    private void updateAuthenticationMechanism(User original, User updated) throws IOException {
      AuthenticationMechanism origAuthMechanism = original.getAuthenticationMechanism();
      AuthenticationMechanism updatedAuthMechanism = updated.getAuthenticationMechanism();
      if (origAuthMechanism == null && updatedAuthMechanism != null) {
        recordChange("authenticationMechanism", original.getAuthenticationMechanism(), "new-encrypted-value");
      } else if (origAuthMechanism != null
          && updatedAuthMechanism != null
          && !JsonUtils.areEquals(origAuthMechanism, updatedAuthMechanism)) {
        recordChange("authenticationMechanism", "old-encrypted-value", "new-encrypted-value");
      }
    }
  }
}
