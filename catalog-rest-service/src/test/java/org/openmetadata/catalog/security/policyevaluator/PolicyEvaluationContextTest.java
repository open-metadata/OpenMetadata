package org.openmetadata.catalog.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.jdbi3.CollectionDAO.TeamDAO;
import org.openmetadata.catalog.jdbi3.CollectionDAO.UserDAO;
import org.openmetadata.catalog.jdbi3.TableRepository;
import org.openmetadata.catalog.jdbi3.TeamRepository;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.type.EntityReference;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;

class PolicyEvaluationContextTest {
  private static SpelExpressionParser expressionParser;
  private static Table table;
  private static User user;
  private static ResourceContext resourceContext;
  private static SubjectContext subjectContext;

  @BeforeAll
  public static void setup() throws NoSuchMethodException {
    Entity.registerEntity(User.class, Entity.USER, Mockito.mock(UserDAO.class), Mockito.mock(UserRepository.class));
    Entity.registerEntity(Team.class, Entity.TEAM, Mockito.mock(TeamDAO.class), Mockito.mock(TeamRepository.class));
    expressionParser = new SpelExpressionParser();
    table = new Table().withName("table");
    user = new User().withId(UUID.randomUUID()).withName("user");
    resourceContext =
        ResourceContext.builder()
            .resource("table")
            .entity(table)
            .entityRepository(Mockito.mock(TableRepository.class))
            .build();
    subjectContext = new SubjectContext(user);
  }

  @Test
  void test_noOwner() {
    // Set no owner to the entity and test noOwner method
    PolicyEvaluationContext policyContext = new PolicyEvaluationContext(null, subjectContext, resourceContext);
    StandardEvaluationContext evaluationContext = new StandardEvaluationContext(policyContext);
    table.setOwner(null);
    assertTrue(expressionParser.parseExpression("noOwner()").getValue(evaluationContext, Boolean.class));

    // Set owner to the entity and test noOwner method
    table.setOwner(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER));
    assertFalse(expressionParser.parseExpression("noOwner()").getValue(evaluationContext, Boolean.class));
  }

  @Test
  void test_isOwner() {
    PolicyEvaluationContext policyContext = new PolicyEvaluationContext(null, subjectContext, resourceContext);
    StandardEvaluationContext evaluationContext = new StandardEvaluationContext(policyContext);

    // Table owner is a different user (random ID) and hence isOwner returns false
    table.setOwner(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("otherUser"));
    assertFalse(expressionParser.parseExpression("isOwner()").getValue(evaluationContext, Boolean.class));

    // Table owner is same as the user in subjectContext and hence isOwner returns true
    table.setOwner(new EntityReference().withId(user.getId()).withType(Entity.USER).withName(user.getName()));
    assertTrue(expressionParser.parseExpression("isOwner()").getValue(evaluationContext, Boolean.class));

    // noOwner() || isOwner() - with noOwner being true and isOwner false
    table.setOwner(null);
    assertTrue(expressionParser.parseExpression("noOwner() || isOwner()").getValue(evaluationContext, Boolean.class));

    // noOwner() || isOwner() - with noOwner is false and isOwner true
    table.setOwner(new EntityReference().withId(user.getId()).withType(Entity.USER).withName(user.getName()));
    assertTrue(expressionParser.parseExpression("noOwner() || isOwner()").getValue(evaluationContext, Boolean.class));
  }
}
