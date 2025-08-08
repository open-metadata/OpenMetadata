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
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.schema.utils.EntityInterfaceUtil.quoteName;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.ROLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.util.EntityUtil.objectMatch;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvErrorType;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.UserDAO;
import org.openmetadata.service.resources.feeds.FeedUtil;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.auth.BotTokenCache;
import org.openmetadata.service.security.auth.UserActivityTracker;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.UserUtil;

@Slf4j
public class UserRepository extends EntityRepository<User> {
  static final String ROLES_FIELD = "roles";
  static final String TEAMS_FIELD = "teams";
  public static final String AUTH_MECHANISM_FIELD = "authenticationMechanism";
  static final String USER_PATCH_FIELDS =
      "profile,roles,teams,authenticationMechanism,isEmailVerified,personas,defaultPersona,domains,personaPreferences";
  static final String USER_UPDATE_FIELDS =
      "profile,roles,teams,authenticationMechanism,isEmailVerified,personas,defaultPersona,domains,personaPreferences";
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

    // Register bulk field fetchers for User-specific fields
    this.fieldFetchers.put("teams", this::fetchAndSetTeams);
    this.fieldFetchers.put("roles", this::fetchAndSetRoles);
    this.fieldFetchers.put("owns", this::fetchAndSetOwns);
    this.fieldFetchers.put("follows", this::fetchAndSetFollows);
    this.fieldFetchers.put("personas", this::fetchAndSetPersonas);
    this.fieldFetchers.put("defaultPersona", this::fetchAndSetDefaultPersona);
    this.fieldFetchers.put("domains", this::fetchAndSetDomains);
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

  private List<EntityReference> getDomains(UUID teamId) {
    // Team does not have domain. 'domains' is the field for user as team can belong to multiple
    // domains
    return findFrom(teamId, USER, Relationship.HAS, Entity.DOMAIN);
  }

  @Override
  protected void storeDomains(User entity, List<EntityReference> exclude) {
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

  public User getByEmail(UriInfo uriInfo, String email, Fields fields) {
    String userString = daoCollection.userDAO().findUserByEmail(email);
    if (userString == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(USER, email));
    }
    User user = JsonUtils.readValue(userString, User.class);
    setFieldsInternal(user, fields);
    setInheritedFields(user, fields);
    // Clone the entity
    User entityClone = JsonUtils.deepCopy(user, User.class);
    clearFieldsInternal(entityClone, fields);
    return withHref(uriInfo, entityClone);
  }

  public User getUserByNameAndEmail(UriInfo uriInfo, String name, String email, Fields fields) {
    String userString = daoCollection.userDAO().findUserByNameAndEmail(name, email);
    if (userString == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(USER, email));
    }
    User user = JsonUtils.readValue(userString, User.class);
    setFieldsInternal(user, fields);
    setInheritedFields(user, fields);
    // Clone the entity
    User entityClone = JsonUtils.deepCopy(user, User.class);
    clearFieldsInternal(entityClone, fields);
    return withHref(uriInfo, entityClone);
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
    EntityReference defaultPersona = user.getDefaultPersona();

    // Don't store roles, teams, defaultPersona and href as JSON. Build it on the fly based on
    // relationships
    user.withRoles(null).withTeams(null).withInheritedRoles(null).withDefaultPersona(null);

    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    if (secretsManager != null && Boolean.TRUE.equals(user.getIsBot())) {
      secretsManager.encryptAuthenticationMechanism(
          user.getName(), user.getAuthenticationMechanism());
    }

    store(user, update);

