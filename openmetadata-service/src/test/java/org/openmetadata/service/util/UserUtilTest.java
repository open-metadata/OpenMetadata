package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.ADMIN_ROLE;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import at.favre.lib.crypto.bcrypt.BCrypt;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.LandingPageSettings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.UserCreationException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.read.EntityLookupTestContext;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityCreationFixture;
import org.openmetadata.service.entity.write.EntityPatchFixture;
import org.openmetadata.service.entity.write.EntityPatchService;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.email.EmailUtil;

class UserUtilTest {
  @RegisterExtension private final EntityLookupTestContext lookups = new EntityLookupTestContext();

  @Test
  void updateUserWithHashedPwdStoresBCryptPassword() {
    User user = new User();

    UserUtil.updateUserWithHashedPwd(user, "Sup3rSecret!");

    assertNotNull(user.getAuthenticationMechanism());
    assertEquals(
        AuthenticationMechanism.AuthType.BASIC, user.getAuthenticationMechanism().getAuthType());
    String hashedPassword =
        JsonUtils.convertValue(
                user.getAuthenticationMechanism().getConfig(),
                org.openmetadata.schema.auth.BasicAuthMechanism.class)
            .getPassword();
    assertTrue(BCrypt.verifyer().verify("Sup3rSecret!".toCharArray(), hashedPassword).verified);
  }

