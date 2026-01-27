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

package org.openmetadata.it.bootstrap;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.classification.ClassificationService;
import org.openmetadata.sdk.services.classification.TagService;
import org.openmetadata.sdk.services.domains.DomainService;
import org.openmetadata.sdk.services.glossary.GlossaryService;
import org.openmetadata.sdk.services.glossary.GlossaryTermService;
import org.openmetadata.sdk.services.policies.PolicyService;
import org.openmetadata.sdk.services.services.DatabaseServiceService;
import org.openmetadata.sdk.services.teams.RoleService;
import org.openmetadata.sdk.services.teams.TeamService;
import org.openmetadata.sdk.services.teams.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Session-scoped shared entities used across all test classes.
 * Created ONCE at session start via TestSuiteBootstrap, deleted at session end.
 *
 * <p>These entities are NEVER modified by individual tests - they are
 * read-only reference entities for ownership, team membership, access control, etc.
 *
 * <p>Individual tests create their own namespaced entities for testing, but
 * can reference these shared entities as owners, domains, tags, etc.
 */
public final class SharedEntities {

  private static final Logger LOG = LoggerFactory.getLogger(SharedEntities.class);
  private static SharedEntities INSTANCE;

  // Users
  public final User USER1;
  public final User USER2;
  public final User USER3;
  public final EntityReference USER1_REF;
  public final EntityReference USER2_REF;
  public final EntityReference USER3_REF;

  // Teams
  public final Team ORG_TEAM;
  public final Team TEAM1;
  public final Team TEAM11;
  public final Team TEAM2;
  public final Team TEAM21;

  // Roles
  public final Role DATA_STEWARD_ROLE;
  public final Role DATA_CONSUMER_ROLE;
  public final EntityReference DATA_STEWARD_ROLE_REF;
  public final EntityReference DATA_CONSUMER_ROLE_REF;

  // Policies
  public final Policy POLICY1;
  public final Policy POLICY2;

  // Domains
  public final Domain DOMAIN;
  public final Domain SUB_DOMAIN;

  // Classifications & Tags
  public final Classification PII_CLASSIFICATION;
  public final Tag PERSONAL_DATA_TAG;
  public final Tag SENSITIVE_TAG;
  public final TagLabel PERSONAL_DATA_TAG_LABEL;
  public final TagLabel PII_SENSITIVE_TAG_LABEL;

  // Glossaries
  public final Glossary GLOSSARY1;
  public final Glossary GLOSSARY2;
  public final GlossaryTerm GLOSSARY1_TERM1;
  public final TagLabel GLOSSARY1_TERM1_LABEL;

  // Services - DatabaseService as example (others can be added as needed)
  public final DatabaseService MYSQL_SERVICE;
  public final EntityReference MYSQL_REFERENCE;

  private SharedEntities(
      User user1,
      User user2,
      User user3,
      Team orgTeam,
      Team team1,
      Team team11,
      Team team2,
      Team team21,
      Role dataStewardRole,
      Role dataConsumerRole,
      Policy policy1,
      Policy policy2,
      Domain domain,
      Domain subDomain,
      Classification piiClassification,
      Tag personalDataTag,
      Tag sensitiveTag,
      Glossary glossary1,
      Glossary glossary2,
      GlossaryTerm glossary1Term1,
      DatabaseService mysqlService) {

    this.USER1 = user1;
    this.USER2 = user2;
    this.USER3 = user3;
    this.USER1_REF = user1.getEntityReference();
    this.USER2_REF = user2.getEntityReference();
    this.USER3_REF = user3.getEntityReference();

    this.ORG_TEAM = orgTeam;
    this.TEAM1 = team1;
    this.TEAM11 = team11;
    this.TEAM2 = team2;
    this.TEAM21 = team21;

    this.DATA_STEWARD_ROLE = dataStewardRole;
    this.DATA_CONSUMER_ROLE = dataConsumerRole;
    this.DATA_STEWARD_ROLE_REF = dataStewardRole.getEntityReference();
    this.DATA_CONSUMER_ROLE_REF = dataConsumerRole.getEntityReference();

    this.POLICY1 = policy1;
    this.POLICY2 = policy2;

    this.DOMAIN = domain;
    this.SUB_DOMAIN = subDomain;

    this.PII_CLASSIFICATION = piiClassification;
    this.PERSONAL_DATA_TAG = personalDataTag;
    this.SENSITIVE_TAG = sensitiveTag;
    this.PERSONAL_DATA_TAG_LABEL =
        new TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    this.PII_SENSITIVE_TAG_LABEL =
        new TagLabel()
            .withTagFQN(sensitiveTag.getFullyQualifiedName())
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);

