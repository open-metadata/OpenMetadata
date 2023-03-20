package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mockito.stubbing.Answer;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.TableDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.TeamDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.UserDAO;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.spel.support.StandardEvaluationContext;

class RuleEvaluatorTest {
  private static Table table = new Table().withName("table");
  private static User user;
  private static EvaluationContext evaluationContext;

  @BeforeAll
  public static void setup() {
    Entity.registerEntity(User.class, Entity.USER, Mockito.mock(UserDAO.class), Mockito.mock(UserRepository.class));
    Entity.registerEntity(Team.class, Entity.TEAM, Mockito.mock(TeamDAO.class), Mockito.mock(TeamRepository.class));

    TableRepository tableRepository = Mockito.mock(TableRepository.class);
    Mockito.when(tableRepository.getAllTags(any()))
        .thenAnswer((Answer<List<TagLabel>>) invocationOnMock -> table.getTags());
    Entity.registerEntity(Table.class, Entity.TABLE, Mockito.mock(TableDAO.class), tableRepository);

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
    assertTrue(evaluateExpression("noOwner()"));
    assertFalse(evaluateExpression("!noOwner()"));

    // Set owner to the entity and test noOwner method
    table.setOwner(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER));
    assertFalse(evaluateExpression("noOwner()"));
    assertTrue(evaluateExpression("!noOwner()"));
  }

  @Test
  void test_isOwner() {
    // Table owner is a different user (random ID) and hence isOwner returns false
    table.setOwner(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("otherUser"));
    assertFalse(evaluateExpression("isOwner()"));
    assertTrue(evaluateExpression("!isOwner()"));

    // Table owner is same as the user in subjectContext and hence isOwner returns true
    table.setOwner(new EntityReference().withId(user.getId()).withType(Entity.USER).withName(user.getName()));
    assertTrue(evaluateExpression("isOwner()"));
    assertFalse(evaluateExpression("!isOwner()"));

    // noOwner() || isOwner() - with noOwner being true and isOwner false
    table.setOwner(null);
    assertTrue(evaluateExpression("noOwner() || isOwner()"));
    assertFalse(evaluateExpression("!noOwner() && !isOwner()"));

    // noOwner() || isOwner() - with noOwner is false and isOwner true
    table.setOwner(new EntityReference().withId(user.getId()).withType(Entity.USER).withName(user.getName()));
    assertTrue(evaluateExpression("noOwner() || isOwner()"));
    assertFalse(evaluateExpression("!noOwner() && !isOwner()"));
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