    // Restore the relationships
    user.withRoles(roles).withTeams(teams).withDefaultPersona(defaultPersona);
  }

  public void updateUserLastLoginTime(User orginalUser, long lastLoginTime) {
    User updatedUser = JsonUtils.deepCopy(orginalUser, User.class);
    JsonPatch patch =
        JsonUtils.getJsonPatch(orginalUser, updatedUser.withLastLoginTime(lastLoginTime));
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    userRepository.patch(null, orginalUser.getId(), orginalUser.getUpdatedBy(), patch);

    // Update lastActivityTime immediately on login for metrics visibility
    // This ensures user metrics show activity right after login
    if (!orginalUser.getIsBot()) {
      // Track in the batch system for ongoing updates
      UserActivityTracker.getInstance().trackActivity(orginalUser.getName());
      // Also update immediately in DB for instant visibility
      updateUserLastActivityTime(orginalUser.getName(), lastLoginTime);
    }
  }

  @Transaction
  public void updateUserLastActivityTime(String userName, long lastActivityTime) {
    // Direct SQL update to minimize DB load - single query
    // Updates only the lastActivityTime field in the JSON using JSON_SET
    // This method is used for immediate updates (e.g., in tests)
    // For production use, UserActivityTracker should be used for batch updates
    String fqn = quoteName(userName.toLowerCase());

    LOG.debug(
        "Updating lastActivityTime for user: {} (fqn: {}) to: {}", userName, fqn, lastActivityTime);

    // Use the custom DAO method for optimized update
    // Note: @BindFQN will automatically hash the fqn, so we don't pre-hash it
    ((UserDAO) daoCollection.userDAO()).updateLastActivityTime(fqn, lastActivityTime);
  }

  @Transaction
  public void updateUsersLastActivityTimeBatch(Map<String, Long> userActivityMap) {
    if (userActivityMap.isEmpty()) {
      return;
    }

    // Bulk update all users' activity times in a single query
    // This is much more efficient than individual updates
    UserDAO userDAO = (UserDAO) daoCollection.userDAO();

    // Build the CASE statement and collect nameHashes
    StringBuilder caseBuilder = new StringBuilder();
    List<String> nameHashes = new ArrayList<>();

    for (Map.Entry<String, Long> entry : userActivityMap.entrySet()) {
      // User FQNs are stored with quoteName applied, so we must match that format
      String fqn = quoteName(entry.getKey().toLowerCase());
      String fqnHash = FullyQualifiedName.buildHash(fqn);

      nameHashes.add(fqnHash);
      caseBuilder
          .append("WHEN '")
          .append(fqnHash)
          .append("' THEN ")
          .append(entry.getValue())
          .append(" ");
    }

    if (!nameHashes.isEmpty()) {
      String caseStatements = caseBuilder.toString();
      userDAO.updateLastActivityTimeBulk(caseStatements, nameHashes);
    }
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
    if (fields.contains(FIELD_DOMAINS)) {
      Set<EntityReference> combinedParent = new TreeSet<>(EntityUtil.compareEntityReferenceById);
      List<EntityReference> teams =
          !fields.contains(TEAMS_FIELD) ? getTeams(user) : user.getTeams();
      if (!nullOrEmpty(teams)) {
        for (EntityReference team : teams) {
          Team parent = Entity.getEntity(TEAM, team.getId(), "domains", ALL);
          combinedParent.addAll(parent.getDomains());
        }
      }
      user.setDomains(
          EntityUtil.mergedInheritedEntityRefs(
              user.getDomains(), combinedParent.stream().toList()));
    }
  }

  @Override
  public EntityRepository<User>.EntityUpdater getUpdater(
      User original, User updated, Operation operation, ChangeSource changeSource) {
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
        fields.contains("defaultPersona") ? getDefaultPersona(user) : user.getDefaultPersona());
    user.withInheritedRoles(
        fields.contains(ROLES_FIELD) ? getInheritedRoles(user) : user.getInheritedRoles());
    user.setDomains(fields.contains("domains") ? getDomains(user.getId()) : user.getDomains());
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
    user.setLastActivityTime(
        fields.contains("lastActivityTime") ? user.getLastActivityTime() : null);
    user.setLastLoginTime(fields.contains("lastLoginTime") ? user.getLastLoginTime() : null);
    user.setPersonas(fields.contains("personas") ? user.getPersonas() : null);
    user.setDefaultPersona(fields.contains("defaultPersona") ? user.getDefaultPersona() : null);
    user.setDomains(fields.contains("domains") ? user.getDomains() : null);
  }

  @Override
  public String exportToCsv(String importingTeam, String user, boolean recursive)
      throws IOException {
    Team team = daoCollection.teamDAO().findEntityByName(importingTeam);
    return new UserCsv(team, user).exportCsv();
  }

  @Override
  public CsvImportResult importFromCsv(
      String importingTeam, String csv, boolean dryRun, String user, boolean recursive)
      throws IOException {
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

  protected void entitySpecificCleanup(User entityInterface) {
    FeedUtil.cleanUpTaskForAssignees(entityInterface.getId(), USER);
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

  public boolean checkUserNameExists(String username) {
    return daoCollection.userDAO().checkUserNameExists(username) > 0;
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

  public List<EntityReference> getGroupTeams(
      UriInfo uriInfo, SecurityContext context, String email) {
    // Cleanup
    User user =
        getLoggedInUserByNameAndEmail(
            uriInfo, context.getUserPrincipal().getName(), email, Fields.EMPTY_FIELDS);
    List<EntityReference> teams = getTeams(user);
    return getGroupTeams(teams);
  }

  public User getLoggedInUserByNameAndEmail(
      UriInfo uriInfo, String username, String email, Fields fields) {
    try {
      return getUserByNameAndEmail(uriInfo, username, email, fields);
    } catch (EntityNotFoundException e) {
      boolean existByName = checkUserNameExists(username);
      boolean existByEmail = checkEmailAlreadyExists(email);
      if (existByName && !existByEmail) {
        User userByName = getByName(uriInfo, username, Fields.EMPTY_FIELDS);
        LOG.error(
            "User with given name exists but is not associated with the provided email. "
                + "Matching User Found By Name [username:email] : [{}:{}], Provided User: [{}:{}]",
            userByName.getName().toLowerCase(),
            userByName.getEmail().toLowerCase(),
            username,
            email);
        throw BadRequestException.of("Account already exists. Please contact administrator.");
      } else if (!existByName && existByEmail) {
        User userByEmail = getByEmail(uriInfo, email, Fields.EMPTY_FIELDS);
        LOG.error(
            "User with given email exists but is not associated with provider username. "
                + "Matching User Found By Email [username:email] : [{}:{}], Provided User: [{}:{}]",
            userByEmail.getName().toLowerCase(),
            userByEmail.getEmail().toLowerCase(),
            username,
            email);
        throw BadRequestException.of("Account already exists. Please contact administrator.");
      } else {
        LOG.error("User with provider name : {} and email : {} not found", username, email);
        throw EntityNotFoundException.byMessage("Cannot find user with provided name and email");
      }
    }
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
    EntityReference userDefaultPersona =
        getFromEntityRef(user.getId(), USER, Relationship.DEFAULTS_TO, Entity.PERSONA, false);
    if (userDefaultPersona != null) {
      return userDefaultPersona;
    }
    PersonaRepository personaRepository =
        (PersonaRepository) Entity.getEntityRepository(Entity.PERSONA);
    Persona systemDefault = personaRepository.getSystemDefaultPersona();
    return systemDefault != null ? systemDefault.getEntityReference() : null;
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

  // Bulk fetch methods for User-specific fields
  private void fetchAndSetTeams(List<User> users, Fields fields) {
    if (!fields.contains(TEAMS_FIELD) || users == null || users.isEmpty()) {
      return;
    }

    List<String> userIds = users.stream().map(User::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> teamRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(userIds, Relationship.HAS.ordinal(), Entity.TEAM, USER);

    Map<UUID, List<EntityReference>> userToTeams = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : teamRecords) {
      UUID userId = UUID.fromString(record.getToId());
      EntityReference teamRef =
          Entity.getEntityReferenceById(
              Entity.TEAM, UUID.fromString(record.getFromId()), Include.ALL);
      userToTeams.computeIfAbsent(userId, k -> new ArrayList<>()).add(teamRef);
    }

    for (User user : users) {
      List<EntityReference> teamRefs = userToTeams.get(user.getId());
      if (teamRefs != null && !teamRefs.isEmpty()) {
        // Filter out deleted teams
        teamRefs =
            teamRefs.stream().filter(team -> !team.getDeleted()).collect(Collectors.toList());
        // If there are teams and more than 1, filter out organization
        if (teamRefs.size() > 1) {
          teamRefs =
              teamRefs.stream()
                  .filter(t -> !t.getId().equals(getOrganization().getId()))
                  .collect(Collectors.toList());
        }
        user.setTeams(teamRefs);
      } else {
        // If no teams, set organization as default
        user.setTeams(new ArrayList<>(List.of(getOrganization())));
      }
    }
  }

  private void fetchAndSetRoles(List<User> users, Fields fields) {
    if (!fields.contains(ROLES_FIELD) || users == null || users.isEmpty()) {
      return;
    }

    List<String> userIds = users.stream().map(User::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> roleRecords =
        daoCollection
            .relationshipDAO()
            .findToBatch(userIds, Relationship.HAS.ordinal(), USER, Entity.ROLE);

    Map<UUID, List<EntityReference>> userToRoles = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : roleRecords) {
      UUID userId = UUID.fromString(record.getFromId());
      EntityReference roleRef =
          Entity.getEntityReferenceById(
              Entity.ROLE, UUID.fromString(record.getToId()), Include.ALL);
      userToRoles.computeIfAbsent(userId, k -> new ArrayList<>()).add(roleRef);
    }

    for (User user : users) {
      List<EntityReference> roleRefs = userToRoles.get(user.getId());
      user.setRoles(roleRefs != null ? roleRefs : new ArrayList<>());
      // Also set inherited roles
      user.withInheritedRoles(getInheritedRoles(user));
    }
  }

  private void fetchAndSetOwns(List<User> users, Fields fields) {
    if (!fields.contains("owns") || users == null || users.isEmpty()) {
      return;
    }

    List<String> userIds = users.stream().map(User::getId).map(UUID::toString).distinct().toList();

    // Get entities owned by users
    List<CollectionDAO.EntityRelationshipObject> ownsRecords =
        daoCollection
            .relationshipDAO()
            .findToBatchAllTypes(userIds, Relationship.OWNS.ordinal(), Include.ALL);

    // Also get entities owned by teams that users belong to
    // First get all teams for all users
    Map<UUID, List<EntityReference>> userTeams = new HashMap<>();
    if (!fields.contains(TEAMS_FIELD)) {
      // If teams weren't already fetched, we need to get them
      List<CollectionDAO.EntityRelationshipObject> teamRecords =
          daoCollection
              .relationshipDAO()
              .findFromBatch(userIds, Relationship.HAS.ordinal(), Entity.TEAM, USER);
      for (CollectionDAO.EntityRelationshipObject record : teamRecords) {
        UUID userId = UUID.fromString(record.getToId());
        EntityReference teamRef =
            Entity.getEntityReferenceById(
                Entity.TEAM, UUID.fromString(record.getFromId()), Include.ALL);
        userTeams.computeIfAbsent(userId, k -> new ArrayList<>()).add(teamRef);
      }
    } else {
      // Use already fetched teams
      for (User user : users) {
        if (user.getTeams() != null) {
          userTeams.put(user.getId(), user.getTeams());
        }
      }
    }

    // Get entities owned by teams
    Set<String> allTeamIds =
        userTeams.values().stream()
            .flatMap(List::stream)
            .map(EntityReference::getId)
            .map(UUID::toString)
            .collect(Collectors.toSet());

    List<CollectionDAO.EntityRelationshipObject> teamOwnsRecords = new ArrayList<>();
    if (!allTeamIds.isEmpty()) {
      teamOwnsRecords =
          daoCollection
              .relationshipDAO()
              .findToBatchAllTypes(
                  new ArrayList<>(allTeamIds), Relationship.OWNS.ordinal(), Include.ALL);
    }

    // Map user to owned entities
    Map<UUID, List<EntityReference>> userToOwns = new HashMap<>();

    // Add directly owned entities
    for (CollectionDAO.EntityRelationshipObject record : ownsRecords) {
      UUID userId = UUID.fromString(record.getFromId());
      try {
        EntityReference ownedRef =
            Entity.getEntityReferenceById(
                record.getToEntity(), UUID.fromString(record.getToId()), Include.ALL);
        userToOwns.computeIfAbsent(userId, k -> new ArrayList<>()).add(ownedRef);
      } catch (Exception e) {
        LOG.warn("Failed to get entity reference for owned entity: {}", record.getToId(), e);
      }
    }

    // Add team-owned entities
    Map<UUID, List<EntityReference>> teamToOwns = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : teamOwnsRecords) {
      UUID teamId = UUID.fromString(record.getFromId());
      try {
        EntityReference ownedRef =
            Entity.getEntityReferenceById(
                record.getToEntity(), UUID.fromString(record.getToId()), Include.ALL);
        teamToOwns.computeIfAbsent(teamId, k -> new ArrayList<>()).add(ownedRef);
      } catch (Exception e) {
        LOG.warn("Failed to get entity reference for team-owned entity: {}", record.getToId(), e);
      }
    }

    // Combine user and team owned entities
    for (User user : users) {
      List<EntityReference> ownedEntities =
          userToOwns.getOrDefault(user.getId(), new ArrayList<>());
      List<EntityReference> teams = userTeams.get(user.getId());
      if (teams != null) {
        for (EntityReference team : teams) {
          List<EntityReference> teamOwned = teamToOwns.get(team.getId());
          if (teamOwned != null) {
            ownedEntities.addAll(teamOwned);
          }
        }
      }
      user.setOwns(ownedEntities);
    }
  }

  private void fetchAndSetFollows(List<User> users, Fields fields) {
    if (!fields.contains("follows") || users == null || users.isEmpty()) {
      return;
    }

    List<String> userIds = users.stream().map(User::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> followsRecords =
        daoCollection
            .relationshipDAO()
            .findToBatchAllTypes(userIds, Relationship.FOLLOWS.ordinal(), Include.ALL);

    Map<UUID, List<EntityReference>> userToFollows = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : followsRecords) {
      UUID userId = UUID.fromString(record.getFromId());
      try {
        EntityReference followedRef =
            Entity.getEntityReferenceById(
                record.getToEntity(), UUID.fromString(record.getToId()), Include.ALL);
        userToFollows.computeIfAbsent(userId, k -> new ArrayList<>()).add(followedRef);
      } catch (Exception e) {
        LOG.warn("Failed to get entity reference for followed entity: {}", record.getToId(), e);
      }
    }

    for (User user : users) {
      List<EntityReference> followsRefs = userToFollows.get(user.getId());
      user.setFollows(followsRefs != null ? followsRefs : new ArrayList<>());
    }
  }

  private void fetchAndSetPersonas(List<User> users, Fields fields) {
    if (!fields.contains("personas") || users == null || users.isEmpty()) {
      return;
    }

    List<String> userIds = users.stream().map(User::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> personaRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(userIds, Relationship.APPLIED_TO.ordinal(), Entity.PERSONA, USER);

    Map<UUID, List<EntityReference>> userToPersonas = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : personaRecords) {
      UUID userId = UUID.fromString(record.getToId());
      EntityReference personaRef =
          Entity.getEntityReferenceById(
              Entity.PERSONA, UUID.fromString(record.getFromId()), Include.ALL);
      userToPersonas.computeIfAbsent(userId, k -> new ArrayList<>()).add(personaRef);
    }

    for (User user : users) {
      List<EntityReference> personaRefs = userToPersonas.get(user.getId());
      user.setPersonas(personaRefs != null ? personaRefs : new ArrayList<>());
    }
  }

  private void fetchAndSetDefaultPersona(List<User> users, Fields fields) {
    if (!fields.contains("defaultPersona") || users == null || users.isEmpty()) {
      return;
    }

    List<String> userIds = users.stream().map(User::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> defaultPersonaRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(userIds, Relationship.DEFAULTS_TO.ordinal(), Entity.PERSONA, USER);

    Map<UUID, EntityReference> userToDefaultPersona = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : defaultPersonaRecords) {
      UUID userId = UUID.fromString(record.getToId());
      EntityReference personaRef =
          Entity.getEntityReferenceById(
              Entity.PERSONA, UUID.fromString(record.getFromId()), Include.ALL);
      userToDefaultPersona.put(userId, personaRef);
    }

    for (User user : users) {
      EntityReference defaultPersonaRef = userToDefaultPersona.get(user.getId());
      user.setDefaultPersona(defaultPersonaRef);
    }
  }

  private void fetchAndSetDomains(List<User> users, Fields fields) {
    if (!fields.contains("domains") || users == null || users.isEmpty()) {
      return;
    }

    List<String> userIds = users.stream().map(User::getId).map(UUID::toString).distinct().toList();

    List<CollectionDAO.EntityRelationshipObject> domainRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(userIds, Relationship.HAS.ordinal(), Entity.DOMAIN, USER);

    Map<UUID, List<EntityReference>> userToDomains = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : domainRecords) {
      UUID userId = UUID.fromString(record.getToId());
      EntityReference domainRef =
          Entity.getEntityReferenceById(
              Entity.DOMAIN, UUID.fromString(record.getFromId()), Include.ALL);
      userToDomains.computeIfAbsent(userId, k -> new ArrayList<>()).add(domainRef);
    }

    for (User user : users) {
      List<EntityReference> domainRefs = userToDomains.get(user.getId());
      user.setDomains(domainRefs != null ? domainRefs : new ArrayList<>());
    }
  }

  public static class UserCsv extends EntityCsv<User> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(USER, false);
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
          UserUtil.getUser(
                  importedBy,
                  new CreateUser()
                      .withName(csvRecord.get(0))
                      .withDisplayName(csvRecord.get(1))
                      .withDescription(csvRecord.get(2))
                      .withEmail(csvRecord.get(3))
                      .withTimezone(csvRecord.get(4))
                      .withIsAdmin(getBoolean(printer, csvRecord, 5)))
              .withTeams(getTeams(printer, csvRecord, csvRecord.get(0)))
              .withRoles(getEntityReferences(printer, csvRecord, 7, ROLE));
      if (processRecord) {
        createUserEntity(printer, csvRecord, user);
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
      addField(recordList, entity.getTeams().getFirst().getFullyQualifiedName());
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
    // Remove suggestions
    daoCollection.suggestionDAO().deleteByCreatedBy(entity.getId());
  }

  /** Handles entity updated from PUT and POST operation. */
  public class UserUpdater extends EntityUpdater {
    public UserUpdater(User original, User updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      // LowerCase Email
      updated.setEmail(original.getEmail().toLowerCase());
      recordChange(
          "lastLoginTime",
          original.getLastLoginTime(),
          updated.getLastLoginTime(),
          false,
          objectMatch,
          true);

      // Updates
      updateRoles(original, updated);
      updateTeams(original, updated);
      updatePersonas(original, updated);
      updateDefaultPersona(original, updated);
      recordChange("profile", original.getProfile(), updated.getProfile(), true);
      recordChange("timezone", original.getTimezone(), updated.getTimezone());
      recordChange("isBot", original.getIsBot(), updated.getIsBot());
      recordChange("isAdmin", original.getIsAdmin(), updated.getIsAdmin());
      recordChange("isEmailVerified", original.getIsEmailVerified(), updated.getIsEmailVerified());
      updatePersonaPreferences(original, updated);
      updateAuthenticationMechanism(original, updated);
    }

    private void updateRoles(User original, User updated) {
      // Remove roles from original and add roles from updated
      deleteFrom(original.getId(), USER, Relationship.HAS, Entity.ROLE);
      assignRoles(updated, updated.getRoles());

      List<EntityReference> origRoles = listOrEmptyMutable(original.getRoles());
      List<EntityReference> updatedRoles = listOrEmptyMutable(updated.getRoles());

      origRoles.sort(EntityUtil.compareEntityReference);
      updatedRoles.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange(
          ROLES_FIELD, origRoles, updatedRoles, added, deleted, EntityUtil.entityReferenceMatch);
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
      // Skip domains inherited from teams,they are handled in setInheritedFields().
      List<EntityReference> updatedDomains =
          EntityUtil.populateEntityReferences(listOrEmptyMutable(updated.getDomains())).stream()
              .filter(domain -> domain.getInherited() == null || !domain.getInherited())
              .collect(Collectors.toList());
      updated.setDomains(updatedDomains);

      // Remove Domains for the user
      deleteTo(original.getId(), USER, Relationship.HAS, Entity.DOMAIN);

      for (EntityReference domain : updatedDomains) {
        addRelationship(domain.getId(), original.getId(), Entity.DOMAIN, USER, Relationship.HAS);
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

      // Update users and userCount in team search index
      Stream.concat(added.stream(), deleted.stream())
          .forEach(
              teamRef -> {
                EntityInterface team = Entity.getEntity(teamRef, "id,userCount", Include.ALL);
                searchRepository.updateEntityIndex(team);
              });
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

    private void updateDefaultPersona(User original, User updated) {
      // Get the actual default persona from the database (not the system default)
      // The relationship is: persona --DEFAULTS_TO--> user, so we need to find FROM user
      EntityReference originalDefaultPersona =
          getFromEntityRef(original.getId(), USER, Relationship.DEFAULTS_TO, Entity.PERSONA, false);
      if (originalDefaultPersona != null) {
        // Delete the relationship: persona --DEFAULTS_TO--> user
        deleteTo(original.getId(), USER, Relationship.DEFAULTS_TO, Entity.PERSONA);
      }
      assignDefaultPersona(updated, updated.getDefaultPersona());
      recordChange("defaultPersona", originalDefaultPersona, updated.getDefaultPersona(), true);
    }

    private void updatePersonaPreferences(User original, User updated) {
      var updatedPreferences = updated.getPersonaPreferences();

      if (updatedPreferences != null && !updatedPreferences.isEmpty()) {
        var userPersonas = updated.getPersonas();
        if (userPersonas == null || userPersonas.isEmpty()) {
          throw new BadRequestException(
              "User has no personas assigned. Cannot set persona preferences.");
        }
        var assignedPersonaIds =
            userPersonas.stream().map(EntityReference::getId).collect(Collectors.toSet());
        for (var pref : updatedPreferences) {
          if (!assignedPersonaIds.contains(pref.getPersonaId())) {
            throw new BadRequestException(
                "Persona with ID %s is not assigned to this user".formatted(pref.getPersonaId()));
          }
          if (pref.getLandingPageSettings() != null) {
            UserUtil.validateUserPersonaPreferencesImage(pref.getLandingPageSettings());
          }
        }
      }

      recordChange(
          "personaPreferences",
          original.getPersonaPreferences(),
          updated.getPersonaPreferences(),
          true);
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