    this.GLOSSARY1 = glossary1;
    this.GLOSSARY2 = glossary2;
    this.GLOSSARY1_TERM1 = glossary1Term1;
    this.GLOSSARY1_TERM1_LABEL =
        new TagLabel()
            .withTagFQN(glossary1Term1.getFullyQualifiedName())
            .withSource(TagSource.GLOSSARY)
            .withLabelType(TagLabel.LabelType.MANUAL);

    this.MYSQL_SERVICE = mysqlService;
    this.MYSQL_REFERENCE = mysqlService.getEntityReference();
  }

  public static SharedEntities get() {
    if (INSTANCE == null) {
      throw new IllegalStateException(
          "SharedEntities not initialized. Ensure TestSuiteBootstrap has run.");
    }
    return INSTANCE;
  }

  public static boolean isInitialized() {
    return INSTANCE != null;
  }

  /**
   * Initialize all shared entities. Called by TestSuiteBootstrap.open().
   */
  public static void initialize(OpenMetadataClient adminClient) {
    if (INSTANCE != null) {
      LOG.info("SharedEntities already initialized, skipping");
      return;
    }

    LOG.info("=== SharedEntities: Creating shared test entities ===");
    long startTime = System.currentTimeMillis();

    try {
      // Get existing system roles (created by seed data)
      RoleService roleService = new RoleService(adminClient.getHttpClient());
      Role dataStewardRole = roleService.getByName("DataSteward", "policies");
      Role dataConsumerRole = roleService.getByName("DataConsumer", "policies");

      // Create policies
      PolicyService policyService = new PolicyService(adminClient.getHttpClient());
      Policy policy1 = createPolicy(policyService, "shared_policy1");
      Policy policy2 = createPolicy(policyService, "shared_policy2");

      // Create a test role with AllowAll policy for permission tests
      org.openmetadata.schema.api.teams.CreateRole createTestRole =
          new org.openmetadata.schema.api.teams.CreateRole()
              .withName("shared_test_admin_role")
              .withDescription("Test role with AllowAll permissions for integration tests")
              .withPolicies(List.of(policy1.getName()));
      Role testAdminRole = roleService.create(createTestRole);

      // Get org team (system entity)
      TeamService teamService = new TeamService(adminClient.getHttpClient());
      Team orgTeam = teamService.getByName("Organization", null);

      // Create teams
      Team team1 = createTeam(teamService, "shared_team1", TeamType.DEPARTMENT, null);
      Team team11 = createTeam(teamService, "shared_team11", TeamType.GROUP, team1.getId());
      Team team2 = createTeam(teamService, "shared_team2", TeamType.DEPARTMENT, null);
      Team team21 = createTeam(teamService, "shared_team21", TeamType.GROUP, team2.getId());

      // Create users
      // USER1 has test admin role (AllowAll) for permission tests
      UserService userService = new UserService(adminClient.getHttpClient());
      User user1 =
          createUser(
              userService, "shared_user1", List.of(team1.getId()), List.of(testAdminRole.getId()));
      User user2 = createUser(userService, "shared_user2", List.of(team2.getId()), List.of());
      User user3 = createUser(userService, "shared_user3", List.of(), List.of());

      // Create domains
      DomainService domainService = new DomainService(adminClient.getHttpClient());
      Domain domain = createDomain(domainService, "shared_domain");
      Domain subDomain =
          createSubDomain(domainService, "shared_subdomain", domain.getFullyQualifiedName());

      // Create classification and tags
      ClassificationService classificationService =
          new ClassificationService(adminClient.getHttpClient());
      TagService tagService = new TagService(adminClient.getHttpClient());
      Classification piiClassification =
          getOrCreateClassification(classificationService, "SharedPII");
      Tag personalDataTag = createTag(tagService, piiClassification.getName(), "PersonalData");
      Tag sensitiveTag = createTag(tagService, piiClassification.getName(), "Sensitive");

      // Create glossaries
      GlossaryService glossaryService = new GlossaryService(adminClient.getHttpClient());
      GlossaryTermService glossaryTermService =
          new GlossaryTermService(adminClient.getHttpClient());
      Glossary glossary1 = createGlossary(glossaryService, "shared_glossary1");
      Glossary glossary2 = createGlossary(glossaryService, "shared_glossary2");
      GlossaryTerm glossary1Term1 =
          createGlossaryTerm(glossaryTermService, glossary1, "shared_term1");

      // Create database service
      DatabaseServiceService dbServiceService =
          new DatabaseServiceService(adminClient.getHttpClient());
      DatabaseService mysqlService = createMySqlService(dbServiceService, "shared_mysql");

      INSTANCE =
          new SharedEntities(
              user1,
              user2,
              user3,
              orgTeam,
              team1,
              team11,
              team2,
              team21,
              dataStewardRole,
              dataConsumerRole,
              policy1,
              policy2,
              domain,
              subDomain,
              piiClassification,
              personalDataTag,
              sensitiveTag,
              glossary1,
              glossary2,
              glossary1Term1,
              mysqlService);

      long duration = System.currentTimeMillis() - startTime;
      LOG.info("=== SharedEntities: Created shared entities in {}ms ===", duration);

    } catch (Exception e) {
      LOG.error("Failed to create shared entities", e);
      throw new RuntimeException("SharedEntities initialization failed", e);
    }
  }

  /**
   * Cleanup all shared entities. Called by TestSuiteBootstrap.close().
   */
  public static void cleanup(OpenMetadataClient adminClient) {
    if (INSTANCE == null) {
      LOG.info("SharedEntities not initialized, skipping cleanup");
      return;
    }

    LOG.info("=== SharedEntities: Cleaning up shared test entities ===");
    // Skip cleanup since containers are destroyed anyway
    INSTANCE = null;
    LOG.info("=== SharedEntities: Cleanup complete ===");
  }

  // === Entity Creation Helpers ===

  private static User createUser(
      UserService userService, String name, List<UUID> teamIds, List<UUID> roleIds) {
    CreateUser createUser =
        new CreateUser()
            .withName(name)
            .withEmail(name + "@test.openmetadata.org")
            .withTeams(teamIds)
            .withRoles(roleIds);
    return userService.create(createUser);
  }

  private static Team createTeam(
      TeamService teamService, String name, TeamType type, UUID parentId) {
    CreateTeam createTeam =
        new CreateTeam().withName(name).withDisplayName(name).withTeamType(type);
    if (parentId != null) {
      createTeam.withParents(List.of(parentId));
    }
    return teamService.create(createTeam);
  }

  private static Policy createPolicy(PolicyService policyService, String name) {
    Rule allowAllRule =
        new Rule()
            .withName("AllowAll")
            .withResources(List.of("All"))
            .withOperations(List.of(MetadataOperation.ALL))
            .withEffect(Rule.Effect.ALLOW);

    CreatePolicy createPolicy = new CreatePolicy().withName(name).withRules(List.of(allowAllRule));
    return policyService.create(createPolicy);
  }

  private static Domain createDomain(DomainService domainService, String name) {
    CreateDomain createDomain =
        new CreateDomain()
            .withName(name)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Shared test domain");
    return domainService.create(createDomain);
  }

  private static Domain createSubDomain(
      DomainService domainService, String name, String parentFqn) {
    CreateDomain createDomain =
        new CreateDomain()
            .withName(name)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Shared test subdomain")
            .withParent(parentFqn);
    return domainService.create(createDomain);
  }

  private static Classification getOrCreateClassification(
      ClassificationService classificationService, String name) {
    try {
      return classificationService.getByName(name, null);
    } catch (Exception e) {
      CreateClassification create =
          new CreateClassification().withName(name).withDescription("Shared test classification");
      return classificationService.create(create);
    }
  }

  private static Tag createTag(TagService tagService, String classificationName, String tagName) {
    CreateTag createTag =
        new CreateTag()
            .withName(tagName)
            .withClassification(classificationName)
            .withDescription("Shared test tag");
    return tagService.create(createTag);
  }

  private static Glossary createGlossary(GlossaryService glossaryService, String name) {
    CreateGlossary createGlossary =
        new CreateGlossary().withName(name).withDescription("Shared test glossary");
    return glossaryService.create(createGlossary);
  }

  private static GlossaryTerm createGlossaryTerm(
      GlossaryTermService glossaryTermService, Glossary glossary, String name) {
    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Shared test glossary term");
    return glossaryTermService.create(createTerm);
  }

  private static DatabaseService createMySqlService(
      DatabaseServiceService serviceService, String name) {
    MysqlConnection connection =
        new MysqlConnection()
            .withHostPort("localhost:3306")
            .withUsername("test")
            .withAuthType(new basicAuth().withPassword("test"));

    DatabaseConnection dbConn = new DatabaseConnection().withConfig(connection);

    CreateDatabaseService create =
        new CreateDatabaseService()
            .withName(name)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(dbConn);
    return serviceService.create(create);
  }
}
