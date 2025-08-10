package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.MetadataOperation.CREATE;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_TAGS;
import static org.openmetadata.service.resources.EntityResourceTest.DATA_CONSUMER_ROLE_NAME;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;
import static org.openmetadata.service.security.policyevaluator.SubjectContext.TEAM_FIELDS;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mockito.stubbing.Answer;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.DatabaseRepository;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.jdbi3.DomainRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;
import org.openmetadata.service.util.EntityUtil;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.spel.support.StandardEvaluationContext;

@Slf4j
class RuleEvaluatorTest {
  private static final Table table =
      new Table().withId(UUID.randomUUID()).withName("table").withFullyQualifiedName("test.table");
  private static User user;
  private static EvaluationContext evaluationContext;
  private static SubjectContext subjectContext;
  private static ResourceContext<?> resourceContext;
  private static final String DATA_CONSUMER_POLICY_NAME = "DataConsumerPolicy";

  private static CreateResourceContext<?> createResourceContextSchema;
  private static CreateResourceContext<?> createResourceContextDataProduct;
  private static ResourceContext<DataProduct> resourceContextDataProduct;

  private static User ownerUser;
  private static User nonOwnerUser;
  private static EntityReference ownerRef;
  private static EntityReference databaseRef;
  private static TableRepository tableRepository;

