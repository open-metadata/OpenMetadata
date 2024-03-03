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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addEntityReferences;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.schema.utils.EntityInterfaceUtil.quoteName;
import static org.openmetadata.service.Entity.FIELD_DOMAIN;
import static org.openmetadata.service.Entity.ROLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
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
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvErrorType;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.auth.BotTokenCache;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.UserUtil;

@Slf4j
public class UserRepository extends EntityRepository<User> {
  static final String ROLES_FIELD = "roles";
  static final String TEAMS_FIELD = "teams";
  public static final String AUTH_MECHANISM_FIELD = "authenticationMechanism";
  static final String USER_PATCH_FIELDS =
      "profile,roles,teams,authenticationMechanism,isEmailVerified,personas,defaultPersona";
  static final String USER_UPDATE_FIELDS =
      "profile,roles,teams,authenticationMechanism,isEmailVerified,personas,defaultPersona";
  private volatile EntityReference organization;

  public UserRepository() {
    super(
        UserResource.COLLECTION_PATH,
        USER,
        User.class,
        Entity.getCollectionDAO().userDAO(),
        USER_PATCH_FIELDS,
        USER_UPDATE_FIELDS);
    this.quoteFqn = true;
    supportsSearch = true;
  }

  private EntityReference getOrganization() {
    if (organization == null) {
      organization = Entity.getEntityReferenceByName(TEAM, Entity.ORGANIZATION_NAME, Include.ALL);
    }
    return organization;
  }

  // with the introduction of fqnHash we added case sensitivity to all the entities
  // however usernames , emails cannot be case-sensitive
  @Override
  public void setFullyQualifiedName(User user) {
    user.setFullyQualifiedName(quoteName(user.getName().toLowerCase()));
  }

  public final Fields getFieldsWithUserAuth(String fields) {
    Set<String> tempFields = getAllowedFieldsCopy();
    if (fields != null && fields.equals("*")) {
      tempFields.add(AUTH_MECHANISM_FIELD);
      return new Fields(tempFields);
    }
    return new Fields(tempFields, fields);
  }

  @Override
  public User getByName(UriInfo uriInfo, String name, Fields fields) {
    return super.getByName(uriInfo, EntityInterfaceUtil.quoteName(name), fields);
  }