  @Test
  void addUsersContinuesAfterBootstrapFailureAndUsesGeneratedPasswords() {
    SmtpSettings smtpSettings = new SmtpSettings().withEnableSmtpServer(true);
    SystemRepository systemRepository = mock(SystemRepository.class);

    when(systemRepository.getEmailConfigInternal()).thenReturn(null);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getSystemRepository).thenReturn(systemRepository);
      try (MockedStatic<UserUtil> mockedUserUtil = mockStatic(UserUtil.class, CALLS_REAL_METHODS);
          MockedStatic<EmailUtil> mockedEmailUtil = mockStatic(EmailUtil.class);
          MockedStatic<PasswordUtil> mockedPasswordUtil = mockStatic(PasswordUtil.class)) {
        mockedEmailUtil.when(EmailUtil::getSmtpSettings).thenReturn(smtpSettings);
        mockedPasswordUtil.when(PasswordUtil::generateRandomPassword).thenReturn("generated-pass");
        mockedUserUtil
            .when(
                () ->
                    UserUtil.createOrUpdateUser(
                        AuthProvider.BASIC, "broken", "secret", "example.com", true))
            .thenThrow(new RuntimeException("boom"));
        mockedUserUtil
            .when(
                () ->
                    UserUtil.createOrUpdateUser(
                        AuthProvider.BASIC, "generated", "generated-pass", "example.com", true))
            .thenAnswer(invocation -> null);

        UserUtil.addUsers(
            AuthProvider.BASIC,
            new LinkedHashSet<>(List.of("broken:secret", "generated")),
            "example.com",
            true);

        mockedUserUtil.verify(
            () ->
                UserUtil.createOrUpdateUser(
                    AuthProvider.BASIC, "broken", "secret", "example.com", true));
        mockedUserUtil.verify(
            () ->
                UserUtil.createOrUpdateUser(
                    AuthProvider.BASIC, "generated", "generated-pass", "example.com", true));
        mockedEmailUtil.verify(EmailUtil::testConnection);
        mockedPasswordUtil.verify(PasswordUtil::generateRandomPassword);
      }
    }
  }

  @Test
  void createOrUpdateUserPromotesExistingRegularUserAndAddsMissingBasicAuth() {
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    EntityDAO<User> userRows = lookups.attach(userRepository, Entity.USER, User.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
    SystemRepository systemRepository = mock(SystemRepository.class);
    User existingUser =
        new User()
            .withId(UUID.randomUUID())
            .withName("alice")
            .withFullyQualifiedName("alice")
            .withIsBot(false)
            .withIsAdmin(false)
            .withUpdatedAt(1234L)
            .withVersion(1.0);

    when(userRepository.getPatchFields()).thenReturn(patchFields());
    when(userRepository.getByName(any(), eq("alice"), any(Fields.class))).thenReturn(existingUser);
    when(userRows.findEntityByName("alice", NON_DELETED)).thenReturn(existingUser);
    creations.onUpsert(
        request -> {
          assertEquals(existingUser, request.entity());
          return userWriteResponse(request, Response.Status.OK, EventType.ENTITY_UPDATED);
        });
    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    when(systemRepository.getEmailConfigInternal()).thenReturn(null);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedEntity.when(Entity::getSystemRepository).thenReturn(systemRepository);
      try (MockedStatic<EmailUtil> mockedEmailUtil = mockStatic(EmailUtil.class)) {
        UserUtil.createOrUpdateUser(AuthProvider.BASIC, "alice", "Secret123!", "example.com", true);

        assertTrue(existingUser.getIsAdmin());
        assertEquals("alice@example.com", existingUser.getEmail());
        assertNotNull(existingUser.getAuthenticationMechanism());
        assertEquals(
            AuthenticationMechanism.AuthType.BASIC,
            existingUser.getAuthenticationMechanism().getAuthType());
        mockedEmailUtil.verify(() -> EmailUtil.sendInviteMailToAdmin(existingUser, "Secret123!"));
        verify(changeEventDAO).insert(any());
      }
    }
  }

  @Test
  void createOrUpdateUserCreatesMissingBasicAdminUser() {
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    EntityDAO<User> userRows = lookups.attach(userRepository, Entity.USER, User.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
    SystemRepository systemRepository = mock(SystemRepository.class);

    when(userRepository.getPatchFields()).thenReturn(patchFields());
    when(userRepository.getByName(any(), eq("bob"), any(Fields.class)))
        .thenThrow(new EntityNotFoundException("user"));
    when(userRows.findEntityByName("bob", NON_DELETED)).thenReturn(null);
    creations.onUpsert(
        request -> userWriteResponse(request, Response.Status.CREATED, EventType.ENTITY_CREATED));
    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    when(systemRepository.getEmailConfigInternal()).thenReturn(null);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedEntity.when(Entity::getSystemRepository).thenReturn(systemRepository);
      try (MockedStatic<EmailUtil> mockedEmailUtil = mockStatic(EmailUtil.class)) {
        UserUtil.createOrUpdateUser(AuthProvider.BASIC, "bob", "TempPass1!", "example.com", true);

        assertEquals(1, creations.upserts().size());
        User createdUser = creations.upserts().getFirst().entity();
        assertEquals("bob", createdUser.getName());
        assertEquals("bob@example.com", createdUser.getEmail());
        assertTrue(createdUser.getIsAdmin());
        assertTrue(createdUser.getIsEmailVerified());
        assertEquals(
            AuthenticationMechanism.AuthType.BASIC,
            createdUser.getAuthenticationMechanism().getAuthType());
        mockedEmailUtil.verify(() -> EmailUtil.sendInviteMailToAdmin(createdUser, "TempPass1!"));
      }
    }
  }

  @Test
  void createOrUpdateUserSkipsConfiguredBotUsers() {
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    User botUser =
        new User()
            .withId(UUID.randomUUID())
            .withName("ingestion-bot")
            .withFullyQualifiedName("ingestion-bot")
            .withIsBot(true)
            .withIsAdmin(false);

    when(userRepository.getPatchFields()).thenReturn(patchFields());
    when(userRepository.getByName(any(), eq("ingestion-bot"), any(Fields.class)))
        .thenReturn(botUser);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<EmailUtil> mockedEmailUtil = mockStatic(EmailUtil.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);

      UserUtil.createOrUpdateUser(
          AuthProvider.BASIC, "ingestion-bot", "ignored", "example.com", true);

      assertTrue(creations.upserts().isEmpty());
      mockedEmailUtil.verifyNoInteractions();
    }
  }

  @Test
  void addOrUpdateUserCreatesUpdateChangeEventWithDomainsAndPreviousVersion() {
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    EntityDAO<User> userRows = lookups.attach(userRepository, Entity.USER, User.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
    UUID domainId = UUID.randomUUID();
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("alice")
            .withFullyQualifiedName("alice")
            .withUpdatedAt(1234L)
            .withVersion(2.0)
            .withDomains(List.of(new EntityReference().withId(domainId).withType(Entity.DOMAIN)))
            .withChangeDescription(new ChangeDescription().withPreviousVersion(1.0));

    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    when(userRows.findEntityByName("alice", NON_DELETED)).thenReturn(user);
    creations.onUpsert(
        request -> {
          assertEquals(user, request.entity());
          return userWriteResponse(request, Response.Status.OK, EventType.ENTITY_UPDATED);
        });

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      User returnedUser = UserUtil.addOrUpdateUser(user);

      assertEquals(user, returnedUser);
      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(changeEventDAO).insert(jsonCaptor.capture());
      ChangeEvent changeEvent = JsonUtils.readValue(jsonCaptor.getValue(), ChangeEvent.class);
      assertEquals(EventType.ENTITY_UPDATED, changeEvent.getEventType());
      assertEquals(1.0, changeEvent.getPreviousVersion());
      assertEquals(List.of(domainId), changeEvent.getDomains());
      assertNotNull(changeEvent.getChangeDescription());
    }
  }

  @Test
  void addOrUpdateUserReturnsUserWhenChangeEventInsertFails() {
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    EntityDAO<User> userRows = lookups.attach(userRepository, Entity.USER, User.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("alice")
            .withFullyQualifiedName("alice")
            .withUpdatedAt(1234L)
            .withVersion(1.0);

    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    doThrow(new RuntimeException("change-event down")).when(changeEventDAO).insert(any());
    when(userRows.findEntityByName("alice", NON_DELETED)).thenReturn(null);
    creations.onUpsert(
        request -> {
          assertEquals(user, request.entity());
          return userWriteResponse(request, Response.Status.CREATED, EventType.ENTITY_CREATED);
        });

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      assertEquals(user, UserUtil.addOrUpdateUser(user));
    }
  }

  @Test
  void addOrUpdateBotUserReusesExistingAuthenticationMechanism() {
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    EntityDAO<User> userRows = lookups.attach(userRepository, Entity.USER, User.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
    AuthenticationMechanism existingMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTToken("existing-token"));
    User originalUser =
        new User()
            .withId(UUID.randomUUID())
            .withName("bot-user")
            .withFullyQualifiedName("bot-user")
            .withAuthenticationMechanism(existingMechanism);
    User botUser =
        new User()
            .withId(UUID.randomUUID())
            .withName("bot-user")
            .withFullyQualifiedName("bot-user")
            .withEmail("bot-user@example.com")
            .withIsBot(true);

    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    when(userRepository.getByName(any(), eq("bot-user"), any(Fields.class)))
        .thenReturn(originalUser);
    when(userRows.findEntityByName("bot-user", NON_DELETED)).thenReturn(originalUser);
    creations.onUpsert(
        request -> {
          assertEquals(botUser, request.entity());
          return userWriteResponse(request, Response.Status.OK, EventType.ENTITY_UPDATED);
        });

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      User returnedUser = UserUtil.addOrUpdateBotUser(botUser);

      assertEquals(existingMechanism, returnedUser.getAuthenticationMechanism());
    }
  }

  @Test
  void addOrUpdateBotUserGeneratesJwtWhenBotDoesNotExist() {
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    EntityDAO<User> userRows = lookups.attach(userRepository, Entity.USER, User.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
    JWTTokenGenerator tokenGenerator = mock(JWTTokenGenerator.class);
    JWTAuthMechanism jwtAuthMechanism =
        new JWTAuthMechanism()
            .withJWTToken("generated-token")
            .withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    User botUser =
        new User()
            .withId(UUID.randomUUID())
            .withName("fresh-bot")
            .withFullyQualifiedName("fresh-bot")
            .withEmail("fresh-bot@example.com")
            .withIsBot(true);

    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    when(userRepository.getByName(any(), eq("fresh-bot"), any(Fields.class)))
        .thenThrow(new EntityNotFoundException("bot"));
    when(userRows.findEntityByName("fresh-bot", NON_DELETED)).thenReturn(null);
    creations.onUpsert(
        request -> {
          assertEquals(botUser, request.entity());
          return userWriteResponse(request, Response.Status.CREATED, EventType.ENTITY_CREATED);
        });
    when(tokenGenerator.generateJWTToken(botUser, JWTTokenExpiry.Unlimited))
        .thenReturn(jwtAuthMechanism);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
        MockedStatic<JWTTokenGenerator> mockedTokenGenerator =
            mockStatic(JWTTokenGenerator.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedTokenGenerator.when(JWTTokenGenerator::getInstance).thenReturn(tokenGenerator);

      User returnedUser = UserUtil.addOrUpdateBotUser(botUser);

      assertEquals(
          AuthenticationMechanism.AuthType.JWT,
          returnedUser.getAuthenticationMechanism().getAuthType());
      assertEquals(
          "generated-token",
          JsonUtils.convertValue(
                  returnedUser.getAuthenticationMechanism().getConfig(), JWTAuthMechanism.class)
              .getJWTToken());
    }
  }

  @Test
  void getRolesFromAuthorizationTokenReturnsContextRoles() {
    CatalogSecurityContext catalogSecurityContext =
        new CatalogSecurityContext(
            () -> "alice", "https", CatalogSecurityContext.OPENID_AUTH, Set.of("DataSteward"));

    assertEquals(
        Set.of("DataSteward"), UserUtil.getRolesFromAuthorizationToken(catalogSecurityContext));
  }

  @Test
  void assignTeamsFromClaimAddsOnlyNewGroupTeams() {
    UUID existingTeamId = UUID.randomUUID();
    UUID analyticsTeamId = UUID.randomUUID();
    User user =
        new User()
            .withName("alice")
            .withTeams(
                List.of(
                    new EntityReference()
                        .withId(existingTeamId)
                        .withType(Entity.TEAM)
                        .withName("existing")));

    Team analyticsTeam =
        new Team()
            .withId(analyticsTeamId)
            .withName("analytics")
            .withTeamType(CreateTeam.TeamType.GROUP);
    Team orgTeam =
        new Team()
            .withId(UUID.randomUUID())
            .withName("platform")
            .withTeamType(CreateTeam.TeamType.ORGANIZATION);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TEAM, "analytics", "id,teamType", NON_DELETED))
          .thenReturn(analyticsTeam);
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TEAM, "platform", "id,teamType", NON_DELETED))
          .thenReturn(orgTeam);
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TEAM, "missing", "id,teamType", NON_DELETED))
          .thenThrow(new EntityNotFoundException("team"));

      boolean changed =
          UserUtil.assignTeamsFromClaim(
              user, List.of("analytics", "platform", "analytics", "missing", ""));

      assertTrue(changed);
      assertEquals(2, user.getTeams().size());
      assertTrue(user.getTeams().stream().anyMatch(team -> existingTeamId.equals(team.getId())));
      assertTrue(user.getTeams().stream().anyMatch(team -> analyticsTeamId.equals(team.getId())));
      assertFalse(user.getTeams().stream().anyMatch(team -> "platform".equals(team.getName())));
    }
  }

  @Test
  void assignTeamsFromClaimReturnsFalseForEmptyOrBrokenClaims() {
    User user = new User().withName("alice");

    assertFalse(UserUtil.assignTeamsFromClaim(user, null));
    assertFalse(UserUtil.assignTeamsFromClaim(user, List.of("", " ")));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TEAM, "broken", "id,teamType", NON_DELETED))
          .thenThrow(new RuntimeException("backend unavailable"));

      assertFalse(UserUtil.assignTeamsFromClaim(user, List.of("broken")));
      assertNull(user.getTeams());
    }
  }

  @Test
  void getRoleListFromUserReturnsRoleNames() {
    User user =
        new User()
            .withRoles(
                List.of(
                    new EntityReference().withName("DataConsumer"),
                    new EntityReference().withName("DataSteward")));

    assertEquals(Set.of("DataConsumer", "DataSteward"), UserUtil.getRoleListFromUser(user));
    assertTrue(UserUtil.getRoleListFromUser(new User()).isEmpty());
  }

  @Test
  void validateAndGetRolesRefSkipsAdminAndMissingRoles() {
    Role dataConsumerRole =
        new Role()
            .withId(UUID.randomUUID())
            .withName("DataConsumer")
            .withFullyQualifiedName("DataConsumer");

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.ROLE, "DataConsumer", "id", NON_DELETED, true))
          .thenReturn(dataConsumerRole);
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.ROLE, "MissingRole", "id", NON_DELETED, true))
          .thenThrow(new EntityNotFoundException("role"));

      List<EntityReference> references =
          UserUtil.validateAndGetRolesRef(Set.of(ADMIN_ROLE, "DataConsumer", "MissingRole"));

      assertEquals(1, references.size());
      assertEquals("DataConsumer", references.get(0).getName());
      assertEquals(dataConsumerRole.getId(), references.get(0).getId());
    }
  }

  @Test
  void isRolesSyncNeededDetectsChangesInEitherDirection() {
    assertFalse(UserUtil.isRolesSyncNeeded(Set.of("A", "B"), Set.of("B", "A")));
    assertTrue(UserUtil.isRolesSyncNeeded(Set.of("A", "B"), Set.of("A")));
    assertTrue(UserUtil.isRolesSyncNeeded(Set.of("A"), Set.of("A", "B")));
  }

  @Test
  void reSyncUserRolesFromTokenHandlesImmutableRoleSetsAndUpdatesUserState() {
    UUID userId = UUID.randomUUID();
    Role dataConsumerRole =
        new Role()
            .withId(UUID.randomUUID())
            .withName("DataConsumer")
            .withFullyQualifiedName("DataConsumer");
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    UriInfo uriInfo = mock(UriInfo.class);
    final var patches = new EntityPatchFixture<User>(request -> null);
    when(userRepository.patches()).thenReturn(patches);

    User user =
        new User()
            .withId(userId)
            .withName("alice")
            .withFullyQualifiedName("alice")
            .withIsAdmin(false)
            .withRoles(List.of(new EntityReference().withName("OldRole")));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.ROLE, "DataConsumer", "id", NON_DELETED, true))
          .thenReturn(dataConsumerRole);

      boolean changed =
          UserUtil.reSyncUserRolesFromToken(uriInfo, user, Set.of(ADMIN_ROLE, "DataConsumer"));

      assertTrue(changed);
      assertTrue(user.getIsAdmin());
      assertEquals(1, user.getRoles().size());
      assertEquals("DataConsumer", user.getRoles().get(0).getName());
      assertEquals(1, patches.requests().size());
      final var request = patches.requests().getFirst();
      assertEquals(new EntityPatchService.Target.Id(userId), request.target());
      assertEquals(new EntityCommandActor("alice", null), request.actor());
      assertEquals(uriInfo, request.uri());
      assertEquals(
          Set.of("roles", "isAdmin", "isBot"), JsonUtils.extractPatchedFields(request.patch()));
    }
  }

  @Test
  void reSyncUserRolesFromTokenSkipsPatchWhenNothingChanges() {
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("alice")
            .withFullyQualifiedName("alice")
            .withIsAdmin(false)
            .withRoles(List.of(new EntityReference().withName("DataConsumer")));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);

      boolean changed = UserUtil.reSyncUserRolesFromToken(null, user, Set.of("DataConsumer"));

      assertFalse(changed);
      verifyNoInteractions(userRepository);
    }
  }

  @Test
  void getUserOrBotFallsBackToBotWhenUserDoesNotExist() {
    EntityReference botReference =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.BOT)
            .withName("ingestion-bot");

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "ingestion-bot", NON_DELETED))
          .thenThrow(new EntityNotFoundException("user"));
      mockedEntity
          .when(() -> Entity.getEntityReferenceByName(Entity.BOT, "ingestion-bot", NON_DELETED))
          .thenReturn(botReference);

      assertEquals(botReference, UserUtil.getUserOrBot("ingestion-bot"));
    }
  }

  @Test
  void getUserNormalizesIdentityFields() {
    UUID teamId = UUID.randomUUID();
    UUID roleId = UUID.randomUUID();
    String domainFqn = "finance";
    EntityReference domainReference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN).withName(domainFqn);
    CreateUser create =
        new CreateUser()
            .withName("Alice")
            .withEmail("Alice@Example.COM")
            .withDisplayName("Alice Example")
            .withIsBot(false)
            .withIsAdmin(true)
            .withTeams(List.of(teamId))
            .withRoles(List.of(roleId))
            .withDomains(List.of(domainFqn));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityReferenceByName(Entity.DOMAIN, domainFqn, NON_DELETED))
          .thenReturn(domainReference);

      User user = UserUtil.getUser("ADMIN", create);

      assertEquals("alice", user.getName());
      assertEquals("alice", user.getFullyQualifiedName());
      assertEquals("alice@example.com", user.getEmail());
      assertEquals("admin", user.getUpdatedBy());
      assertEquals(teamId, user.getTeams().get(0).getId());
      assertEquals(roleId, user.getRoles().get(0).getId());
      assertEquals(domainReference.getId(), user.getDomains().get(0).getId());
    }
  }

  @Test
  void validateUserPersonaPreferencesImageAcceptsHttpsAndRejectsInvalidUrls() {
    LandingPageSettings valid =
        new LandingPageSettings().withHeaderImage("https://cdn.example.com/banner.png");
    UserUtil.validateUserPersonaPreferencesImage(valid);

    BadRequestException schemeError =
        assertThrows(
            BadRequestException.class,
            () ->
                UserUtil.validateUserPersonaPreferencesImage(
                    new LandingPageSettings().withHeaderImage("ftp://cdn.example.com/banner.png")));
    assertTrue(schemeError.getMessage().contains("HTTP or HTTPS"));

    BadRequestException malformedError =
        assertThrows(
            BadRequestException.class,
            () ->
                UserUtil.validateUserPersonaPreferencesImage(
                    new LandingPageSettings().withHeaderImage("not a url")));
    assertTrue(malformedError.getMessage().contains("valid URL"));
  }

  @Test
  void addOrUpdateUserCreatesChangeEventForCreatedUsers() {
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    EntityDAO<User> userRows = lookups.attach(userRepository, Entity.USER, User.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("alice")
            .withFullyQualifiedName("alice")
            .withUpdatedAt(1234L)
            .withVersion(1.0);

    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    when(userRows.findEntityByName("alice", NON_DELETED)).thenReturn(null);
    creations.onUpsert(
        request -> {
          assertEquals(user, request.entity());
          return userWriteResponse(request, Response.Status.CREATED, EventType.ENTITY_CREATED);
        });

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      User returnedUser = UserUtil.addOrUpdateUser(user);

      assertEquals(user, returnedUser);
      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(changeEventDAO).insert(jsonCaptor.capture());
      ChangeEvent changeEvent = JsonUtils.readValue(jsonCaptor.getValue(), ChangeEvent.class);
      assertEquals(EventType.ENTITY_CREATED, changeEvent.getEventType());
      assertEquals(user.getId(), changeEvent.getEntityId());
      assertEquals(user.getName(), changeEvent.getUserName());
    }
  }

  @Test
  void addOrUpdateUserClearsAuthMechanismWhenRepositoryWriteFails() {
    UserRepository userRepository = mock(UserRepository.class);
    final var creations = EntityCreationFixture.attach(userRepository);
    EntityDAO<User> userRows = lookups.attach(userRepository, Entity.USER, User.class);
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("alice")
            .withFullyQualifiedName("alice")
            .withAuthenticationMechanism(new AuthenticationMechanism());

    when(userRows.findEntityByName("alice", NON_DELETED)).thenReturn(null);
    creations.onUpsert(
        request -> {
          assertUserWrite(request);
          throw new RuntimeException("duplicate request");
        });

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);

      UserCreationException exception =
          assertThrows(UserCreationException.class, () -> UserUtil.addOrUpdateUser(user));

      assertTrue(exception.getMessage().contains("duplicate request"));
      assertNull(user.getAuthenticationMechanism());
    }
  }

  private PutResponse<User> userWriteResponse(
      EntityCreationFixture.Upsert<User> request, Response.Status status, EventType event) {
    assertUserWrite(request);
    return new PutResponse<>(status, request.entity(), event);
  }

  private void assertUserWrite(EntityCreationFixture.Upsert<User> request) {
    assertNull(request.uri());
    assertEquals(new EntityCommandActor(ADMIN_USER_NAME, null), request.actor());
    assertFalse(request.importMode());
  }

  private static Fields patchFields() {
    return new Fields(Set.of("description"));
  }
}