  @BeforeAll
  public static void setup() {
    TeamRepository teamRepository = mock(TeamRepository.class);
    Entity.registerEntity(Team.class, Entity.TEAM, teamRepository);
    Mockito.when(teamRepository.find(any(UUID.class), any(Include.class)))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_ID.get(
                    new ImmutablePair<>(Entity.TEAM, i.getArgument(0))));
    Mockito.when(teamRepository.getReference(any(UUID.class), any(Include.class)))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_ID
                    .get(new ImmutablePair<>(Entity.TEAM, i.getArgument(0)))
                    .getEntityReference());

    Mockito.when(teamRepository.findByName(anyString(), any(Include.class)))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_NAME.get(
                    new ImmutablePair<>(Entity.TEAM, i.getArgument(0))));

    Mockito.when(
            teamRepository.get(
                isNull(), any(UUID.class), isNull(), any(Include.class), anyBoolean()))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_ID.get(
                    new ImmutablePair<>(Entity.TEAM, i.getArgument(1))));

    Mockito.when(
            teamRepository.getByName(
                isNull(), anyString(), isNull(), any(Include.class), anyBoolean()))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_ID.get(
                    new ImmutablePair<>(Entity.TEAM, i.getArgument(1))));

    tableRepository = mock(TableRepository.class);
    Entity.registerEntity(Table.class, Entity.TABLE, tableRepository);
    Mockito.when(tableRepository.getAllTags(any()))
        .thenAnswer((Answer<List<TagLabel>>) invocationOnMock -> table.getTags());
    Mockito.when(tableRepository.getEntityType()).thenReturn(Entity.TABLE);
    Mockito.when(tableRepository.isSupportsOwners()).thenReturn(Boolean.TRUE);

    DatabaseRepository databaseRepository = mock(DatabaseRepository.class);
    Mockito.when(databaseRepository.getEntityType()).thenReturn(Entity.DATABASE);
    Mockito.when(databaseRepository.isSupportsOwners()).thenReturn(Boolean.TRUE);
    Entity.registerEntity(Database.class, Entity.DATABASE, databaseRepository);

    DatabaseSchemaRepository databaseSchemaRepository = mock(DatabaseSchemaRepository.class);
    Mockito.when(databaseSchemaRepository.getEntityType()).thenReturn(Entity.DATABASE_SCHEMA);
    Mockito.when(databaseSchemaRepository.isSupportsOwners()).thenReturn(Boolean.TRUE);
    Entity.registerEntity(DatabaseSchema.class, Entity.DATABASE_SCHEMA, databaseSchemaRepository);

    DomainRepository domainRepository = mock(DomainRepository.class);
    Mockito.when(domainRepository.getEntityType()).thenReturn(Entity.DOMAIN);
    Mockito.when(domainRepository.isSupportsOwners()).thenReturn(Boolean.TRUE);
    Entity.registerEntity(Domain.class, Entity.DOMAIN, domainRepository);
    Mockito.when(domainRepository.get(isNull(), any(UUID.class), any(EntityUtil.Fields.class)))
        .thenAnswer(
            i ->
                EntityRepository.CACHE_WITH_ID.get(
                    new ImmutablePair<>(Entity.DOMAIN, i.getArgument(1))));

    DataProductRepository dataProductRepository = mock(DataProductRepository.class);
    Mockito.when(dataProductRepository.getEntityType()).thenReturn(Entity.DATA_PRODUCT);
    Mockito.when(dataProductRepository.isSupportsOwners()).thenReturn(Boolean.TRUE);
    Entity.registerEntity(DataProduct.class, Entity.DATA_PRODUCT, dataProductRepository);

    user = new User().withId(UUID.randomUUID()).withName("user").withFullyQualifiedName("user");
    ownerUser =
        new User().withId(UUID.randomUUID()).withName("owner").withFullyQualifiedName("owner");
    nonOwnerUser =
        new User()
            .withId(UUID.randomUUID())
            .withName("nonOwner")
            .withFullyQualifiedName("nonOwner");
    ownerRef = ownerUser.getEntityReference().withType(Entity.USER);

    Database database = new Database().withId(UUID.randomUUID()).withName("testDB");
    databaseRef = database.getEntityReference();
    DatabaseSchema schema = new DatabaseSchema().withId(UUID.randomUUID()).withName("testSchema");
    schema.setDatabase(databaseRef);
    database.setOwners(List.of(ownerRef));
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DATABASE_SCHEMA, schema.getId()), schema);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DATABASE, database.getId()), database);
    Mockito.when(databaseSchemaRepository.getParentEntity(any(DatabaseSchema.class), anyString()))
        .thenAnswer(
            i -> {
              DatabaseSchema cachedSchema = i.getArgument(0);
              EntityReference dbRef = cachedSchema.getDatabase();
              if (dbRef == null) return null;
              Database db =
                  (Database)
                      EntityRepository.CACHE_WITH_ID.get(
                          new ImmutablePair<>(Entity.DATABASE, dbRef.getId()));
              return db;
            });
    createResourceContextSchema =
        Mockito.spy(new CreateResourceContext<>(Entity.DATABASE_SCHEMA, schema));

    Domain domain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("testDomain")
            .withFullyQualifiedName("testDomain")
            .withOwners(List.of(ownerRef));
    DataProduct dataProduct =
        new DataProduct()
            .withId(UUID.randomUUID())
            .withName("testDataProduct")
            .withFullyQualifiedName("testDataProduct")
            .withDomains(List.of(domain.getEntityReference()));
    EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.DOMAIN, domain.getId()), domain);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DATA_PRODUCT, dataProduct.getId()), dataProduct);
    resourceContextDataProduct =
        Mockito.spy(new ResourceContext<>(Entity.DATA_PRODUCT, dataProduct, dataProductRepository));
    createResourceContextDataProduct =
        Mockito.spy(new CreateResourceContext<>(Entity.DATA_PRODUCT, dataProduct));

    resourceContext = new ResourceContext<>(Entity.TABLE, table, tableRepository);
    subjectContext = new SubjectContext(user);
    RuleEvaluator ruleEvaluator = new RuleEvaluator(null, subjectContext, resourceContext);
    evaluationContext = new StandardEvaluationContext(ruleEvaluator);
  }

  @Test
  void test_noOwner() {
    // Set no owner to the entity and test noOwner method
    table.setOwners(null);
    assertTrue(evaluateExpression("noOwner()"));
    assertFalse(evaluateExpression("!noOwner()"));

    // Set owner to the entity and test noOwner method
    table.setOwners(List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER)));
    assertFalse(evaluateExpression("noOwner()"));
    assertTrue(evaluateExpression("!noOwner()"));
  }

  @Test
  void test_isOwner() {
    // Table owner is a different user (random ID) and hence isOwner returns false
    table.setOwners(
        List.of(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.USER)
                .withName("otherUser")));
    assertFalse(evaluateExpression("isOwner()"));
    assertTrue(evaluateExpression("!isOwner()"));

    // Table owner is same as the user in subjectContext and hence isOwner returns true
    table.setOwners(
        List.of(
            new EntityReference()
                .withId(user.getId())
                .withType(Entity.USER)
                .withName(user.getName())));
    assertTrue(evaluateExpression("isOwner()"));
    assertFalse(evaluateExpression("!isOwner()"));

    // noOwner() || isOwner() - with noOwner being true and isOwner false
    table.setOwners(null);
    assertTrue(evaluateExpression("noOwner() || isOwner()"));
    assertFalse(evaluateExpression("!noOwner() && !isOwner()"));

    // noOwner() || isOwner() - with noOwner is false and isOwner true
    table.setOwners(
        List.of(
            new EntityReference()
                .withId(user.getId())
                .withType(Entity.USER)
                .withName(user.getName())));
    assertTrue(evaluateExpression("noOwner() || isOwner()"));
    assertFalse(evaluateExpression("!noOwner() && !isOwner()"));

    // Verify that parent owner has the necessary permissions to create child entities -
    // createResourceContext
    Role dataConsumerRole = new Role().withId(UUID.randomUUID()).withName(DATA_CONSUMER_ROLE_NAME);
    ownerUser.setRoles(List.of(dataConsumerRole.getEntityReference()));
    Rule createRule =
        new Rule()
            .withResources(List.of("All"))
            .withOperations(List.of(CREATE))
            .withCondition("isOwner()")
            .withEffect(Rule.Effect.ALLOW);
    Policy policy = new Policy().withName(DATA_CONSUMER_POLICY_NAME).withRules(List.of(createRule));
    List<CompiledRule> compiledRules = List.of(new CompiledRule(createRule));
    PolicyContext policyContext =
        new PolicyContext(
            Entity.USER,
            ownerUser.getName(),
            DATA_CONSUMER_ROLE_NAME,
            policy.getName(),
            compiledRules);

    subjectContext = new SubjectContext(ownerUser);
    RuleEvaluator ruleEvaluator =
        new RuleEvaluator(policyContext, subjectContext, createResourceContextSchema);
    evaluationContext = new StandardEvaluationContext(ruleEvaluator);
    assertTrue(evaluateExpression("isOwner()"));

    subjectContext = new SubjectContext(nonOwnerUser);
    ruleEvaluator = new RuleEvaluator(policyContext, subjectContext, createResourceContextSchema);
    evaluationContext = new StandardEvaluationContext(ruleEvaluator);
    assertFalse(evaluateExpression("isOwner()"));

    // Verify that domain owner has the necessary permissions to create/edit its  dataProduct -
    // ResourceContext (edit related permissions)
    Rule editRule =
        new Rule()
            .withResources(List.of("All"))
            .withOperations(List.of(CREATE, EDIT_TAGS))
            .withCondition("isOwner()")
            .withEffect(Rule.Effect.ALLOW);
    policy = new Policy().withName(DATA_CONSUMER_POLICY_NAME).withRules(List.of(editRule));
    compiledRules = List.of(new CompiledRule(editRule));
    policyContext =
        new PolicyContext(
            Entity.USER,
            ownerUser.getName(),
            DATA_CONSUMER_ROLE_NAME,
            policy.getName(),
            compiledRules);

    subjectContext = new SubjectContext(ownerUser);
    ruleEvaluator = new RuleEvaluator(policyContext, subjectContext, resourceContextDataProduct);
    evaluationContext = new StandardEvaluationContext(ruleEvaluator);
    assertTrue(evaluateExpression("isOwner()"));
    ruleEvaluator =
        new RuleEvaluator(policyContext, subjectContext, createResourceContextDataProduct);
    evaluationContext = new StandardEvaluationContext(ruleEvaluator);
    assertTrue(evaluateExpression("isOwner()"));

    subjectContext = new SubjectContext(nonOwnerUser);
    ruleEvaluator = new RuleEvaluator(policyContext, subjectContext, resourceContextDataProduct);
    evaluationContext = new StandardEvaluationContext(ruleEvaluator);
    assertFalse(evaluateExpression("isOwner()"));
    ruleEvaluator =
        new RuleEvaluator(policyContext, subjectContext, createResourceContextDataProduct);
    evaluationContext = new StandardEvaluationContext(ruleEvaluator);
    assertFalse(evaluateExpression("isOwner()"));
  }

  @Test
  void test_matchAllTags() {
    table.withTags(getTags("tag1", "tag2", "tag3"));

    // All tags present
    assertTrue(evaluateExpression("matchAllTags('tag1', 'tag2', 'tag3')"));
    assertFalse(evaluateExpression("!matchAllTags('tag1', 'tag2', 'tag3')"));
    assertTrue(evaluateExpression("matchAllTags('tag1', 'tag2')"));
    assertFalse(evaluateExpression("!matchAllTags('tag1', 'tag2')"));
    assertTrue(evaluateExpression("matchAllTags('tag1')"));
    assertFalse(evaluateExpression("!matchAllTags('tag1')"));

    // Tag 'tag4' is missing
    assertFalse(evaluateExpression("matchAllTags('tag1', 'tag2', 'tag3', 'tag4')"));
    assertTrue(evaluateExpression("!matchAllTags('tag1', 'tag2', 'tag3', 'tag4')"));
    assertFalse(evaluateExpression("matchAllTags('tag1', 'tag2', 'tag4')"));
    assertTrue(evaluateExpression("!matchAllTags('tag1', 'tag2', 'tag4')"));
    assertFalse(evaluateExpression("matchAllTags('tag2', 'tag4')"));
    assertTrue(evaluateExpression("!matchAllTags('tag2', 'tag4')"));
    assertFalse(evaluateExpression("matchAllTags('tag4')"));
    assertTrue(evaluateExpression("!matchAllTags('tag4')"));
  }

  @Test
  void test_matchAnyTag() {
    table.withTags(getTags("tag1", "tag2", "tag3"));

    // Tag is present
    assertTrue(evaluateExpression("matchAnyTag('tag1', 'tag2', 'tag3', 'tag4')"));
    assertFalse(evaluateExpression("!matchAnyTag('tag1', 'tag2', 'tag3', 'tag4')"));
    assertTrue(evaluateExpression("matchAnyTag('tag1', 'tag2', 'tag4')"));
    assertFalse(evaluateExpression("!matchAnyTag('tag1', 'tag2', 'tag4')"));
    assertTrue(evaluateExpression("matchAnyTag('tag1', 'tag2', 'tag4')"));
    assertFalse(evaluateExpression("!matchAnyTag('tag1', 'tag2', 'tag4')"));
    assertTrue(evaluateExpression("matchAnyTag('tag1', 'tag4')"));
    assertFalse(evaluateExpression("!matchAnyTag('tag1', 'tag4')"));

    // Tag `tag4` is not present
    assertFalse(evaluateExpression("matchAnyTag('tag4')"));
    assertTrue(evaluateExpression("!matchAnyTag('tag4')"));
  }

  @Test
  void test_matchAnyCertification() {
    // Certification is not Present
    assertTrue(evaluateExpression("!matchAnyCertification('Certification.Gold')"));
    assertTrue(
        evaluateExpression("!matchAnyCertification('Certification.Gold', 'Certification.Silver')"));
    assertFalse(evaluateExpression("matchAnyCertification('Certification.Bronze')"));

    table.withCertification(
        new AssetCertification().withTagLabel(new TagLabel().withTagFQN("Certification.Gold")));

    // Certification is present
    assertTrue(
        evaluateExpression("matchAnyCertification('Certification.Gold', 'Certification.Silver')"));
    assertFalse(
        evaluateExpression("!matchAnyCertification('Certification.Gold', 'Certification.Silver')"));
    assertTrue(evaluateExpression("matchAnyCertification('Certification.Gold')"));
    assertFalse(evaluateExpression("!matchAnyCertification('Certification.Gold')"));

    // Certification is different
    assertFalse(
        evaluateExpression(
            "matchAnyCertification('Certification.Bronze', 'Certification.Silver')"));
    assertTrue(
        evaluateExpression(
            "!matchAnyCertification('Certification.Bronze', 'Certification.Silver')"));
    assertFalse(evaluateExpression("matchAnyCertification('Certification.Bronze')"));
    assertTrue(evaluateExpression("!matchAnyCertification('Certification.Bronze')"));
  }

  @Test
  void test_matchTeam() {
    // Create a team hierarchy
    Team team1 = createTeam("team1", null);
    Team team11 = createTeam("team11", "team1");
    Team team12 = createTeam("team12", "team1");
    Team team111 = createTeam("team111", "team11");

    // Resource belongs to team111 and the Policy executed is coming from team111
    table.setOwners(List.of(team111.getEntityReference()));
    updatePolicyContext("team111");
    for (Team team : listOf(team111)) { // For users in team111 hierarchy matchTeam is true
      user.setTeams(listOf(team.getEntityReference()));
      assertTrue(evaluateExpression("matchTeam()"));
    }
    for (Team team :
        listOf(team1, team12, team11)) { // For users not in team111 hierarchy matchTeam is false
      user.setTeams(listOf(team.getEntityReference()));
      assertFalse(evaluateExpression("matchTeam()"), "Failed for team " + team.getName());
    }

    // Resource belongs to team111 and the Policy executed is coming from team11
    updatePolicyContext("team11");
    for (Team team : listOf(team11, team111)) { // For users in team11 hierarchy matchTeam is true
      user.setTeams(listOf(team.getEntityReference()));
      assertTrue(evaluateExpression("matchTeam()"));
    }
    for (Team team :
        listOf(team1, team12)) { // For users not in team11 hierarchy matchTeam is false
      user.setTeams(listOf(team.getEntityReference()));
      assertFalse(evaluateExpression("matchTeam()"), "Failed for team " + team.getName());
    }

    // Resource belongs to team111 and the Policy executed is coming from team1
    updatePolicyContext("team1");
    for (Team team :
        listOf(team1, team11, team111, team12)) { // For users in team1 hierarchy matchTeam is true
      user.setTeams(listOf(team.getEntityReference()));
      assertTrue(evaluateExpression("matchTeam()"));
    }
  }

  @Test
  void test_inAnyTeam() {
    // Create a team hierarchy
    Team team1 = createTeam("team1", null);
    createTeam("team11", "team1");
    Team team12 = createTeam("team12", "team1");
    Team team111 = createTeam("team111", "team11");

    // User in team111 - that means user is also in parent teams team11 and team1
    user.setTeams(listOf(team111.getEntityReference()));
    assertTrue(evaluateExpression("inAnyTeam('team1')"));
    assertTrue(evaluateExpression("inAnyTeam('team11')"));
    assertTrue(evaluateExpression("inAnyTeam('team111')"));
    assertFalse(evaluateExpression("inAnyTeam('team12')"));

    // User in team12 - that means user is also in parent team team1
    user.setTeams(listOf(team12.getEntityReference()));
    assertTrue(evaluateExpression("inAnyTeam('team1')"));
    assertTrue(evaluateExpression("inAnyTeam('team12')"));
    assertFalse(evaluateExpression("inAnyTeam('team111', 'team11')"));

    // User in team1 with no parents
    user.setTeams(listOf(team1.getEntityReference()));
    assertTrue(evaluateExpression("inAnyTeam('team1')"));
    assertFalse(evaluateExpression("inAnyTeam('team12', 'team11', 'team111')"));
  }

  @Test
  void test_hasAnyRole() {
    // Create a team hierarchy
    Team team1 = createTeamWithRole("team1", null);
    Team team11 = createTeamWithRole("team11", "team1");
    Team team111 = createTeamWithRole("team111", "team11");
    user.setRoles(listOf(createRole("user").getEntityReference()));

    // User in team111 inherits all roles
    user.setTeams(listOf(team111.getEntityReference()));
    for (String role : listOf("user", "team111", "team11", "team1")) {
      assertTrue(evaluateExpression(String.format("hasAnyRole('%s')", role)));
    }

    // User in team11 inherits all roles except team111
    user.setTeams(listOf(team11.getEntityReference()));
    for (String role : listOf("user", "team11", "team1")) {
      assertTrue(evaluateExpression(String.format("hasAnyRole('%s')", role)));
    }

    // User in team1 does not have parent team to inherit from
    user.setTeams(listOf(team1.getEntityReference()));
    for (String role : listOf("user", "team1")) {
      assertTrue(evaluateExpression(String.format("hasAnyRole('%s')", role)));
    }
  }

  private Boolean evaluateExpression(String condition) {
    return parseExpression(condition).getValue(evaluationContext, Boolean.class);
  }

  private List<TagLabel> getTags(String... tags) {
    List<TagLabel> tagLabels = new ArrayList<>();
    for (String tag : tags) {
      tagLabels.add(new TagLabel().withTagFQN(tag));
    }
    return tagLabels;
  }

  private Team createTeam(String teamName, String parentName) {
    UUID teamId = UUID.nameUUIDFromBytes(teamName.getBytes(StandardCharsets.UTF_8));
    Team team = new Team().withName(teamName).withId(teamId);
    if (parentName != null) {
      UUID parentId = UUID.nameUUIDFromBytes(parentName.getBytes(StandardCharsets.UTF_8));
      EntityReference parentTeam =
          Entity.getEntityReferenceById(Entity.TEAM, parentId, Include.NON_DELETED);
      team.setParents(listOf(parentTeam));
    }
    EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.TEAM, team.getId()), team);
    return team;
  }

  private Team createTeamWithRole(String teamName, String parentName) {
    Team team = createTeam(teamName, parentName);
    Role role = createRole(teamName); // Create a role with same name as the teamName
    team.setDefaultRoles(listOf(role.getEntityReference()));
    team.setInheritedRoles(new ArrayList<>());
    for (EntityReference parent : listOrEmpty(team.getParents())) {
      Team parentTeam =
          Entity.getEntity(Entity.TEAM, parent.getId(), TEAM_FIELDS, Include.NON_DELETED);
      team.getInheritedRoles().addAll(listOrEmpty(parentTeam.getDefaultRoles()));
      team.getInheritedRoles().addAll(listOrEmpty(parentTeam.getInheritedRoles()));
    }
    return team;
  }

  private Role createRole(String roleName) {
    UUID roleId = UUID.nameUUIDFromBytes(roleName.getBytes(StandardCharsets.UTF_8));
    Role role = new Role().withName(roleName).withId(roleId);
    EntityRepository.CACHE_WITH_ID.put(new ImmutablePair<>(Entity.ROLE, role.getId()), role);
    return role;
  }

  private void updatePolicyContext(String team) {
    PolicyContext policyContext = new PolicyContext(Entity.TEAM, team, null, null, null);
    RuleEvaluator ruleEvaluator = new RuleEvaluator(policyContext, subjectContext, resourceContext);
    evaluationContext = new StandardEvaluationContext(ruleEvaluator);
  }

  @Test
  void test_hasDomain() {
    // Create domain hierarchy with proper FQN setup
    Domain rootDomain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("Engineering")
            .withFullyQualifiedName("Engineering");

    Domain subDomain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("Backend")
            .withFullyQualifiedName("Engineering.Backend")
            .withParent(rootDomain.getEntityReference());

    Domain subSubDomain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("APIs")
            .withFullyQualifiedName("Engineering.Backend.APIs")
            .withParent(subDomain.getEntityReference());

    Domain unrelatedDomain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("Marketing")
            .withFullyQualifiedName("Marketing");

    // Cache domains for Entity.getEntity calls
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, rootDomain.getId()), rootDomain);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, subDomain.getId()), subDomain);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, subSubDomain.getId()), subSubDomain);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, unrelatedDomain.getId()), unrelatedDomain);

    // Test 1: User with no domains should not have access
    user.setDomains(null);
    table.setDomains(List.of(rootDomain.getEntityReference()));
    assertFalse(evaluateExpression("hasDomain()"));
    assertTrue(evaluateExpression("!hasDomain()"));

    // Test 2: User with direct domain access
    user.setDomains(List.of(rootDomain.getEntityReference()));
    table.setDomains(List.of(rootDomain.getEntityReference()));
    assertTrue(evaluateExpression("hasDomain()"));
    assertFalse(evaluateExpression("!hasDomain()"));

    // Test 3: User with parent domain should have access to sub-domain resources
    user.setDomains(List.of(rootDomain.getEntityReference()));
    table.setDomains(List.of(subDomain.getEntityReference()));
    assertTrue(evaluateExpression("hasDomain()"));
    assertFalse(evaluateExpression("!hasDomain()"));

    // Test 4: User with parent domain should have access to nested sub-domain resources
    user.setDomains(List.of(rootDomain.getEntityReference()));
    table.setDomains(List.of(subSubDomain.getEntityReference()));
    assertTrue(evaluateExpression("hasDomain()"));
    assertFalse(evaluateExpression("!hasDomain()"));

    // Test 5: User should not have access to unrelated domains
    user.setDomains(List.of(rootDomain.getEntityReference()));
    table.setDomains(List.of(unrelatedDomain.getEntityReference()));
    assertFalse(evaluateExpression("hasDomain()"));
    assertTrue(evaluateExpression("!hasDomain()"));

    // Test 6: User with multiple domains
    user.setDomains(
        Arrays.asList(rootDomain.getEntityReference(), unrelatedDomain.getEntityReference()));
    table.setDomains(List.of(subDomain.getEntityReference()));
    assertTrue(evaluateExpression("hasDomain()"));

    // Test 7: Resource with no domains - everyone has access
    user.setDomains(List.of(rootDomain.getEntityReference()));
    table.setDomains(null);
    assertTrue(evaluateExpression("hasDomain()"));

    // Test 8: Resource with multiple domains
    user.setDomains(List.of(rootDomain.getEntityReference()));
    table.setDomains(
        Arrays.asList(subDomain.getEntityReference(), unrelatedDomain.getEntityReference()));
    assertTrue(evaluateExpression("hasDomain()"));
  }

  @Test
  void test_hasDomain_withComplexHierarchy() {
    // Create a more complex domain hierarchy with proper FQNs
    Domain company =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("Company")
            .withFullyQualifiedName("Company");

    Domain engineering =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("Engineering")
            .withFullyQualifiedName("Company.Engineering")
            .withParent(company.getEntityReference());

    Domain dataEngineering =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("DataEngineering")
            .withFullyQualifiedName("Company.Engineering.DataEngineering")
            .withParent(engineering.getEntityReference());

    Domain analytics =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("Analytics")
            .withFullyQualifiedName("Company.Analytics")
            .withParent(company.getEntityReference());

    // Cache domains
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, company.getId()), company);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, engineering.getId()), engineering);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, dataEngineering.getId()), dataEngineering);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, analytics.getId()), analytics);

    // Test: User with Engineering domain should have access to DataEngineering resources
    user.setDomains(List.of(engineering.getEntityReference()));
    table.setDomains(List.of(dataEngineering.getEntityReference()));
    assertTrue(evaluateExpression("hasDomain()"));

    // Test: User with Engineering domain should NOT have access to Analytics resources
    user.setDomains(List.of(engineering.getEntityReference()));
    table.setDomains(List.of(analytics.getEntityReference()));
    assertFalse(evaluateExpression("hasDomain()"));

    // Test: User with Company domain should have access to all sub-domains
    user.setDomains(List.of(company.getEntityReference()));
    table.setDomains(List.of(dataEngineering.getEntityReference()));
    assertTrue(evaluateExpression("hasDomain()"));

    table.setDomains(List.of(analytics.getEntityReference()));
    assertTrue(evaluateExpression("hasDomain()"));
  }

  @Test
  void test_hasDomain_hierarchicalAccess_parentDomainUsersCanAccessSubDomainResources() {
    // This test explicitly demonstrates that hasDomain() includes hierarchical access
    // where users with parent domain access can access resources in sub-domains

    // Create domain hierarchy: Finance -> Finance.Accounting -> Finance.Accounting.Payroll
    Domain financeDomain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("Finance")
            .withFullyQualifiedName("Finance");

    Domain accountingDomain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("Accounting")
            .withFullyQualifiedName("Finance.Accounting")
            .withParent(financeDomain.getEntityReference());

    Domain payrollDomain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("Payroll")
            .withFullyQualifiedName("Finance.Accounting.Payroll")
            .withParent(accountingDomain.getEntityReference());

    // Cache domains for Entity.getEntity calls
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, financeDomain.getId()), financeDomain);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, accountingDomain.getId()), accountingDomain);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.DOMAIN, payrollDomain.getId()), payrollDomain);

    // MAIN TEST: User with Finance domain access should have access to Payroll resources
    // This is the core functionality - parent domain users can access sub-domain resources
    EntityReference financeRef = financeDomain.getEntityReference();
    EntityReference payrollRef = payrollDomain.getEntityReference();
    EntityReference accountingRef = accountingDomain.getEntityReference();

    user.setDomains(List.of(financeRef));
    table.setDomains(List.of(payrollRef));

    // This assertion proves that hasDomain() checks sub-domains hierarchically
    assertTrue(
        evaluateExpression("hasDomain()"),
        "User with Finance domain should have access to Finance.Accounting.Payroll resources");

    // Also test with intermediate domain
    table.setDomains(List.of(accountingRef));
    assertTrue(
        evaluateExpression("hasDomain()"),
        "User with Finance domain should have access to Finance.Accounting resources");

    // Test the opposite - user with sub-domain should NOT have access to parent domain resources
    user.setDomains(List.of(payrollRef));
    table.setDomains(List.of(financeRef));
    assertFalse(
        evaluateExpression("hasDomain()"),
        "User with Payroll domain should NOT have access to Finance domain resources");

    // Test with policy expression combinations
    user.setDomains(List.of(financeRef));
    table.setDomains(List.of(payrollRef));

    // Set up table with proper owner to test complex expressions
    table.setOwners(List.of(user.getEntityReference()));
    assertTrue(
        evaluateExpression("hasDomain() && !noOwner()"),
        "Complex expression with hasDomain should work for sub-domain access");

    // Test with no owner
    table.setOwners(null);
    assertTrue(
        evaluateExpression("hasDomain() || noOwner()"),
        "hasDomain should work correctly in OR expressions");
  }

  @AfterEach
  void resetContext() {
    subjectContext = new SubjectContext(user);
    RuleEvaluator ruleEvaluator = new RuleEvaluator(null, subjectContext, resourceContext);
    evaluationContext = new StandardEvaluationContext(ruleEvaluator);
    LOG.info("Context reset to default state after test completion.");
  }
}
