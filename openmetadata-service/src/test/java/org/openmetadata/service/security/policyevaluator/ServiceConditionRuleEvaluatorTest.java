package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.springframework.expression.spel.support.StandardEvaluationContext;

/**
 * The {@code matchAnyService*} conditions as the policy author sees them: expressions evaluated
 * against a resource whose service attributes are known. The plumbing that resolves those
 * attributes from a real entity is covered by {@link ResourceContextTest}, and the translation of
 * the same expressions into a search filter by the RBAC condition evaluator tests.
 */
class ServiceConditionRuleEvaluatorTest {

  private static final String SERVICE_NAME = "snowflake-sandbox";
  private static final String SERVICE_TYPE = "Snowflake";
  private static final String HIDDEN_TAG = "Environment.Development";

  @Test
  void matchAnyServiceTag_true_whenServiceCarriesOneOfTheTags() {
    StandardEvaluationContext context = contextWithServiceTags(HIDDEN_TAG, "Tier.Tier2");

    assertTrue(evaluate("matchAnyServiceTag('Environment.Development')", context));
    assertTrue(evaluate("matchAnyServiceTag('Environment.Staging', 'Tier.Tier2')", context));
    assertFalse(evaluate("!matchAnyServiceTag('Environment.Development')", context));
  }

  @Test
  void matchAnyServiceTag_false_whenServiceCarriesNoneOfTheTags() {
    StandardEvaluationContext context = contextWithServiceTags("Tier.Tier2");

    assertFalse(evaluate("matchAnyServiceTag('Environment.Development')", context));
    assertTrue(evaluate("!matchAnyServiceTag('Environment.Development')", context));
  }

  @Test
  void matchAnyServiceTag_false_whenServiceIsUntagged() {
    assertFalse(
        evaluate("matchAnyServiceTag('Environment.Development')", contextWithServiceTags()));
  }

  /**
   * Glossary terms, users, teams and domains are not ingested by a service, so the predicate is
   * false for them. That keeps a Deny rule from hiding the glossary, and is the same answer the
   * search translation gives, since those search documents carry no service field at all. It does
   * mean an {@code Allow ... on All} rule built from this condition grants nothing for them.
   */
  @Test
  void matchAnyServiceTag_false_whenResourceHasNoService() {
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);
    Mockito.when(resourceContext.getServiceReference()).thenReturn(null);
    Mockito.when(resourceContext.getServiceTags()).thenReturn(List.of());
    Mockito.when(resourceContext.getServiceType()).thenReturn(null);
    StandardEvaluationContext context = evaluationContextFor(resourceContext);

