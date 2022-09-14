package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.TeamDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.UserDAO;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.spel.support.StandardEvaluationContext;

class RuleEvaluatorTest {
  private static Table table;
  private static User user;
  private static EvaluationContext evaluationContext;

  @BeforeAll
  public static void setup() throws NoSuchMethodException {
    Entity.registerEntity(User.class, Entity.USER, Mockito.mock(UserDAO.class), Mockito.mock(UserRepository.class));
    Entity.registerEntity(Team.class, Entity.TEAM, Mockito.mock(TeamDAO.class), Mockito.mock(TeamRepository.class));
    table = new Table().withName("table");
    user = new User().withId(UUID.randomUUID()).withName("user");
    ResourceContext resourceContext =
        ResourceContext.builder()
            .resource("table")
            .entity(table)
            .entityRepository(Mockito.mock(TableRepository.class))
            .build();
    SubjectContext subjectContext = new SubjectContext(user);
    RuleEvaluator ruleEvaluator = new RuleEvaluator(null, subjectContext, resourceContext);
    evaluationContext = new StandardEvaluationContext(ruleEvaluator);
  }

  @Test
  void test_noOwner() {
    // Set no owner to the entity and test noOwner method
    table.setOwner(null);
    assertEquals(Boolean.TRUE, evaluateExpression("noOwner()"));
    assertNotEquals(Boolean.TRUE, evaluateExpression("!noOwner()"));

    // Set owner to the entity and test noOwner method
    table.setOwner(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER));
    assertNotEquals(Boolean.TRUE, evaluateExpression("noOwner()"));
    assertEquals(Boolean.TRUE, evaluateExpression("!noOwner()"));
  }

  @Test
  void test_isOwner() {
    // Table owner is a different user (random ID) and hence isOwner returns false
    table.setOwner(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("otherUser"));
    assertNotEquals(Boolean.TRUE, evaluateExpression("isOwner()"));
    assertEquals(Boolean.TRUE, evaluateExpression("!isOwner()"));

    // Table owner is same as the user in subjectContext and hence isOwner returns true
    table.setOwner(new EntityReference().withId(user.getId()).withType(Entity.USER).withName(user.getName()));
    assertEquals(Boolean.TRUE, evaluateExpression("isOwner()"));
    assertNotEquals(Boolean.TRUE, evaluateExpression("!isOwner()"));

    // noOwner() || isOwner() - with noOwner being true and isOwner false
    table.setOwner(null);
    assertEquals(Boolean.TRUE, evaluateExpression("noOwner() || isOwner()"));
    assertNotEquals(Boolean.TRUE, evaluateExpression("!noOwner() && !isOwner()"));

    // noOwner() || isOwner() - with noOwner is false and isOwner true
    table.setOwner(new EntityReference().withId(user.getId()).withType(Entity.USER).withName(user.getName()));
    assertEquals(Boolean.TRUE, evaluateExpression("noOwner() || isOwner()"));
    assertNotEquals(Boolean.TRUE, evaluateExpression("!noOwner() && !isOwner()"));
  }

  @Test
  void test_allTagsOrAnyTag() {
    // All tags present
    table.withTags(getTags("tag1", "tag2", "tag3"));
    assertEquals(Boolean.TRUE, evaluateExpression("matchAllTags('tag1', 'tag2', 'tag3')"));
    assertNotEquals(Boolean.TRUE, evaluateExpression("!matchAllTags('tag1', 'tag2', 'tag3')"));

    // One tag `tag4` is missing
    table.withTags(getTags("tag1", "tag2", "tag4"));
    assertNotEquals(Boolean.TRUE, evaluateExpression("matchAllTags('tag1', 'tag2', 'tag3')"));
    assertEquals(Boolean.TRUE, evaluateExpression("!matchAllTags('tag1', 'tag2', 'tag3')"));

    // Tag `tag1` is present
    assertEquals(Boolean.TRUE, evaluateExpression("matchAnyTag('tag1')"));
    assertNotEquals(Boolean.TRUE, evaluateExpression("!matchAnyTag('tag1')"));

    // Tag `tag4` is not present
    assertEquals(Boolean.TRUE, evaluateExpression("matchAnyTag('tag4')"));
    assertNotEquals(Boolean.TRUE, evaluateExpression("!matchAnyTag('tag4')"));
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
}
