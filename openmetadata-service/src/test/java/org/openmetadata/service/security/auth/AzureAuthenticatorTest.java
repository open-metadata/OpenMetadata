package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.AzureSSOClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.util.EntityUtil.Fields;

class AzureAuthenticatorTest {
  private AzureAuthenticator authenticator;

  @Mock private TeamRepository teamRepository;
  @Mock private RoleRepository roleRepository;
  @Mock private UserRepository userRepository;
  @Mock private OpenMetadataApplicationConfig config;
  @Mock private AuthenticationConfiguration authConfig;
  @Mock private SSOAuthMechanism ssoAuthMechanism;
  @Mock private AzureSSOClientConfig azureConfig;

  // Add private fields for testing
  @Mock private HttpClient mockHttpClient;
  @Mock private HttpResponse<String> mockHttpResponse;
  @Mock private HttpRequest.Builder mockRequestBuilder;
  @Mock private HttpRequest mockRequest;

  private static final String TEST_USER_EMAIL = "test.user@test.com";
  private static final String TEST_USER_NAME = "Test User";
  private static final String TEST_GROUP1 = "TestGroup1";
  private static final String TEST_GROUP2 = "TestGroup2";
  private static final String TEST_ROLE1 = "Data.Steward";
  private static final String TEST_ROLE2 = "Data.Consumer";
  private static final String ACCESS_TOKEN = "test-access-token";
  private static RSAPrivateKey privateKey;

  @BeforeEach
  void setUp() throws NoSuchAlgorithmException, IllegalAccessException, NoSuchFieldException {
    MockitoAnnotations.openMocks(this);

    // Generate RSA key pair for JWT signing
    KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
    keyGen.initialize(2048);
    KeyPair keyPair = keyGen.generateKeyPair();
    privateKey = (RSAPrivateKey) keyPair.getPrivate();

    authenticator = spy(new AzureAuthenticator());

    // Set up authentication configuration
    when(config.getAuthenticationConfiguration()).thenReturn(authConfig);
    when(authConfig.getProvider()).thenReturn(AuthProvider.AZURE);
    when(authConfig.getEnableSelfSignup()).thenReturn(true);
    when(authConfig.getEnableGroupMapping()).thenReturn(true);
    when(authConfig.getEnableRoleMapping()).thenReturn(true);

    // Set up Azure config
    // Use reflection to set private fields
    Field ssoAuthMechanismField =
        AzureAuthenticator.class.getSuperclass().getDeclaredField("ssoAuthMechanism");
    ssoAuthMechanismField.setAccessible(true);
    ssoAuthMechanismField.set(authenticator, ssoAuthMechanism);

    when(ssoAuthMechanism.getAuthConfig()).thenReturn(azureConfig);

    // Set up repository field methods
    Fields userFields = new Fields(Set.of("id", "name", "email", "teams", "roles"));
    Fields teamFields = new Fields(Set.of("id", "name", "parents", "children"));
    Fields roleFields = new Fields(Set.of("id", "name", "users"));

    when(userRepository.getFields(anyString())).thenReturn(userFields);
    when(teamRepository.getFields(anyString())).thenReturn(teamFields);
    when(roleRepository.getFields(anyString())).thenReturn(roleFields);

    // Register repositories
    Entity.registerEntity(User.class, "user", userRepository);
    Entity.registerEntity(Team.class, "team", teamRepository);
    Entity.registerEntity(Role.class, "role", roleRepository);

    authenticator.init(config);

    // Initialize the fields in the authenticator for testing using reflection
    setPrivateField(authenticator, "teamRepository", teamRepository);
    setPrivateField(authenticator, "roleRepository", roleRepository);
    setPrivateField(authenticator, "userRepository", userRepository);
    setPrivateField(authenticator, "isSelfSignUpAvailable", true);
    setPrivateField(authenticator, "isGroupMappingEnabled", false); // Disable by default
    setPrivateField(authenticator, "isRoleMappingEnabled", false); // Disable by default
    setPrivateField(authenticator, "azureConfig", azureConfig);
  }

