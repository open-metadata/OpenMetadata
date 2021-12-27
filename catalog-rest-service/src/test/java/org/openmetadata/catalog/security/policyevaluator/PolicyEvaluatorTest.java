package org.openmetadata.catalog.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.ImmutableList;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.jdbi3.TeamRepository;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.TagLabel;

public class PolicyEvaluatorTest {

  // User Roles
  private static final String DATA_CONSUMER = "DataConsumer";
  private static final String DATA_STEWARD = "DataSteward";
  private static final String AUDITOR = "Auditor";
  private static final String LEGAL = "Legal";
  private static final String DEV_OPS = "DevOps";

  // Tags
  private static final String PII_SENSITIVE = "PII.Sensitive";

  private static Random random = new Random();
  private static List<Rule> rules;
  private PolicyEvaluator policyEvaluator;

  @BeforeAll
  static void setup() {
    rules = new ArrayList<>();
    rules.add(createRule(null, "table", DATA_STEWARD, MetadataOperation.UpdateOwner, true, 1, true));
    rules.add(createRule(PII_SENSITIVE, null, LEGAL, MetadataOperation.UpdateTags, true, 2, true));
    rules.add(createRule(PII_SENSITIVE, null, DATA_CONSUMER, MetadataOperation.SuggestTags, true, 3, true));
    rules.add(createRule(null, null, DATA_CONSUMER, MetadataOperation.SuggestDescription, true, 4, true));
    rules.add(createRule(null, null, DEV_OPS, MetadataOperation.UpdateTags, true, 5, false)); // disabled rule.
    rules.add(createRule(null, null, DEV_OPS, MetadataOperation.UpdateTags, false, 6, true));
    rules.add(createRule(null, null, DEV_OPS, MetadataOperation.UpdateDescription, false, 7, true));
    rules.add(createRule(null, null, DEV_OPS, MetadataOperation.SuggestDescription, true, 8, true));
  }

  @BeforeEach
  void beforeEach() {
    Collections.shuffle(rules); // Shuffle in an attempt to throw off the PolicyEvaluator if the logic is incorrect.
    policyEvaluator = new PolicyEvaluator(rules);
  }

  @Test
  public void dataConsumer_cannot_update_owner() {
    User dataConsumer = createUser(ImmutableList.of(DATA_CONSUMER));
    Table table = createTable();
    boolean hasPermission = policyEvaluator.hasPermission(dataConsumer, table, MetadataOperation.UpdateOwner);
    assertFalse(hasPermission);
  }

  @Test
  public void dataSteward_can_update_owner() {
    User dataConsumer = createUser(ImmutableList.of(DATA_STEWARD));
    Table table = createTable();
    boolean hasPermission = policyEvaluator.hasPermission(dataConsumer, table, MetadataOperation.UpdateOwner);
    assertTrue(hasPermission);
  }

  @Test
  public void dataConsumer_can_suggest_description() {
    User dataConsumer = createUser(ImmutableList.of(DATA_CONSUMER));
    Table table = createTable();
    boolean hasPermission = policyEvaluator.hasPermission(dataConsumer, table, MetadataOperation.SuggestDescription);
    assertTrue(hasPermission);
  }

  @Test
  public void legal_can_update_tags_for_pii_tables() {
    User dataConsumer = createUser(ImmutableList.of(LEGAL));
    Table table = createTable();
    boolean hasPermission = policyEvaluator.hasPermission(dataConsumer, table, MetadataOperation.UpdateTags);
    assertTrue(hasPermission);
  }

  @Test
  public void auditor_cannot_update_tags_for_pii_tables() {
    User dataConsumer = createUser(ImmutableList.of(AUDITOR));
    Table table = createTable();
    boolean hasPermission = policyEvaluator.hasPermission(dataConsumer, table, MetadataOperation.UpdateTags);
    assertFalse(hasPermission);
  }

  @Test
  public void devops_can_suggest_description() {
    User dataConsumer = createUser(ImmutableList.of(DEV_OPS));
    Table table = createTable();
    boolean hasPermission = policyEvaluator.hasPermission(dataConsumer, table, MetadataOperation.SuggestDescription);
    assertTrue(hasPermission);
  }

  @Test
  public void devops_cannot_update_description() {
    User dataConsumer = createUser(ImmutableList.of(DEV_OPS));
    Table table = createTable();
    boolean hasPermission = policyEvaluator.hasPermission(dataConsumer, table, MetadataOperation.UpdateDescription);
    assertFalse(hasPermission);
  }

  @Test
  public void devops_cannot_update_tags() {
    User dataConsumer = createUser(ImmutableList.of(DEV_OPS));
    Table table = createTable();
    boolean hasPermission = policyEvaluator.hasPermission(dataConsumer, table, MetadataOperation.UpdateTags);
    assertFalse(hasPermission);
  }

  private static Rule createRule(
      String entityTag,
      String entityType,
      String userRole,
      MetadataOperation operation,
      boolean allow,
      int priority,
      boolean enabled) {
    return new Rule()
        .withName("rule" + random.nextInt(21)) // Create random rule name.
        .withEntityTagAttr(entityTag)
        .withEntityTypeAttr(entityType)
        .withUserRoleAttr(userRole)
        .withOperation(operation)
        .withAllow(allow)
        .withPriority(priority)
        .withEnabled(enabled);
  }

  private User createUser(List<String> teamNames) {
    // TODO: Use role instead of team when user schema is extended to accommodate role.
    List<EntityReference> teams =
        teamNames.stream()
            .map(teamName -> new TeamRepository.TeamEntityInterface(new Team().withName(teamName)).getEntityReference())
            .collect(Collectors.toList());
    return new User().withName("John Doe").withTeams(teams);
  }

  private Table createTable() {
    List<TagLabel> tags = new ArrayList<>();
    tags.add(new TagLabel().withTagFQN(PII_SENSITIVE));
    return new Table().withName("random-table").withTags(tags);
  }
}