    assertFalse(evaluate("matchAnyServiceTag('Environment.Development')", context));
    assertFalse(evaluate("matchAnyServiceName('snowflake-sandbox')", context));
    assertFalse(evaluate("matchAnyServiceType('Snowflake')", context));
  }

  /** "Any of nothing" is false, so neither an Allow nor a Deny built this way matches anything. */
  @Test
  void serviceConditions_false_withNoArguments() {
    StandardEvaluationContext context = contextWithServiceTags(HIDDEN_TAG);

    assertFalse(evaluate("matchAnyServiceTag()", context));
    assertFalse(evaluate("matchAnyServiceName()", context));
    assertFalse(evaluate("matchAnyServiceType()", context));
  }

  /**
   * The serviceType search mapping carries a lowercase normalizer, which ElasticSearch applies to
   * the query term as well as the indexed one. An exact comparison here would hide assets in search
   * that stayed readable over the API.
   */
  @Test
  void matchAnyServiceType_matchesCaseInsensitively() {
    StandardEvaluationContext context = contextWithServiceTags();

    assertTrue(evaluate("matchAnyServiceType('Snowflake')", context));
    assertTrue(evaluate("matchAnyServiceType('snowflake')", context));
    assertTrue(evaluate("matchAnyServiceType('SNOWFLAKE')", context));
    assertTrue(evaluate("matchAnyServiceType('BigQuery', 'snowflake')", context));
    assertFalse(evaluate("matchAnyServiceType('BigQuery')", context));
  }

  @Test
  void matchAnyServiceName_matchesTheServiceName() {
    StandardEvaluationContext context = contextWithServiceTags();

    assertTrue(evaluate("matchAnyServiceName('snowflake-sandbox')", context));
    assertTrue(evaluate("matchAnyServiceName('redshift-dev', 'snowflake-sandbox')", context));
    assertFalse(evaluate("matchAnyServiceName('redshift-dev')", context));
  }

  /**
   * Services quote their fully qualified name, so a name containing a dot is not its own FQN. The
   * condition takes the raw name, which is also what the {@code service.name} search field holds.
   */
  @Test
  void matchAnyServiceName_takesTheNameNotTheQuotedFqn() {
    EntityReference service =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DATABASE_SERVICE)
            .withName("my.service")
            .withFullyQualifiedName("\"my.service\"");
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);
    Mockito.when(resourceContext.getServiceReference()).thenReturn(service);
    StandardEvaluationContext context = evaluationContextFor(resourceContext);

    assertTrue(evaluate("matchAnyServiceName('my.service')", context));
    assertFalse(evaluate("matchAnyServiceName('\"my.service\"')", context));
  }

  @Test
  void matchAnyServiceEnvironment_matchesTheDeclaredEnvironment() {
    StandardEvaluationContext context = contextWithEnvironment("Development");

    assertTrue(evaluate("matchAnyServiceEnvironment('Development')", context));
    assertTrue(evaluate("matchAnyServiceEnvironment('development')", context), "case-insensitive");
    assertTrue(evaluate("matchAnyServiceEnvironment('Sandbox', 'Development')", context));
    assertFalse(evaluate("matchAnyServiceEnvironment('Production')", context));
  }

  /** The attributes block is optional, so an unset environment must not match anything. */
  @Test
  void matchAnyServiceEnvironment_false_whenEnvironmentIsUnset() {
    StandardEvaluationContext context = contextWithEnvironment(null);

    assertFalse(evaluate("matchAnyServiceEnvironment('Development')", context));
    assertTrue(evaluate("!matchAnyServiceEnvironment('Development')", context));
  }

  @Test
  void serviceConditions_combineWithOtherConditions() {
    StandardEvaluationContext context = contextWithServiceTags(HIDDEN_TAG);

    assertTrue(
        evaluate("matchAnyServiceTag('Environment.Development') || isOwner()", context),
        "an OR should hold on the service branch alone");
    assertFalse(
        evaluate("matchAnyServiceTag('Environment.Development') && isOwner()", context),
        "an AND should fail when the other branch does");
    assertTrue(
        evaluate(
            "matchAnyServiceTag('Environment.Development') && matchAnyServiceType('snowflake')",
            context));
  }

  private static Boolean evaluate(String expression, StandardEvaluationContext context) {
    return parseExpression(expression).getValue(context, Boolean.class);
  }

  /** A resource ingested by {@link #SERVICE_NAME}, whose service carries {@code tagFQNs}. */
  private static StandardEvaluationContext contextWithServiceTags(String... tagFQNs) {
    EntityReference service =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DATABASE_SERVICE)
            .withName(SERVICE_NAME)
            .withFullyQualifiedName(SERVICE_NAME);
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);
    Mockito.when(resourceContext.getServiceReference()).thenReturn(service);
    Mockito.when(resourceContext.getServiceType()).thenReturn(SERVICE_TYPE);
    Mockito.when(resourceContext.getServiceTags())
        .thenReturn(
            java.util.Arrays.stream(tagFQNs).map(fqn -> new TagLabel().withTagFQN(fqn)).toList());
    return evaluationContextFor(resourceContext);
  }

  /** A resource whose service declares {@code environment} (null meaning the admin never set it). */
  private static StandardEvaluationContext contextWithEnvironment(String environment) {
    ResourceContextInterface resourceContext = mock(ResourceContextInterface.class);
    Mockito.when(resourceContext.getServiceEnvironment()).thenReturn(environment);
    return evaluationContextFor(resourceContext);
  }

  private static StandardEvaluationContext evaluationContextFor(
      ResourceContextInterface resourceContext) {
    User user =
        new User().withId(UUID.randomUUID()).withName("user").withFullyQualifiedName("user");
    SubjectContext subjectContext = new SubjectContext(user, null);
    return new StandardEvaluationContext(new RuleEvaluator(null, subjectContext, resourceContext));
  }
}