  /**
   * Helper method to set private fields using reflection
   */
  private void setPrivateField(Object target, String fieldName, Object value, Class<?> clazz)
      throws NoSuchFieldException, IllegalAccessException {
    Field field = clazz.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  /**
   * Helper method to set private fields using reflection with target's class
   */
  private void setPrivateField(Object target, String fieldName, Object value)
      throws NoSuchFieldException, IllegalAccessException {
    setPrivateField(target, fieldName, value, target.getClass());
  }

  @Test
  void testValidateJwtTokenWithEmailClaim()
      throws JOSEException,
          ParseException,
          AuthenticationException,
          NoSuchFieldException,
          IllegalAccessException {
    // Create test user
    User testUser = createTestUser();

    // Mock lookUserInProvider to return the test user
    doReturn(testUser)
        .when(authenticator)
        .lookUserInProvider(eq(TEST_USER_EMAIL), eq(TEST_USER_NAME));

    // Create and sign JWT with email claim
    JWT jwt =
        createTestJWT(
            Map.of(
                "email", TEST_USER_EMAIL,
                "name", TEST_USER_NAME));

    // Validate token
    authenticator.validateGroupAndRoleMapping(jwt, ACCESS_TOKEN);

    // Verify lookUserInProvider was called with email
    verify(authenticator).lookUserInProvider(eq(TEST_USER_EMAIL), eq(TEST_USER_NAME));
  }

  @Test
  void testValidateJwtTokenWithPreferredUsernameClaim()
      throws JOSEException,
          ParseException,
          AuthenticationException,
          NoSuchFieldException,
          IllegalAccessException {
    // Create test user
    User testUser = createTestUser();

    // Mock lookUserInProvider to return the test user
    doReturn(testUser)
        .when(authenticator)
        .lookUserInProvider(eq(TEST_USER_EMAIL), eq(TEST_USER_NAME));

    // Create and sign JWT with preferred_username claim (no email claim)
    JWT jwt =
        createTestJWT(
            Map.of(
                "preferred_username", TEST_USER_EMAIL,
                "name", TEST_USER_NAME));

    // Validate token
    authenticator.validateGroupAndRoleMapping(jwt, ACCESS_TOKEN);

    // Verify lookUserInProvider was called with preferred_username
    verify(authenticator).lookUserInProvider(eq(TEST_USER_EMAIL), eq(TEST_USER_NAME));
  }

  @Test
  void testValidateJwtTokenWithoutEmailClaims() throws JOSEException, ParseException {
    // Create and sign JWT with no email or preferred_username claims
    JWT jwt = createTestJWT(Map.of("name", TEST_USER_NAME));

    // Validation should throw exception
    assertThrows(
        AuthenticationException.class,
        () -> authenticator.validateGroupAndRoleMapping(jwt, ACCESS_TOKEN),
        "Should throw exception when no email identifier is found");
  }

  @Test
  void testLookupUser() throws AuthenticationException {
    // Create test user
    User testUser = createTestUser();

    // Mock user repository to return user when queried by email
    when(userRepository.getByEmail(any(), eq(TEST_USER_EMAIL), any(Fields.class)))
        .thenReturn(testUser);

    // Call lookUserInProvider
    User result = authenticator.lookUserInProvider(TEST_USER_EMAIL, TEST_USER_NAME);

    // Verify result is the expected user
    assertEquals(testUser, result);

    // Verify user repository was called
    verify(userRepository).getByEmail(any(), eq(TEST_USER_EMAIL), any(Fields.class));
  }

  @Test
  void testSyncUserTeamsAddAndRemove() throws Exception {
    // Create a subclass to intercept protected method calls
    AzureAuthenticator testAuthenticator =
        new AzureAuthenticator() {
          @Override
          protected String getAzureGroupName(String groupId, String bearer) throws IOException {
            if ("group1-id".equals(groupId)) return TEST_GROUP1;
            if ("group2-id".equals(groupId)) return TEST_GROUP2;
            return null;
          }

          @Override
          protected List<String> getAzureGroupHierarchyPath(String groupId, String token) {
            if ("group1-id".equals(groupId)) return List.of(TEST_GROUP1);
            if ("group2-id".equals(groupId)) return List.of(TEST_GROUP2);
            return List.of();
          }

          @Override
          protected List<String> getTeamHierarchyPath(Team team) {
            return List.of(team.getName());
          }

          @Override
          protected boolean doHierarchiesMatch(
              List<String> teamHierarchy, List<String> azureHierarchy) {
            return true; // Always match for test
          }
        };

    // Initialize fields directly to avoid reflection issues
    testAuthenticator.init(config);
    Field ssoAuthMechanismField = SSOAuthenticator.class.getDeclaredField("ssoAuthMechanism");
    ssoAuthMechanismField.setAccessible(true);
    ssoAuthMechanismField.set(testAuthenticator, ssoAuthMechanism);

    // Set fields using reflection but with right class
    setPrivateField(testAuthenticator, "isGroupMappingEnabled", true, AzureAuthenticator.class);

    // Get access to syncUserTeams method
    Method syncUserTeamsMethod =
        AzureAuthenticator.class.getDeclaredMethod(
            "syncUserTeams", User.class, List.class, String.class);
    syncUserTeamsMethod.setAccessible(true);

    // Create a test user with one existing team
    User testUser = createTestUser();
    Team existingTeam = new Team().withId(UUID.randomUUID()).withName("ExistingTeam");
    testUser.setTeams(new ArrayList<>(List.of(existingTeam.getEntityReference())));

    // Create new teams that should be added
    Team team1 = new Team().withId(UUID.randomUUID()).withName(TEST_GROUP1);
    team1.setChildren(new ArrayList<>()); // Empty children list makes it a leaf team
    Team team2 = new Team().withId(UUID.randomUUID()).withName(TEST_GROUP2);
    team2.setChildren(new ArrayList<>());

    // Mock team repository responses
    when(teamRepository.getByName(any(), eq(TEST_GROUP1), any(Fields.class))).thenReturn(team1);
    when(teamRepository.getByName(any(), eq(TEST_GROUP2), any(Fields.class))).thenReturn(team2);

    // Set teams repository instance for the test authenticator
    testAuthenticator.teamRepository = teamRepository;
    testAuthenticator.userRepository = userRepository;

    // Scenario 1: Add new team while keeping existing by EXPLICITLY ADDING IT to Azure groups
    // The key is that we need both group1-id AND the existing team to be included
    List<String> azureGroups = List.of("group1-id");

    // We need to mock the group lookup for the existing team too
    when(teamRepository.getByName(any(), eq("ExistingTeam"), any(Fields.class)))
        .thenReturn(existingTeam);

    // Create a custom implementation that preserves both teams
    AzureAuthenticator preserveAuthenticator =
        new AzureAuthenticator() {
          @Override
          protected String getAzureGroupName(String groupId, String bearer) throws IOException {
            if ("group1-id".equals(groupId)) return TEST_GROUP1;
            if ("existing-id".equals(groupId)) return "ExistingTeam";
            return null;
          }

          @Override
          protected List<String> getAzureGroupHierarchyPath(String groupId, String token) {
            return List.of(); // Empty for simplicity
          }

          @Override
          protected boolean doHierarchiesMatch(
              List<String> teamHierarchy, List<String> azureHierarchy) {
            return true; // Always match for test
          }
        };

    // Set up the authenticator
    preserveAuthenticator.teamRepository = teamRepository;
    preserveAuthenticator.userRepository = userRepository;
    setPrivateField(preserveAuthenticator, "isGroupMappingEnabled", true, AzureAuthenticator.class);

    // Now sync with both groups
    syncUserTeamsMethod.invoke(
        preserveAuthenticator, testUser, List.of("group1-id", "existing-id"), ACCESS_TOKEN);

    // Verify user still has existing team plus new team
    assertEquals(2, testUser.getTeams().size(), "User should have 2 teams");

    boolean hasExistingTeam =
        testUser.getTeams().stream().anyMatch(ref -> ref.getId().equals(existingTeam.getId()));
    boolean hasTeam1 =
        testUser.getTeams().stream().anyMatch(ref -> ref.getId().equals(team1.getId()));

    assertTrue(hasExistingTeam, "User should still have existing team");
    assertTrue(hasTeam1, "User should have team1 added");

    // Verify user was updated in repository
    verify(userRepository).createOrUpdate(any(), eq(testUser), eq(testUser.getName()));

    // Scenario 2: Remove team that's not in Azure groups
    reset(userRepository);

    // Now sync with different Azure groups
    syncUserTeamsMethod.invoke(testAuthenticator, testUser, List.of("group2-id"), ACCESS_TOKEN);

    // Verify only team2 remains
    assertEquals(1, testUser.getTeams().size(), "User should have 1 team");
    assertEquals(team2.getId(), testUser.getTeams().get(0).getId(), "User should have team2");

    // Verify user was updated in repository
    verify(userRepository).createOrUpdate(any(), eq(testUser), eq(testUser.getName()));

    // Scenario 3: Remove all teams
    reset(userRepository);

    // Sync with empty Azure groups
    syncUserTeamsMethod.invoke(testAuthenticator, testUser, List.of(), ACCESS_TOKEN);

    // Verify all teams are removed
    assertEquals(0, testUser.getTeams().size(), "User should have no teams");

    // Verify user was updated in repository
    verify(userRepository).createOrUpdate(any(), eq(testUser), eq(testUser.getName()));
  }

  @Test
  void testSyncUserRolesAddAndRemove() throws Exception {
    // Get access to syncUserRoles method
    Method syncUserRolesMethod =
        AzureAuthenticator.class.getDeclaredMethod(
            "syncUserRoles", User.class, List.class, String.class);
    syncUserRolesMethod.setAccessible(true);

    // Create a test user with one existing role
    User testUser = createTestUser();
    Role existingRole = new Role().withId(UUID.randomUUID()).withName("ExistingRole");
    testUser.setRoles(new ArrayList<>(List.of(existingRole.getEntityReference())));

    // Create new roles that should be added
    Role dataStewardRole = new Role().withId(UUID.randomUUID()).withName("Data Steward");
    Role dataConsumerRole = new Role().withId(UUID.randomUUID()).withName("Data Consumer");

    // Mock role repository responses
    when(roleRepository.getByName(any(), eq("Data Steward"), any(Fields.class)))
        .thenReturn(dataStewardRole);
    when(roleRepository.getByName(any(), eq("Data Consumer"), any(Fields.class)))
        .thenReturn(dataConsumerRole);

    // Directly set needed fields
    authenticator.roleRepository = roleRepository;
    authenticator.userRepository = userRepository;
    setPrivateField(authenticator, "isRoleMappingEnabled", true, AzureAuthenticator.class);

    // Scenario 1: Add new role while keeping existing
    List<String> azureRoles = List.of(TEST_ROLE1); // "Data.Steward"
    syncUserRolesMethod.invoke(authenticator, testUser, azureRoles, ACCESS_TOKEN);

    // Verify roles after sync
    assertEquals(
        1,
        testUser.getRoles().size(),
        "User should have 1 role (existing is removed because it's not in Azure roles)");
    assertEquals(
        dataStewardRole.getId(),
        testUser.getRoles().get(0).getId(),
        "User should have Data Steward role");

    // Verify user was updated in repository
    verify(userRepository).createOrUpdate(any(), eq(testUser), eq(testUser.getName()));

    // Reset for next test
    reset(userRepository);

    // Add the existing role back manually for our test
    testUser.setRoles(
        new ArrayList<>(
            List.of(existingRole.getEntityReference(), dataStewardRole.getEntityReference())));

    // Scenario 2: Change to different role
    syncUserRolesMethod.invoke(authenticator, testUser, List.of(TEST_ROLE2), ACCESS_TOKEN);

    // Verify the roles were updated correctly
    assertEquals(1, testUser.getRoles().size(), "User should have 1 role");
    assertEquals(
        dataConsumerRole.getId(),
        testUser.getRoles().get(0).getId(),
        "User should have Data Consumer role");

    // Verify user was updated in repository
    verify(userRepository).createOrUpdate(any(), eq(testUser), eq(testUser.getName()));

    // Scenario 3: Remove all roles
    reset(userRepository);

    // Sync with empty Azure roles
    syncUserRolesMethod.invoke(authenticator, testUser, List.of(), ACCESS_TOKEN);

    // Verify all roles are removed
    assertEquals(0, testUser.getRoles().size(), "User should have no roles");

    // Verify user was updated in repository
    verify(userRepository).createOrUpdate(any(), eq(testUser), eq(testUser.getName()));
  }

  @Test
  void testGroupHierarchyMismatchSkipsTeamAssignment() throws Exception {
    // Custom authenticator subclass to simulate hierarchy mismatch
    AzureAuthenticator testAuthenticator =
        new AzureAuthenticator() {
          @Override
          protected String getAzureGroupName(String groupId, String bearer) {
            return "TeamLeaf";
          }

          @Override
          protected List<String> getAzureGroupHierarchyPath(String groupId, String token) {
            return List.of("Org", "Dev", "Services");
          }

          @Override
          protected List<String> getTeamHierarchyPath(Team team) {
            return List.of("Org", "Engineering", "Backend");
          }

          @Override
          protected boolean isUserInTeam(User user, Team team) {
            return false;
          }
        };

    // Inject dependencies
    setPrivateField(testAuthenticator, "teamRepository", teamRepository, AzureAuthenticator.class);
    setPrivateField(testAuthenticator, "userRepository", userRepository, AzureAuthenticator.class);
    setPrivateField(testAuthenticator, "isGroupMappingEnabled", true, AzureAuthenticator.class);

    // Create user
    User user = createTestUser();
    user.setTeams(new ArrayList<>());

    // Create team with no children (leaf)
    Team team = new Team().withId(UUID.randomUUID()).withName("TeamLeaf");
    team.setParents(
        List.of(
            new EntityReference().withName("Backend"),
            new EntityReference().withName("Engineering"),
            new EntityReference().withName("Org")));
    team.setChildren(new ArrayList<>());

    // Mock
    when(teamRepository.getByName(any(), eq("TeamLeaf"), any(Fields.class))).thenReturn(team);

    // Sync
    Method syncUserTeamsMethod =
        AzureAuthenticator.class.getDeclaredMethod(
            "syncUserTeams", User.class, List.class, String.class);
    syncUserTeamsMethod.setAccessible(true);

    syncUserTeamsMethod.invoke(testAuthenticator, user, List.of("groupId-1"), ACCESS_TOKEN);

    // Team shouldn't be added
    assertEquals(0, user.getTeams().size(), "Team should not be added due to hierarchy mismatch");
  }

  @Test
  void testValidRoleMappingAssignsRolesCorrectly() throws Exception {
    User user = createTestUser();
    user.setRoles(new ArrayList<>());

    Role steward = new Role().withId(UUID.randomUUID()).withName("Data Steward");
    Role engineer = new Role().withId(UUID.randomUUID()).withName("Data Engineer");

    when(roleRepository.getByName(any(), eq("Data Steward"), any(Fields.class)))
        .thenReturn(steward);
    when(roleRepository.getByName(any(), eq("Data Engineer"), any(Fields.class)))
        .thenReturn(engineer);

    setPrivateField(authenticator, "roleRepository", roleRepository, AzureAuthenticator.class);
    setPrivateField(authenticator, "userRepository", userRepository, AzureAuthenticator.class);
    setPrivateField(authenticator, "isRoleMappingEnabled", true, AzureAuthenticator.class);

    Method syncUserRolesMethod =
        AzureAuthenticator.class.getDeclaredMethod(
            "syncUserRoles", User.class, List.class, String.class);
    syncUserRolesMethod.setAccessible(true);

    syncUserRolesMethod.invoke(
        authenticator, user, List.of("Data.Steward", "Data.Engineer"), ACCESS_TOKEN);

    List<String> assignedRoles =
        user.getRoles().stream().map(EntityReference::getName).collect(Collectors.toList());

    assertEquals(2, assignedRoles.size(), "User should have 2 roles assigned");
    assertTrue(assignedRoles.contains("Data Steward"));
    assertTrue(assignedRoles.contains("Data Engineer"));
  }

  private User createTestUser() {
    User user = new User();
    user.setId(UUID.randomUUID());
    user.setEmail(TEST_USER_EMAIL);
    user.setName(TEST_USER_NAME);
    return user;
  }

  private JWT createTestJWT(Map<String, Object> claims) throws JOSEException, ParseException {
    JWTClaimsSet.Builder claimsBuilder =
        new JWTClaimsSet.Builder()
            .issuer("https://login.microsoftonline.com/test-tenant-id/v2.0")
            .subject("subject-123")
            .audience("client-id-123")
            .expirationTime(new Date(System.currentTimeMillis() + 3600 * 1000));

    // Add custom claims
    claims.forEach(claimsBuilder::claim);

    // Build claims
    JWTClaimsSet claimsSet = claimsBuilder.build();

    // Create signed JWT
    SignedJWT signedJWT =
        new SignedJWT(
            new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test-key-id").build(), claimsSet);

    // Sign the JWT
    signedJWT.sign(new RSASSASigner(privateKey));

    return signedJWT;
  }
}
