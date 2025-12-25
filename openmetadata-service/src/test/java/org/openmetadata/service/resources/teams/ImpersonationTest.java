package org.openmetadata.service.resources.teams;

import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.schema.entity.policies.accessControl.Rule.Effect.ALLOW;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.GenerateTokenRequest;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.JwtAuthOpenMetadataApplicationTest;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.TestUtils;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class ImpersonationTest extends JwtAuthOpenMetadataApplicationTest {
  private static final String ADMIN_USER_NAME = "admin";
  private UserRepository userRepository;
  private JWTTokenGenerator jwtTokenGenerator;
  private Map<String, String> adminAuthHeaders;

  @BeforeAll
  @Override
  public void createApplication() throws Exception {
    super.createApplication();
    setupJWT();
  }

  private void setupJWT() {
    userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    jwtTokenGenerator = JWTTokenGenerator.getInstance();

    // Initialize JWT token generator with configuration
    jwtTokenGenerator.init(
        AuthenticationConfiguration.TokenValidationAlgorithm.RS_256,
        APP.getConfiguration().getJwtTokenConfiguration());

    User adminUser =
        userRepository.getByName(
            null, ADMIN_USER_NAME, userRepository.getFields("id,name,email,isAdmin,roles"));

    // Generate JWT token for admin (non-bot user)
    JWTAuthMechanism adminToken =
        jwtTokenGenerator.generateJWTToken(
            adminUser.getName(),
            new java.util.HashSet<>(),
            adminUser.getIsAdmin(),
            adminUser.getEmail(),
            3600, // 1 hour expiry
            false, // isBot = false since admin is not a bot
            org.openmetadata.schema.auth.ServiceTokenType.OM_USER);

    adminAuthHeaders = new HashMap<>();
    adminAuthHeaders.put("Authorization", "Bearer " + adminToken.getJWTToken());
  }

  @Test
  void test_botImpersonation_success() throws Exception {
    // Create impersonation policy - allow impersonation and create policies for testing
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);
    Rule createPolicyRule =
        new Rule()
            .withName("CreatePolicyRule")
            .withResources(listOf("policy"))
            .withOperations(listOf(MetadataOperation.CREATE))
            .withEffect(ALLOW);
    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy")
            .withDescription("Policy to allow impersonation and create policies")
            .withRules(listOf(impersonationRule, createPolicyRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    // Create role with impersonation policy
    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot with JWT auth mechanism
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("impersonation-bot")
            .withEmail("impersonation-bot@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable impersonation on the bot using JSON patch
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    // Create a policy that allows creating policies
    CreatePolicy targetUserPolicyCreate =
        new CreatePolicy()
            .withName("TargetUserPolicy")
            .withDescription("Policy for target user with policy create permission")
            .withRules(
                listOf(
                    new Rule()
                        .withName("allow-policy-create")
                        .withEffect(ALLOW)
                        .withOperations(
                            listOf(MetadataOperation.CREATE, MetadataOperation.VIEW_ALL))
                        .withResources(listOf("policy"))));

    WebTarget policyTarget = getResource("policies");
    Policy targetUserPolicy =
        postWithJWT(policyTarget, targetUserPolicyCreate, Policy.class, adminAuthHeaders);

    // Create a role for the target user with policy create permission
    CreateRole targetUserRoleCreate =
        new CreateRole()
            .withName("TargetUserRole")
            .withDescription("Role for target user")
            .withPolicies(listOf(targetUserPolicy.getFullyQualifiedName()));

    Role targetUserRole =
        postWithJWT(rolesTarget, targetUserRoleCreate, Role.class, adminAuthHeaders);

    CreateUser targetUserCreate =
        new CreateUser()
            .withName("impersonation-target")
            .withEmail("impersonation-target@email.com")
            .withIsBot(false)
            .withRoles(listOf(targetUserRole.getId()));
    User targetUser = postWithJWT(usersTarget, targetUserCreate, User.class, adminAuthHeaders);

    Map<String, String> botAuthHeaders = new HashMap<>();
    botAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    botAuthHeaders.put("X-Impersonate-User", targetUser.getName());

    // Create a policy with impersonation - bot acting as targetUser
    CreatePolicy createPolicy =
        new CreatePolicy()
            .withName("impersonation-test-policy")
            .withDescription("Policy created via impersonation")
            .withRules(
                listOf(
                    new Rule()
                        .withName("test-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    Policy createdPolicy =
        postWithJWT(
            policyTarget,
            createPolicy,
            Policy.class,
            botAuthHeaders,
            Response.Status.CREATED.getStatusCode());

    // Verify the policy was created with impersonatedBy set
    assertNotNull(createdPolicy);
    assertEquals(targetUser.getName(), createdPolicy.getUpdatedBy());
    assertEquals(bot.getName(), createdPolicy.getImpersonatedBy());

    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("users/" + targetUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + targetUserRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + createdPolicy.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_botImpersonation_withoutAllowImpersonationFlag_fails() throws Exception {
    // Create impersonation policy
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule2")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);
    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy2")
            .withDescription("Policy to allow impersonation")
            .withRules(listOf(impersonationRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    // Create role with impersonation policy
    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole2")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot with JWT auth mechanism
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("no-impersonation-bot")
            .withEmail("no-impersonation-bot@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    CreateUser targetUserCreate =
        new CreateUser()
            .withName("impersonation-target-2")
            .withEmail("impersonation-target-2@email.com")
            .withIsBot(false);
    User targetUser = postWithJWT(usersTarget, targetUserCreate, User.class, adminAuthHeaders);

    Map<String, String> botAuthHeaders = new HashMap<>();
    botAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    botAuthHeaders.put("X-Impersonate-User", targetUser.getName());

    // Try to create a policy with impersonation - should fail because bot doesn't have
    // allowImpersonation flag
    CreatePolicy createPolicy =
        new CreatePolicy()
            .withName("impersonation-test-policy-2")
            .withDescription("Policy created via impersonation")
            .withRules(
                listOf(
                    new Rule()
                        .withName("test-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    WebTarget policyTarget = getResource("policies");
    assertResponseContains(
        () -> postWithJWT(policyTarget, createPolicy, Policy.class, botAuthHeaders),
        FORBIDDEN,
        "does not have impersonation enabled");

    deleteWithJWT(getResource("users/" + bot.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("users/" + targetUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonateNonExistentUser_fails() throws Exception {
    // Create impersonation policy
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule3")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);
    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy3")
            .withDescription("Policy to allow impersonation")
            .withRules(listOf(impersonationRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    // Create role with impersonation policy
    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole3")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot with JWT auth mechanism
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("impersonation-bot-2")
            .withEmail("impersonation-bot-2@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable impersonation on the bot using JSON patch
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    Map<String, String> botAuthHeaders = new HashMap<>();
    botAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    botAuthHeaders.put("X-Impersonate-User", "non-existent-user");

    // Try to create a policy with impersonation - should fail because target user doesn't exist
    CreatePolicy createPolicy =
        new CreatePolicy()
            .withName("test-policy-non-existent")
            .withDescription("Policy created via impersonation")
            .withRules(
                listOf(
                    new Rule()
                        .withName("test-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    WebTarget policyTarget = getResource("policies");
    assertResponseContains(
        () -> postWithJWT(policyTarget, createPolicy, Policy.class, botAuthHeaders),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(Entity.USER, "non-existent-user"));

    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_nonBotUser_cannotImpersonate() throws Exception {
    // Create impersonation policy
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule4")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);
    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy4")
            .withDescription("Policy to allow impersonation")
            .withRules(listOf(impersonationRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole4")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create regular (non-bot) user with impersonation role
    CreateUser regularUserCreate =
        new CreateUser()
            .withName("regular-user-impersonator")
            .withEmail("regular-user@email.com")
            .withIsBot(false)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User regularUser = postWithJWT(usersTarget, regularUserCreate, User.class, adminAuthHeaders);

    // Try to impersonate as regular user - should fail
    CreateUser targetUserCreate =
        new CreateUser()
            .withName("impersonation-target-4")
            .withEmail("impersonation-target-4@email.com")
            .withIsBot(false);
    User targetUser = postWithJWT(usersTarget, targetUserCreate, User.class, adminAuthHeaders);

    // Generate token for regular user
    JWTAuthMechanism regularUserToken =
        jwtTokenGenerator.generateJWTToken(
            regularUser.getName(),
            new java.util.HashSet<>(),
            regularUser.getIsAdmin(),
            regularUser.getEmail(),
            3600,
            false,
            org.openmetadata.schema.auth.ServiceTokenType.OM_USER);

    Map<String, String> regularUserAuthHeaders = new HashMap<>();
    regularUserAuthHeaders.put("Authorization", "Bearer " + regularUserToken.getJWTToken());
    regularUserAuthHeaders.put("X-Impersonate-User", targetUser.getName());

    // Try to create a policy with impersonation header - should fail because regular users can't
    // impersonate
    CreatePolicy createPolicy =
        new CreatePolicy()
            .withName("test-policy-regular-user")
            .withDescription("Policy created via impersonation")
            .withRules(
                listOf(
                    new Rule()
                        .withName("test-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    WebTarget policyTarget = getResource("policies");
    assertResponseContains(
        () -> postWithJWT(policyTarget, createPolicy, Policy.class, regularUserAuthHeaders),
        FORBIDDEN,
        "Only bot users can impersonate");

    deleteWithJWT(getResource("users/" + regularUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("users/" + targetUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_botWithoutImpersonatePermission_fails() throws Exception {
    // Create bot WITHOUT impersonation role
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("bot-without-permission")
            .withEmail("bot-without-permission@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism);

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable allowImpersonation flag
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    // Generate token
    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    // Create target user
    CreateUser targetUserCreate =
        new CreateUser()
            .withName("impersonation-target-5")
            .withEmail("impersonation-target-5@email.com")
            .withIsBot(false);
    User targetUser = postWithJWT(usersTarget, targetUserCreate, User.class, adminAuthHeaders);

    Map<String, String> botAuthHeaders = new HashMap<>();
    botAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    botAuthHeaders.put("X-Impersonate-User", targetUser.getName());

    // Try to create a policy with impersonation - should fail because bot doesn't have IMPERSONATE
    // permission
    CreatePolicy createPolicy =
        new CreatePolicy()
            .withName("test-policy-no-permission")
            .withDescription("Policy created via impersonation")
            .withRules(
                listOf(
                    new Rule()
                        .withName("test-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    WebTarget policyTarget = getResource("policies");
    assertResponseContains(
        () -> postWithJWT(policyTarget, createPolicy, Policy.class, botAuthHeaders),
        FORBIDDEN,
        "does not have Impersonate permission");

    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("users/" + targetUser.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonationToken_usedInActualRequest() throws Exception {
    // Create impersonation policy and role
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule6")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);
    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy6")
            .withDescription("Policy to allow impersonation")
            .withRules(listOf(impersonationRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole6")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("impersonation-bot-6")
            .withEmail("impersonation-bot-6@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable allowImpersonation
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    // Generate bot token
    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    // Create target user
    CreateUser targetUserCreate =
        new CreateUser()
            .withName("impersonation-target-6")
            .withEmail("impersonation-target-6@email.com")
            .withIsBot(false);
    User targetUser = postWithJWT(usersTarget, targetUserCreate, User.class, adminAuthHeaders);

    // Use header-based impersonation to make an actual API call
    Map<String, String> impersonationAuthHeaders = new HashMap<>();
    impersonationAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    impersonationAuthHeaders.put("X-Impersonate-User", targetUser.getName());

    // Verify we can fetch user data with impersonation header
    WebTarget getUserTarget = getResource("users/name/" + targetUser.getName());
    User fetchedUser = getWithJWT(getUserTarget, User.class, impersonationAuthHeaders);

    assertNotNull(fetchedUser);
    assertEquals(targetUser.getName(), fetchedUser.getName());
    // Email is masked for non-admin users, so we don't verify it here

    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("users/" + targetUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonation_usesTargetUserPermissions_notBotPermissions() throws Exception {
    // Create policies for bot - one for impersonation, one for creating policies
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule7")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);
    CreatePolicy impersonationPolicy =
        new CreatePolicy()
            .withName("ImpersonationPolicy7")
            .withDescription("Policy to allow impersonation")
            .withRules(listOf(impersonationRule));

    WebTarget policiesTarget = getResource("policies");
    Policy policy1 =
        postWithJWT(policiesTarget, impersonationPolicy, Policy.class, adminAuthHeaders);

    // Policy to allow creating policies
    Rule createPolicyRule =
        new Rule()
            .withName("CreatePolicyRule7")
            .withResources(listOf("policy"))
            .withOperations(listOf(MetadataOperation.CREATE))
            .withEffect(ALLOW);
    CreatePolicy createPolicyPolicy =
        new CreatePolicy()
            .withName("CreatePolicyPolicy7")
            .withDescription("Policy to allow creating policies")
            .withRules(listOf(createPolicyRule));

    Policy policy2 =
        postWithJWT(policiesTarget, createPolicyPolicy, Policy.class, adminAuthHeaders);

    // Create role with both impersonation and create policy permissions
    CreateRole botRole =
        new CreateRole()
            .withName("BotRole7")
            .withDescription("Role with impersonation and policy creation permissions")
            .withPolicies(listOf(policy1.getFullyQualifiedName(), policy2.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role role = postWithJWT(rolesTarget, botRole, Role.class, adminAuthHeaders);

    // Create bot with permissions to create policies and impersonate
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("privileged-bot")
            .withEmail("privileged-bot@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(role.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable allowImpersonation
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    // Generate bot token
    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    Map<String, String> botAuthHeaders = new HashMap<>();
    botAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());

    // Create a regular user with NO admin privileges and NO special permissions
    CreateUser limitedUserCreate =
        new CreateUser()
            .withName("limited-user")
            .withEmail("limited-user@email.com")
            .withIsBot(false)
            .withIsAdmin(false); // Regular user without admin privileges
    User limitedUser = postWithJWT(usersTarget, limitedUserCreate, User.class, adminAuthHeaders);

    // Use header-based impersonation to act as the limited user
    Map<String, String> impersonationAuthHeaders = new HashMap<>();
    impersonationAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    impersonationAuthHeaders.put("X-Impersonate-User", limitedUser.getName());

    // Try to create a policy using impersonation token
    // This should FAIL because the limited user doesn't have permission to create policies
    // Even though the bot has admin privileges
    CreatePolicy testPolicy =
        new CreatePolicy()
            .withName("TestPolicy")
            .withDescription("Test policy creation")
            .withRules(listOf(impersonationRule));

    assertResponseContains(
        () -> postWithJWT(policiesTarget, testPolicy, Policy.class, impersonationAuthHeaders),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='limited-user'} operations [Create] not allowed");

    // Verify the bot itself CAN create policies (has Create policy permission)
    Policy botCreatedPolicy = postWithJWT(policiesTarget, testPolicy, Policy.class, botAuthHeaders);
    assertNotNull(botCreatedPolicy);
    assertEquals("TestPolicy", botCreatedPolicy.getName());

    // Cleanup
    deleteWithJWT(getResource("policies/" + botCreatedPolicy.getId()), adminAuthHeaders);
    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("users/" + limitedUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + role.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + policy1.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + policy2.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonation_auditTrail_showsUpdatedByAndImpersonatedBy() throws Exception {
    // Create impersonation policy
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule8")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);
    CreatePolicy impersonationPolicy =
        new CreatePolicy()
            .withName("ImpersonationPolicy8")
            .withDescription("Policy to allow impersonation")
            .withRules(listOf(impersonationRule));

    WebTarget policiesTarget = getResource("policies");
    Policy policy1 =
        postWithJWT(policiesTarget, impersonationPolicy, Policy.class, adminAuthHeaders);

    // Policy to allow creating tables
    Rule createTableRule =
        new Rule()
            .withName("CreateTableRule8")
            .withResources(listOf("table"))
            .withOperations(listOf(MetadataOperation.CREATE, MetadataOperation.EDIT_ALL))
            .withEffect(ALLOW);
    CreatePolicy createTablePolicy =
        new CreatePolicy()
            .withName("CreateTablePolicy8")
            .withDescription("Policy to allow creating tables")
            .withRules(listOf(createTableRule));

    Policy policy2 = postWithJWT(policiesTarget, createTablePolicy, Policy.class, adminAuthHeaders);

    // Create role with both permissions
    CreateRole botRole =
        new CreateRole()
            .withName("BotRole8")
            .withDescription("Role with impersonation and table creation permissions")
            .withPolicies(listOf(policy1.getFullyQualifiedName(), policy2.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role role = postWithJWT(rolesTarget, botRole, Role.class, adminAuthHeaders);

    // Create bot with permissions
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("audit-bot")
            .withEmail("audit-bot@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(role.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable allowImpersonation
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    // Generate bot token
    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    // Create role for target user with table creation permissions
    CreateRole targetUserRole =
        new CreateRole()
            .withName("DataAnalystRole8")
            .withDescription("Role with table creation permissions")
            .withPolicies(listOf(policy2.getFullyQualifiedName()));

    Role targetRole = postWithJWT(rolesTarget, targetUserRole, Role.class, adminAuthHeaders);

    // Create target user with table creation role
    CreateUser targetUserCreate =
        new CreateUser()
            .withName("data-analyst")
            .withEmail("data-analyst@email.com")
            .withIsBot(false)
            .withRoles(listOf(targetRole.getId()));
    User targetUser = postWithJWT(usersTarget, targetUserCreate, User.class, adminAuthHeaders);

    // Use header-based impersonation
    Map<String, String> impersonationAuthHeaders = new HashMap<>();
    impersonationAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    impersonationAuthHeaders.put("X-Impersonate-User", targetUser.getName());

    // Create a table using impersonation token
    // We need to create database service and database first
    org.openmetadata.schema.api.services.CreateDatabaseService createService =
        new org.openmetadata.schema.api.services.CreateDatabaseService()
            .withName("test-db-service")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new org.openmetadata.schema.services.connections.database.MysqlConnection()
                            .withHostPort("localhost:3306")
                            .withUsername("test")));

    WebTarget servicesTarget = getResource("services/databaseServices");
    org.openmetadata.schema.entity.services.DatabaseService service =
        postWithJWT(
            servicesTarget,
            createService,
            org.openmetadata.schema.entity.services.DatabaseService.class,
            adminAuthHeaders);

    org.openmetadata.schema.api.data.CreateDatabase createDatabase =
        new org.openmetadata.schema.api.data.CreateDatabase()
            .withName("test-database")
            .withService(service.getFullyQualifiedName());

    WebTarget databasesTarget = getResource("databases");
    org.openmetadata.schema.entity.data.Database database =
        postWithJWT(
            databasesTarget,
            createDatabase,
            org.openmetadata.schema.entity.data.Database.class,
            adminAuthHeaders);

    org.openmetadata.schema.api.data.CreateDatabaseSchema createSchema =
        new org.openmetadata.schema.api.data.CreateDatabaseSchema()
            .withName("test-schema")
            .withDatabase(database.getFullyQualifiedName());

    WebTarget schemasTarget = getResource("databaseSchemas");
    org.openmetadata.schema.entity.data.DatabaseSchema schema =
        postWithJWT(
            schemasTarget,
            createSchema,
            org.openmetadata.schema.entity.data.DatabaseSchema.class,
            adminAuthHeaders);

    // Now create a table using impersonation token
    org.openmetadata.schema.api.data.CreateTable createTable =
        new org.openmetadata.schema.api.data.CreateTable()
            .withName("impersonation-test-table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                listOf(
                    new Column()
                        .withName("id")
                        .withDataType(org.openmetadata.schema.type.ColumnDataType.INT)));

    WebTarget tablesTarget = getResource("tables");
    org.openmetadata.schema.entity.data.Table table =
        postWithJWT(
            tablesTarget,
            createTable,
            org.openmetadata.schema.entity.data.Table.class,
            impersonationAuthHeaders);

    // Verify the table was created with correct audit information
    assertNotNull(table);
    assertEquals("impersonation-test-table", table.getName());

    // The updatedBy should be the impersonated user
    assertEquals(targetUser.getName(), table.getUpdatedBy());

    // The updatedByBot should be the bot that performed the impersonation
    // Note: This might need to check a different field depending on implementation
    // We need to verify how OpenMetadata tracks "impersonatedBy"

    // Fetch the table to get full details including changelog
    WebTarget tableTarget = getResource("tables/name/" + table.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.Table fetchedTable =
        getWithJWT(tableTarget, org.openmetadata.schema.entity.data.Table.class, adminAuthHeaders);

    // Verify updatedBy is the target user
    assertEquals(targetUser.getName(), fetchedTable.getUpdatedBy());

    // Verify impersonatedBy is the bot
    assertEquals(bot.getName(), fetchedTable.getImpersonatedBy());

    // Cleanup
    deleteWithJWT(getResource("tables/" + table.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("databaseSchemas/" + schema.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("databases/" + database.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("services/databaseServices/" + service.getId()), adminAuthHeaders);
    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("users/" + targetUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + role.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + targetRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + policy1.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + policy2.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonation_updateOperation() throws Exception {
    // Test that UPDATE operations also track impersonatedBy correctly
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule9")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);

    Rule editPolicyRule =
        new Rule()
            .withName("EditPolicyRule9")
            .withResources(listOf("policy"))
            .withOperations(listOf(MetadataOperation.EDIT_ALL))
            .withEffect(ALLOW);

    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy9")
            .withDescription("Policy to allow impersonation and edit")
            .withRules(listOf(impersonationRule, editPolicyRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole9")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("update-bot")
            .withEmail("update-bot@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable impersonation
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    // Generate bot token
    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    // Create target user with edit permissions
    CreateUser targetUserCreate =
        new CreateUser()
            .withName("update-target")
            .withEmail("update-target@email.com")
            .withIsBot(false)
            .withRoles(listOf(impersonationRole.getId()));
    User targetUser = postWithJWT(usersTarget, targetUserCreate, User.class, adminAuthHeaders);

    // First create a policy as admin
    CreatePolicy testPolicyCreate =
        new CreatePolicy()
            .withName("policy-to-update")
            .withDescription("Original description")
            .withRules(
                listOf(
                    new Rule()
                        .withName("original-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    Policy createdPolicy =
        postWithJWT(policiesTarget, testPolicyCreate, Policy.class, adminAuthHeaders);

    assertEquals("admin", createdPolicy.getUpdatedBy());
    assertNull(createdPolicy.getImpersonatedBy());

    // Now update it using impersonation
    Map<String, String> impersonationAuthHeaders = new HashMap<>();
    impersonationAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    impersonationAuthHeaders.put("X-Impersonate-User", targetUser.getName());

    String originalPolicyJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(createdPolicy);
    createdPolicy.setDescription("Updated via impersonation");
    String updatedPolicyJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(createdPolicy);

    JsonNode policyPatch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalPolicyJson), mapper.readTree(updatedPolicyJson));

    WebTarget policyTarget = getResource("policies/" + createdPolicy.getId());
    Policy updatedPolicy =
        patchWithJWT(policyTarget, policyPatch, Policy.class, impersonationAuthHeaders);

    // Verify the update tracked impersonation correctly
    assertEquals("Updated via impersonation", updatedPolicy.getDescription());
    assertEquals(targetUser.getName(), updatedPolicy.getUpdatedBy());
    assertEquals(bot.getName(), updatedPolicy.getImpersonatedBy());

    // Cleanup
    deleteWithJWT(getResource("policies/" + updatedPolicy.getId()), adminAuthHeaders);
    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("users/" + targetUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonation_contextNotLeakedBetweenRequests() throws Exception {
    // Verify that impersonation context doesn't leak between requests

    // Create a policy that allows creating policies
    Rule createPolicyRule =
        new Rule()
            .withName("CreatePolicyRule")
            .withResources(listOf("policy"))
            .withOperations(listOf(MetadataOperation.CREATE))
            .withEffect(ALLOW);

    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule10")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);

    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy10")
            .withDescription("Policy to allow impersonation and policy creation")
            .withRules(listOf(impersonationRule, createPolicyRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole10")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("leak-test-bot")
            .withEmail("leak-test-bot@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable impersonation
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    // Generate bot token
    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    // Create target user with permission to create policies
    CreateUser targetUserCreate =
        new CreateUser()
            .withName("leak-test-target")
            .withEmail("leak-test-target@email.com")
            .withIsBot(false)
            .withRoles(listOf(impersonationRole.getId()));
    User targetUser = postWithJWT(usersTarget, targetUserCreate, User.class, adminAuthHeaders);

    // Make request WITH impersonation
    Map<String, String> impersonationAuthHeaders = new HashMap<>();
    impersonationAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    impersonationAuthHeaders.put("X-Impersonate-User", targetUser.getName());

    CreatePolicy policy1Create =
        new CreatePolicy()
            .withName("policy-with-impersonation")
            .withDescription("Created with impersonation")
            .withRules(
                listOf(
                    new Rule()
                        .withName("rule1")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    Policy policy1 =
        postWithJWT(policiesTarget, policy1Create, Policy.class, impersonationAuthHeaders);
    assertEquals(targetUser.getName(), policy1.getUpdatedBy());
    assertEquals(bot.getName(), policy1.getImpersonatedBy());

    // Make another request WITHOUT impersonation using bot token
    Map<String, String> botAuthHeaders = new HashMap<>();
    botAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    // NO X-Impersonate-User header

    CreatePolicy policy2Create =
        new CreatePolicy()
            .withName("policy-without-impersonation")
            .withDescription("Created without impersonation")
            .withRules(
                listOf(
                    new Rule()
                        .withName("rule2")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    Policy policy2 = postWithJWT(policiesTarget, policy2Create, Policy.class, botAuthHeaders);

    // Verify this request does NOT have impersonation context from previous request
    assertEquals(bot.getName(), policy2.getUpdatedBy());
    assertNull(policy2.getImpersonatedBy());

    // Cleanup
    deleteWithJWT(getResource("policies/" + policy1.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + policy2.getId()), adminAuthHeaders);
    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("users/" + targetUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonation_invalidHeaderValues() throws Exception {
    // Test various invalid header values
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule11")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);

    Rule createPolicyRule =
        new Rule()
            .withName("CreatePolicyRule11")
            .withResources(listOf("policy"))
            .withOperations(listOf(MetadataOperation.CREATE))
            .withEffect(ALLOW);

    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy11")
            .withDescription("Policy to allow impersonation and policy creation")
            .withRules(listOf(impersonationRule, createPolicyRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole11")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("invalid-header-bot")
            .withEmail("invalid-header-bot@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable impersonation
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    // Generate bot token
    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    // Test 1: Empty string header value - should fail as user not found
    Map<String, String> emptyHeaderAuth = new HashMap<>();
    emptyHeaderAuth.put("Authorization", "Bearer " + botToken.getJWTToken());
    emptyHeaderAuth.put("X-Impersonate-User", "");

    CreatePolicy testPolicyCreate =
        new CreatePolicy()
            .withName("test-policy-empty-header")
            .withDescription("Test policy")
            .withRules(
                listOf(
                    new Rule()
                        .withName("test-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    // Empty string should be treated as no impersonation header
    Policy policy1 = postWithJWT(policiesTarget, testPolicyCreate, Policy.class, emptyHeaderAuth);
    assertEquals(bot.getName(), policy1.getUpdatedBy());
    assertNull(policy1.getImpersonatedBy());

    // Test 2: Non-existent user - should fail
    Map<String, String> nonExistentUserAuth = new HashMap<>();
    nonExistentUserAuth.put("Authorization", "Bearer " + botToken.getJWTToken());
    nonExistentUserAuth.put("X-Impersonate-User", "non-existent-user-12345");

    CreatePolicy testPolicyCreate2 =
        new CreatePolicy()
            .withName("test-policy-nonexistent")
            .withDescription("Test policy")
            .withRules(
                listOf(
                    new Rule()
                        .withName("test-rule2")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    // Non-existent user should return 404 Not Found
    assertResponseContains(
        () -> postWithJWT(policiesTarget, testPolicyCreate2, Policy.class, nonExistentUserAuth),
        NOT_FOUND,
        "non-existent-user-12345");

    // Cleanup
    deleteWithJWT(getResource("policies/" + policy1.getId()), adminAuthHeaders);
    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonation_adminUserAsTarget() throws Exception {
    // Test that bot can impersonate an admin user and gets admin privileges
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule12")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);

    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy12")
            .withDescription("Policy to allow impersonation")
            .withRules(listOf(impersonationRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole12")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("admin-impersonation-bot")
            .withEmail("admin-impersonation-bot@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable impersonation
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    // Generate bot token
    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    // Impersonate admin user
    Map<String, String> impersonationAuthHeaders = new HashMap<>();
    impersonationAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    impersonationAuthHeaders.put("X-Impersonate-User", "admin");

    // Create a policy as admin (should succeed due to admin privileges)
    CreatePolicy testPolicyCreate =
        new CreatePolicy()
            .withName("admin-impersonation-policy")
            .withDescription("Created by bot impersonating admin")
            .withRules(
                listOf(
                    new Rule()
                        .withName("admin-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.ALL))
                        .withResources(listOf("all"))));

    Policy createdPolicy =
        postWithJWT(policiesTarget, testPolicyCreate, Policy.class, impersonationAuthHeaders);

    // Verify it was created with admin as updatedBy and bot as impersonatedBy
    assertEquals("admin", createdPolicy.getUpdatedBy());
    assertEquals(bot.getName(), createdPolicy.getImpersonatedBy());

    // Cleanup
    deleteWithJWT(getResource("policies/" + createdPolicy.getId()), adminAuthHeaders);
    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonation_botImpersonatingBot() throws Exception {
    // Test edge case: bot trying to impersonate another bot
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule13")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);

    Rule createPolicyRule =
        new Rule()
            .withName("CreatePolicyRule13")
            .withResources(listOf("policy"))
            .withOperations(listOf(MetadataOperation.CREATE))
            .withEffect(ALLOW);

    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy13")
            .withDescription("Policy to allow impersonation and policy creation")
            .withRules(listOf(impersonationRule, createPolicyRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole13")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot1 (impersonator)
    JWTAuthMechanism jwtAuth1 = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism1 =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth1);

    CreateUser bot1Create =
        new CreateUser()
            .withName("bot1-impersonator")
            .withEmail("bot1-impersonator@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism1)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot1 = postWithJWT(usersTarget, bot1Create, User.class, adminAuthHeaders);

    // Enable impersonation for bot1
    String originalBot1Json = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot1);
    bot1.setAllowImpersonation(true);
    String updatedBot1Json = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot1);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch1 =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBot1Json), mapper.readTree(updatedBot1Json));

    WebTarget bot1Target = getResource("users/" + bot1.getId());
    bot1 = patchWithJWT(bot1Target, patch1, User.class, adminAuthHeaders);

    // Generate bot1 token
    WebTarget generateToken1Target = getResource("users/generateToken/" + bot1.getId());
    putWithJWT(
        generateToken1Target,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getToken1Target = getResource("users/token/" + bot1.getId());
    JWTAuthMechanism bot1Token =
        getWithJWT(getToken1Target, JWTAuthMechanism.class, adminAuthHeaders);

    // Create bot2 (target bot)
    JWTAuthMechanism jwtAuth2 = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism2 =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth2);

    CreateUser bot2Create =
        new CreateUser()
            .withName("bot2-target")
            .withEmail("bot2-target@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism2)
            .withRoles(listOf(impersonationRole.getId()));

    User bot2 = postWithJWT(usersTarget, bot2Create, User.class, adminAuthHeaders);

    // Try to impersonate bot2 using bot1
    Map<String, String> impersonationAuthHeaders = new HashMap<>();
    impersonationAuthHeaders.put("Authorization", "Bearer " + bot1Token.getJWTToken());
    impersonationAuthHeaders.put("X-Impersonate-User", bot2.getName());

    CreatePolicy testPolicyCreate =
        new CreatePolicy()
            .withName("bot-to-bot-policy")
            .withDescription("Bot impersonating another bot")
            .withRules(
                listOf(
                    new Rule()
                        .withName("test-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    // Should succeed - bot1 can impersonate bot2
    Policy createdPolicy =
        postWithJWT(policiesTarget, testPolicyCreate, Policy.class, impersonationAuthHeaders);
    assertEquals(bot2.getName(), createdPolicy.getUpdatedBy());
    assertEquals(bot1.getName(), createdPolicy.getImpersonatedBy());

    // Cleanup
    deleteWithJWT(getResource("policies/" + createdPolicy.getId()), adminAuthHeaders);
    deleteWithJWT(bot1Target, adminAuthHeaders);
    deleteWithJWT(getResource("users/" + bot2.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonation_permissionRevokedAfterTokenIssued() throws Exception {
    // Test that even if bot had permission when token was issued,
    // if permission is revoked, impersonation should fail
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule14")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);

    Rule createPolicyRule =
        new Rule()
            .withName("CreatePolicyRule14")
            .withResources(listOf("policy"))
            .withOperations(listOf(MetadataOperation.CREATE))
            .withEffect(ALLOW);

    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy14")
            .withDescription("Policy to allow impersonation")
            .withRules(listOf(impersonationRule, createPolicyRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole14")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot with impersonation permission
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("revoke-test-bot")
            .withEmail("revoke-test-bot@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable impersonation
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    // Generate bot token
    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    // Create target user
    CreateUser targetUserCreate =
        new CreateUser()
            .withName("revoke-target-user")
            .withEmail("revoke-target-user@email.com")
            .withIsBot(false);

    User targetUser = postWithJWT(usersTarget, targetUserCreate, User.class, adminAuthHeaders);

    // Now REVOKE the impersonation permission by removing the role from bot
    String originalBotJson2 = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setRoles(listOf()); // Remove all roles
    String updatedBotJson2 = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    JsonNode patch2 =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson2), mapper.readTree(updatedBotJson2));

    bot = patchWithJWT(botTarget, patch2, User.class, adminAuthHeaders);

    // Try to impersonate with the old token - should fail even though token is still valid
    Map<String, String> impersonationAuthHeaders = new HashMap<>();
    impersonationAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    impersonationAuthHeaders.put("X-Impersonate-User", targetUser.getName());

    CreatePolicy testPolicyCreate =
        new CreatePolicy()
            .withName("revoke-test-policy")
            .withDescription("Test policy")
            .withRules(
                listOf(
                    new Rule()
                        .withName("test-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    // Should fail because permission was revoked
    assertResponseContains(
        () -> postWithJWT(policiesTarget, testPolicyCreate, Policy.class, impersonationAuthHeaders),
        FORBIDDEN,
        "does not have Impersonate permission");

    // Cleanup
    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("users/" + targetUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  @Test
  void test_impersonation_allowImpersonationFlagDisabledAfterTokenIssued() throws Exception {
    // Test that if allowImpersonation flag is disabled after token issued, impersonation fails
    Rule impersonationRule =
        new Rule()
            .withName("ImpersonationRule15")
            .withResources(listOf("user"))
            .withOperations(listOf(MetadataOperation.IMPERSONATE))
            .withEffect(ALLOW);

    Rule createPolicyRule =
        new Rule()
            .withName("CreatePolicyRule15")
            .withResources(listOf("policy"))
            .withOperations(listOf(MetadataOperation.CREATE))
            .withEffect(ALLOW);

    CreatePolicy policyCreate =
        new CreatePolicy()
            .withName("ImpersonationPolicy15")
            .withDescription("Policy to allow impersonation")
            .withRules(listOf(impersonationRule, createPolicyRule));

    WebTarget policiesTarget = getResource("policies");
    Policy impersonationPolicy =
        postWithJWT(policiesTarget, policyCreate, Policy.class, adminAuthHeaders);

    CreateRole roleCreate =
        new CreateRole()
            .withName("ImpersonationRole15")
            .withDescription("Role with impersonation permission")
            .withPolicies(listOf(impersonationPolicy.getFullyQualifiedName()));

    WebTarget rolesTarget = getResource("roles");
    Role impersonationRole = postWithJWT(rolesTarget, roleCreate, Role.class, adminAuthHeaders);

    // Create bot with impersonation enabled
    JWTAuthMechanism jwtAuth = new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited);
    org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
        new org.openmetadata.schema.entity.teams.AuthenticationMechanism()
            .withAuthType(org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuth);

    CreateUser botCreate =
        new CreateUser()
            .withName("flag-disable-bot")
            .withEmail("flag-disable-bot@email.com")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withRoles(listOf(impersonationRole.getId()));

    WebTarget usersTarget = getResource("users");
    User bot = postWithJWT(usersTarget, botCreate, User.class, adminAuthHeaders);

    // Enable impersonation
    String originalBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(true);
    String updatedBotJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson), mapper.readTree(updatedBotJson));

    WebTarget botTarget = getResource("users/" + bot.getId());
    bot = patchWithJWT(botTarget, patch, User.class, adminAuthHeaders);

    // Generate bot token
    WebTarget generateTokenTarget = getResource("users/generateToken/" + bot.getId());
    putWithJWT(
        generateTokenTarget,
        new GenerateTokenRequest().withJWTTokenExpiry(JWTTokenExpiry.Unlimited),
        adminAuthHeaders);

    WebTarget getTokenTarget = getResource("users/token/" + bot.getId());
    JWTAuthMechanism botToken =
        getWithJWT(getTokenTarget, JWTAuthMechanism.class, adminAuthHeaders);

    // Create target user
    CreateUser targetUserCreate =
        new CreateUser()
            .withName("flag-disable-target")
            .withEmail("flag-disable-target@email.com")
            .withIsBot(false);

    User targetUser = postWithJWT(usersTarget, targetUserCreate, User.class, adminAuthHeaders);

    // Now DISABLE allowImpersonation flag
    String originalBotJson2 = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);
    bot.setAllowImpersonation(false);
    String updatedBotJson2 = org.openmetadata.schema.utils.JsonUtils.pojoToJson(bot);

    JsonNode patch2 =
        com.flipkart.zjsonpatch.JsonDiff.asJson(
            mapper.readTree(originalBotJson2), mapper.readTree(updatedBotJson2));

    bot = patchWithJWT(botTarget, patch2, User.class, adminAuthHeaders);

    // Try to impersonate - should fail
    Map<String, String> impersonationAuthHeaders = new HashMap<>();
    impersonationAuthHeaders.put("Authorization", "Bearer " + botToken.getJWTToken());
    impersonationAuthHeaders.put("X-Impersonate-User", targetUser.getName());

    CreatePolicy testPolicyCreate =
        new CreatePolicy()
            .withName("flag-disable-policy")
            .withDescription("Test policy")
            .withRules(
                listOf(
                    new Rule()
                        .withName("test-rule")
                        .withEffect(ALLOW)
                        .withOperations(listOf(MetadataOperation.VIEW_ALL))
                        .withResources(listOf("all"))));

    // Should fail because allowImpersonation was disabled
    assertResponseContains(
        () -> postWithJWT(policiesTarget, testPolicyCreate, Policy.class, impersonationAuthHeaders),
        FORBIDDEN,
        "does not have impersonation enabled");

    // Cleanup
    deleteWithJWT(botTarget, adminAuthHeaders);
    deleteWithJWT(getResource("users/" + targetUser.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("roles/" + impersonationRole.getId()), adminAuthHeaders);
    deleteWithJWT(getResource("policies/" + impersonationPolicy.getId()), adminAuthHeaders);
  }

  private DecodedJWT decodedJWT(String token) {
    Algorithm algorithm = Algorithm.RSA256(jwtTokenGenerator.getPublicKey(), null);
    JWTVerifier verifier = JWT.require(algorithm).withIssuer("open-metadata.org").build();
    return verifier.verify(token);
  }

  private <T> T postWithJWT(
      WebTarget target, Object request, Class<T> clazz, Map<String, String> authHeaders)
      throws HttpResponseException {
    return postWithJWT(
        target, request, clazz, authHeaders, Response.Status.CREATED.getStatusCode());
  }

  private <T> T postWithJWT(
      WebTarget target,
      Object request,
      Class<T> clazz,
      Map<String, String> authHeaders,
      int expectedStatus)
      throws HttpResponseException {
    var requestBuilder = target.request();
    // Add all headers from the map
    for (Map.Entry<String, String> header : authHeaders.entrySet()) {
      requestBuilder.header(header.getKey(), header.getValue());
    }
    Response response = requestBuilder.post(jakarta.ws.rs.client.Entity.json(request));
    return TestUtils.readResponse(response, clazz, expectedStatus);
  }

  private <T> T getWithJWT(WebTarget target, Class<T> clazz, Map<String, String> authHeaders) {
    return target.request().header("Authorization", authHeaders.get("Authorization")).get(clazz);
  }

  private <T> T getWithJWT(
      WebTarget target, Class<T> clazz, Map<String, String> authHeaders, String fields) {
    WebTarget targetWithFields = fields != null ? target.queryParam("fields", fields) : target;
    return targetWithFields
        .request()
        .header("Authorization", authHeaders.get("Authorization"))
        .get(clazz);
  }

  private void putWithJWT(WebTarget target, Object request, Map<String, String> authHeaders) {
    target
        .request()
        .header("Authorization", authHeaders.get("Authorization"))
        .put(jakarta.ws.rs.client.Entity.json(request));
  }

  private <T> T patchWithJWT(
      WebTarget target, JsonNode patch, Class<T> clazz, Map<String, String> authHeaders) {
    var requestBuilder = target.request();
    // Add all headers from the map
    for (Map.Entry<String, String> header : authHeaders.entrySet()) {
      requestBuilder.header(header.getKey(), header.getValue());
    }
    return requestBuilder.method(
        "PATCH",
        jakarta.ws.rs.client.Entity.entity(
            patch.toString(), jakarta.ws.rs.core.MediaType.APPLICATION_JSON_PATCH_JSON_TYPE),
        clazz);
  }

  private void deleteWithJWT(WebTarget target, Map<String, String> authHeaders) {
    target.request().header("Authorization", authHeaders.get("Authorization")).delete();
  }
}