  public User getByEmail(UriInfo uriInfo, String email, Fields fields) {
    String userString = ((CollectionDAO.UserDAO) dao).findUserByEmail(email);
    if (userString == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(USER, email));
    }
    return withHref(
        uriInfo, setFieldsInternal(JsonUtils.readValue(userString, User.class), fields));
  }

  /** Ensures that the default roles are added for POST, PUT and PATCH operations. */
  @Override
  public void prepare(User user, boolean update) {
    validateTeams(user);
    validateRoles(user.getRoles());
  }

  @Override
  public void restorePatchAttributes(User original, User updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated
        .withInheritedRoles(original.getInheritedRoles())
        .withAuthenticationMechanism(original.getAuthenticationMechanism());
  }

  private List<EntityReference> getInheritedRoles(User user) {
    if (Boolean.TRUE.equals(user.getIsBot())) {
      return Collections.emptyList(); // No inherited roles for bots
    }
    return SubjectContext.getRolesForTeams(getTeams(user));
  }

  @Override
  public void storeEntity(User user, boolean update) {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> roles = user.getRoles();
    List<EntityReference> teams = user.getTeams();

    // Don't store roles, teams and href as JSON. Build it on the fly based on relationships
    user.withRoles(null).withTeams(null).withInheritedRoles(null);

    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    if (secretsManager != null && Boolean.TRUE.equals(user.getIsBot())) {
      secretsManager.encryptAuthenticationMechanism(
          user.getName(), user.getAuthenticationMechanism());
    }

    store(user, update);

    // Restore the relationships
    user.withRoles(roles).withTeams(teams);
  }

  @Override
  public void storeRelationships(User user) {
    assignRoles(user, user.getRoles());
    assignTeams(user, user.getTeams());
    assignDefaultPersona(user, user.getDefaultPersona());
    assignPersonas(user, user.getPersonas());
    user.setInheritedRoles(getInheritedRoles(user));
  }

  @Override
  public void setInheritedFields(User user, Fields fields) {
    // If user does not have domain, then inherit it from parent Team
    // TODO have default team when a user belongs to multiple teams
    if (fields.contains(FIELD_DOMAIN) && user.getDomain() == null) {
      List<EntityReference> teams =
          !fields.contains(TEAMS_FIELD) ? getTeams(user) : user.getTeams();
      if (!nullOrEmpty(teams)) {
        Team team = Entity.getEntity(TEAM, teams.get(0).getId(), "domain", ALL);
        inheritDomain(user, fields, team);
      }
    }
  }

  @Override
  public UserUpdater getUpdater(User original, User updated, Operation operation) {
    return new UserUpdater(original, updated, operation);
  }

  @Override
  public void setFields(User user, Fields fields) {
    user.setTeams(fields.contains(TEAMS_FIELD) ? getTeams(user) : user.getTeams());
    user.setOwns(fields.contains("owns") ? getOwns(user) : user.getOwns());
    user.setFollows(fields.contains("follows") ? getFollows(user) : user.getFollows());
    user.setRoles(fields.contains(ROLES_FIELD) ? getRoles(user) : user.getRoles());
    user.setPersonas(fields.contains("personas") ? getPersonas(user) : user.getPersonas());
    user.setDefaultPersona(
        fields.contains("defaultPersonas") ? getDefaultPersona(user) : user.getDefaultPersona());
    user.withInheritedRoles(
        fields.contains(ROLES_FIELD) ? getInheritedRoles(user) : user.getInheritedRoles());
  }

  @Override
  public void clearFields(User user, Fields fields) {
    user.setProfile(fields.contains("profile") ? user.getProfile() : null);
    user.setTeams(fields.contains(TEAMS_FIELD) ? user.getTeams() : null);
    user.setOwns(fields.contains("owns") ? user.getOwns() : null);
    user.setFollows(fields.contains("follows") ? user.getFollows() : null);
    user.setRoles(fields.contains(ROLES_FIELD) ? user.getRoles() : null);
    user.setAuthenticationMechanism(
        fields.contains(AUTH_MECHANISM_FIELD) ? user.getAuthenticationMechanism() : null);
    user.withInheritedRoles(fields.contains(ROLES_FIELD) ? user.getInheritedRoles() : null);
  }

  @Override
  public String exportToCsv(String importingTeam, String user) throws IOException {
    Team team = daoCollection.teamDAO().findEntityByName(importingTeam);
    return new UserCsv(team, user).exportCsv();
  }

  @Override
  public CsvImportResult importFromCsv(
      String importingTeam, String csv, boolean dryRun, String user) throws IOException {
    Team team = daoCollection.teamDAO().findEntityByName(importingTeam);
    UserCsv userCsv = new UserCsv(team, user);
    return userCsv.importCsv(csv, dryRun);
  }

  public boolean isTeamJoinable(String teamId) {
    Team team =
        daoCollection.teamDAO().findEntityById(UUID.fromString(teamId), Include.NON_DELETED);
    return team.getIsJoinable();
  }

  public void validateTeams(User user) {
    List<EntityReference> teams = user.getTeams();
    if (teams != null) {
      for (EntityReference entityReference : teams) {
        EntityReference ref =
            Entity.getEntityReferenceById(Entity.TEAM, entityReference.getId(), ALL);
        EntityUtil.copy(ref, entityReference);
      }
      teams.sort(EntityUtil.compareEntityReference);
    } else {
      user.setTeams(new ArrayList<>(List.of(getOrganization()))); // Organization is a default team
    }
  }

  /* Validate if the user is already part of the given team */
  public void validateTeamAddition(UUID userId, UUID teamId) {
    User user = find(userId, NON_DELETED);
    List<EntityReference> teams = getTeams(user);
    Optional<EntityReference> team =
        teams.stream().filter(t -> t.getId().equals(teamId)).findFirst();
    if (team.isPresent()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.userAlreadyPartOfTeam(
              user.getName(), team.get().getDisplayName()));
    }
  }

  public boolean checkEmailAlreadyExists(String emailId) {
    return daoCollection.userDAO().checkEmailExists(emailId) > 0;
  }

  public void initializeUsers(OpenMetadataApplicationConfig config) {
    AuthProvider authProvider = config.getAuthenticationConfiguration().getProvider();
    // Create Admins
    Set<String> adminUsers =
        new HashSet<>(config.getAuthorizerConfiguration().getAdminPrincipals());
    String domain = SecurityUtil.getDomain(config);
    UserUtil.addUsers(authProvider, adminUsers, domain, true);

    // Create Test Users
    Set<String> testUsers = new HashSet<>(config.getAuthorizerConfiguration().getTestPrincipals());
    UserUtil.addUsers(authProvider, testUsers, domain, null);
  }

  private List<EntityReference> getOwns(User user) {
    // Compile entities owned by the user
    List<EntityRelationshipRecord> ownedEntities =
        daoCollection.relationshipDAO().findTo(user.getId(), USER, Relationship.OWNS.ordinal());

    // Compile entities owned by the team the user belongs to
    List<EntityReference> teams = user.getTeams() == null ? getTeams(user) : user.getTeams();
    for (EntityReference team : teams) {
      ownedEntities.addAll(
          daoCollection
              .relationshipDAO()
              .findTo(team.getId(), Entity.TEAM, Relationship.OWNS.ordinal()));
    }
    // Populate details in entity reference
    return EntityUtil.getEntityReferences(ownedEntities);
  }

  private List<EntityReference> getFollows(User user) {
    return findTo(user.getId(), USER, Relationship.FOLLOWS, null);
  }

  private List<EntityReference> getTeamChildren(UUID teamId) {
    if (teamId.equals(
        getOrganization().getId())) { // For organization all the parentless teams are children
      List<String> children = daoCollection.teamDAO().listTeamsUnderOrganization(teamId);
      return EntityUtil.populateEntityReferencesById(EntityUtil.strToIds(children), Entity.TEAM);
    }
    return findTo(teamId, TEAM, Relationship.PARENT_OF, TEAM);
  }

  public List<EntityReference> getGroupTeams(UriInfo uriInfo, String userName) {
    // Cleanup
    User user = getByName(uriInfo, userName, Fields.EMPTY_FIELDS, Include.ALL, true);
    List<EntityReference> teams = getTeams(user);
    return getGroupTeams(teams);
  }

  private List<EntityReference> getGroupTeams(List<EntityReference> teams) {
    Set<EntityReference> result = new HashSet<>();
    for (EntityReference t : teams) {
      Team team = Entity.getEntity(t, "", Include.ALL);
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
  private List<EntityReference> getRoles(User user) {
    return findTo(user.getId(), USER, Relationship.HAS, Entity.ROLE);
  }

  /* Get all the teams that user belongs to User entity */
  public List<EntityReference> getTeams(User user) {
    List<EntityReference> teams = findFrom(user.getId(), USER, Relationship.HAS, Entity.TEAM);
    // Filter deleted teams
    teams =
        listOrEmpty(teams).stream().filter(team -> !team.getDeleted()).collect(Collectors.toList());
    // If there are no teams that a user belongs to then return organization as the default team
    if (listOrEmpty(teams).isEmpty()) {
      return new ArrayList<>(List.of(getOrganization()));
    }
    return teams;
  }

  public List<EntityReference> getPersonas(User user) {
    return findFrom(user.getId(), USER, Relationship.APPLIED_TO, Entity.PERSONA);
  }

  public EntityReference getDefaultPersona(User user) {
    return getToEntityRef(user.getId(), Relationship.DEFAULTS_TO, Entity.PERSONA, false);
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
      if (team.getId().equals(getOrganization().getId())) {
        continue; // Default relationship user to organization team is not stored
      }
      addRelationship(team.getId(), user.getId(), Entity.TEAM, USER, Relationship.HAS);
    }
    if (teams.size() > 1) {
      // Remove organization team from the response
      teams =
          teams.stream()
              .filter(t -> !t.getId().equals(getOrganization().getId()))
              .collect(Collectors.toList());
      user.setTeams(teams);
    }
  }

  private void assignPersonas(User user, List<EntityReference> personas) {
    for (EntityReference persona : listOrEmpty(personas)) {
      addRelationship(persona.getId(), user.getId(), Entity.PERSONA, USER, Relationship.APPLIED_TO);
    }
  }

  private void assignDefaultPersona(User user, EntityReference persona) {
    if (persona != null) {
      addRelationship(
          persona.getId(), user.getId(), Entity.PERSONA, USER, Relationship.DEFAULTS_TO);
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
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      // Field 1, 2, 3, 4, 5, 6 - name, displayName, description, email, timezone, isAdmin
      User user =
          new User()
              .withName(csvRecord.get(0))
              .withDisplayName(csvRecord.get(1))
              .withDescription(csvRecord.get(2))
              .withEmail(csvRecord.get(3))
              .withTimezone(csvRecord.get(4))
              .withIsAdmin(getBoolean(printer, csvRecord, 5))
              .withTeams(getTeams(printer, csvRecord, csvRecord.get(0)))
              .withRoles(getEntityReferences(printer, csvRecord, 7, ROLE));
      if (processRecord) {
        createEntity(printer, csvRecord, user);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, User entity) {
      // Headers - name,displayName,description,email,timezone,isAdmin,team,roles
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addField(recordList, entity.getEmail());
      addField(recordList, entity.getTimezone());
      addField(recordList, entity.getIsAdmin());
      addField(recordList, entity.getTeams().get(0).getFullyQualifiedName());
      addEntityReferences(recordList, entity.getRoles());
      addRecord(csvFile, recordList);
    }

    private List<User> listUsers(
        TeamRepository teamRepository,
        UserRepository userRepository,
        String parentTeam,
        List<User> users,
        Fields fields) {
      // Export the users by listing users for the entire team hierarchy
      ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("team", parentTeam);

      // Add users for the given team
      List<User> userList = userRepository.listAll(fields, filter);
      if (!nullOrEmpty(userList)) {
        users.addAll(userList);
      }

      filter = new ListFilter(Include.NON_DELETED).addQueryParam("parentTeam", parentTeam);
      List<Team> teamList = teamRepository.listAll(Fields.EMPTY_FIELDS, filter);
      for (Team teamEntry : teamList) {
        listUsers(teamRepository, userRepository, teamEntry.getName(), users, fields);
      }
      return users;
    }

    public String exportCsv() throws IOException {
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(USER);
      TeamRepository teamRepository = (TeamRepository) Entity.getEntityRepository(TEAM);
      final Fields fields = userRepository.getFields("roles,teams");
      return exportCsv(
          listUsers(teamRepository, userRepository, team.getName(), new ArrayList<>(), fields));
    }

    private List<EntityReference> getTeams(CSVPrinter printer, CSVRecord csvRecord, String user)
        throws IOException {
      List<EntityReference> teams = getEntityReferences(printer, csvRecord, 6, Entity.TEAM);

      // Validate team being created is under the hierarchy of the team for which CSV is being
      // imported to
      for (EntityReference teamRef : listOrEmpty(teams)) {
        if (teamRef.getName().equals(team.getName())) {
          continue; // Team is same as the team to which CSV is being imported, then it is in the
          // same hierarchy
        }
        // Else the parent should already exist
        if (!SubjectContext.isInTeam(team.getName(), teamRef)) {
          importFailure(
              printer, invalidTeam(6, team.getName(), user, teamRef.getName()), csvRecord);
          processRecord = false;
        }
      }
      return teams;
    }

    public static String invalidTeam(int field, String team, String user, String userTeam) {
      String error =
          String.format("Team %s of user %s is not under %s team hierarchy", userTeam, user, team);
      return String.format(
          "#%s: Field %d error - %s", CsvErrorType.INVALID_FIELD, field + 1, error);
    }
  }

  @Override
  protected void postDelete(User entity) {
    // If the User is bot it's token needs to be invalidated
    if (Boolean.TRUE.equals(entity.getIsBot())) {
      BotTokenCache.invalidateToken(entity.getName());
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class UserUpdater extends EntityUpdater {
    public UserUpdater(User original, User updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate() {
      updateRoles(original, updated);
      updateTeams(original, updated);
      updatePersonas(original, updated);
      recordChange(
          "defaultPersona", original.getDefaultPersona(), updated.getDefaultPersona(), true);
      recordChange("profile", original.getProfile(), updated.getProfile(), true);
      recordChange("timezone", original.getTimezone(), updated.getTimezone());
      recordChange("isBot", original.getIsBot(), updated.getIsBot());
      recordChange("isAdmin", original.getIsAdmin(), updated.getIsAdmin());
      recordChange("email", original.getEmail(), updated.getEmail());
      recordChange("isEmailVerified", original.getIsEmailVerified(), updated.getIsEmailVerified());
      updateAuthenticationMechanism(original, updated);
    }

    private void updateRoles(User original, User updated) {
      // Remove roles from original and add roles from updated
      deleteFrom(original.getId(), USER, Relationship.HAS, Entity.ROLE);
      assignRoles(updated, updated.getRoles());

      List<EntityReference> origRoles = listOrEmpty(original.getRoles());
      List<EntityReference> updatedRoles = listOrEmpty(updated.getRoles());

      origRoles.sort(EntityUtil.compareEntityReference);
      updatedRoles.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange(
          ROLES_FIELD, origRoles, updatedRoles, added, deleted, EntityUtil.entityReferenceMatch);
    }

    private void updateTeams(User original, User updated) {
      // Remove teams from original and add teams from updated
      deleteTo(original.getId(), USER, Relationship.HAS, Entity.TEAM);
      assignTeams(updated, updated.getTeams());

      List<EntityReference> origTeams = listOrEmpty(original.getTeams());
      List<EntityReference> updatedTeams = listOrEmpty(updated.getTeams());

      origTeams.sort(EntityUtil.compareEntityReference);
      updatedTeams.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange(
          TEAMS_FIELD, origTeams, updatedTeams, added, deleted, EntityUtil.entityReferenceMatch);
    }

    private void updatePersonas(User original, User updated) {
      deleteTo(original.getId(), USER, Relationship.APPLIED_TO, Entity.PERSONA);
      assignPersonas(updated, updated.getPersonas());

      List<EntityReference> origPersonas = listOrEmpty(original.getPersonas());
      List<EntityReference> updatedPersonas = listOrEmpty(updated.getPersonas());

      origPersonas.sort(EntityUtil.compareEntityReference);
      updatedPersonas.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();

      recordListChange(
          "personas",
          origPersonas,
          updatedPersonas,
          added,
          deleted,
          EntityUtil.entityReferenceMatch);
    }

    private void updateAuthenticationMechanism(User original, User updated) {
      AuthenticationMechanism origAuthMechanism = original.getAuthenticationMechanism();
      AuthenticationMechanism updatedAuthMechanism = updated.getAuthenticationMechanism();
      if (origAuthMechanism == null && updatedAuthMechanism != null) {
        recordChange(
            AUTH_MECHANISM_FIELD, original.getAuthenticationMechanism(), "new-encrypted-value");
      } else if (origAuthMechanism != null
          && updatedAuthMechanism != null
          && !JsonUtils.areEquals(origAuthMechanism, updatedAuthMechanism)) {
        recordChange(AUTH_MECHANISM_FIELD, "old-encrypted-value", "new-encrypted-value");
      }
    }
  }
}
