package org.openmetadata.service.rdf.inference;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryException;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.sparql.syntax.ElementService;
import org.apache.jena.sparql.syntax.ElementSubQuery;
import org.apache.jena.sparql.syntax.ElementVisitorBase;
import org.apache.jena.sparql.syntax.ElementWalker;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;

/**
 * Validates {@link InferenceRule} payloads before they are accepted or executed.
 *
 * <p>The validator is intentionally strict — admins write these rules and they run server-side
 * against the whole graph, so a malformed or hostile rule has wide blast radius.
 *
 * <p>Checks performed:
 *
 * <ol>
 *   <li>The rule has a non-blank name and rule body.
 *   <li>The body parses as a SPARQL Query (rejects SPARQL UPDATE — those are emitted via the
 *       resulting CONSTRUCT triples, not by the rule body itself).
 *   <li>For {@code ruleType=CONSTRUCT}, the parsed query must be CONSTRUCT type. SELECT, ASK,
 *       and DESCRIBE rules are rejected — they don't produce inferable triples.
 *   <li>The body must not contain any SERVICE clauses. Inference must be deterministic and run
 *       against the local graph; federated lookups are rejected.
 *   <li>The body must not be a no-op CONSTRUCT (empty WHERE) — those would either produce
 *       nothing or, with ASK semantics, blow up.
 *   <li>Priority is within bounds.
 * </ol>
 */
@Slf4j
public final class InferenceRuleValidator {

  private InferenceRuleValidator() {}

  /** @return the list of validation errors. Empty list means the rule is valid. */
  public static List<String> validate(InferenceRule rule) {
    List<String> errors = new ArrayList<>();
    if (rule == null) {
      errors.add("rule must not be null");
    } else {
      validateMetadata(rule, errors);
      if (errors.isEmpty()) {
        parse(rule.getRuleBody(), errors).ifPresent(query -> validateConstructQuery(query, errors));
      }
    }
    return errors;
  }

  static void requireValid(final InferenceRule rule, final String context) {
    final List<String> errors = validate(rule);
    if (!errors.isEmpty()) {
      throw new IllegalArgumentException(
          "Invalid inference rule '%s': %s".formatted(context, String.join("; ", errors)));
    }
  }

  private static void validateMetadata(InferenceRule rule, List<String> errors) {
    if (isBlank(rule.getName())) {
      errors.add("'name' must not be blank");
    } else if (!rule.getName().matches("^[a-z][a-z0-9-]{1,62}[a-z0-9]$")) {
      errors.add(
          "'name' must be 3-64 chars, lowercase letters / digits / hyphen, start with a letter, end with a letter or digit");
    }
    if (isBlank(rule.getRuleBody())) {
      errors.add("'ruleBody' must not be blank");
    }
    InferenceRule.RuleType ruleType =
        rule.getRuleType() == null ? InferenceRule.RuleType.CONSTRUCT : rule.getRuleType();
    if (ruleType == InferenceRule.RuleType.RDFS) {
      errors.add(
          "ruleType=RDFS is reserved for future use; current engine only ships CONSTRUCT support");
    }
    if (rule.getPriority() != null && (rule.getPriority() < 0 || rule.getPriority() > 10_000)) {
      errors.add("'priority' must be between 0 and 10000");
    }
  }

  private static Optional<Query> parse(String ruleBody, List<String> errors) {
    Optional<Query> query = Optional.empty();
    try {
      query = Optional.of(QueryFactory.create(ruleBody));
    } catch (QueryException exception) {
      errors.add("ruleBody failed to parse as SPARQL: " + exception.getMessage());
    }
    return query;
  }

  private static void validateConstructQuery(Query query, List<String> errors) {
    if (!query.isConstructType()) {
      errors.add(
          "ruleBody must be a SPARQL CONSTRUCT query for ruleType=CONSTRUCT (got "
              + query.queryType()
              + "); inference rules emit new triples and only CONSTRUCT does that");
    } else {
      validateConstructStructure(query, errors);
    }
  }

  private static void validateConstructStructure(Query query, List<String> errors) {
    if (query.getQueryPattern() == null || isEmptyPattern(query.getQueryPattern().toString())) {
      errors.add("ruleBody must have a non-empty WHERE pattern");
    }
    if (query.getConstructTemplate() == null
        || query.getConstructTemplate().getTriples().isEmpty()) {
      errors.add("ruleBody CONSTRUCT template must contain at least one triple pattern");
    }
    if (containsServiceClause(query)) {
      errors.add(
          "ruleBody must not contain SERVICE clauses; inference is local-only and federated rules are rejected");
    }
    validateMaterializationCompatibility(query, errors);
  }

  private static void validateMaterializationCompatibility(
      final Query query, final List<String> errors) {
    if (query.hasDatasetDescription()) {
      errors.add("ruleBody must not contain FROM or FROM NAMED dataset clauses");
    }
    if (query.hasLimit() || query.hasOffset() || query.hasOrderBy()) {
      errors.add("ruleBody must not contain top-level LIMIT, OFFSET, or ORDER BY modifiers");
    }
    if (query.hasGroupBy() || query.hasHaving() || query.hasValues()) {
      errors.add("ruleBody must not contain top-level GROUP BY, HAVING, or VALUES modifiers");
    }
  }

  private static boolean containsServiceClause(Query query) {
    ServiceFinder serviceFinder = new ServiceFinder();
    if (query.getQueryPattern() != null) {
      ElementWalker.walk(query.getQueryPattern(), serviceFinder);
    }
    return serviceFinder.found;
  }

  /**
   * @return true if the rule passed validation; false otherwise. Errors are logged at WARN.
   */
  public static boolean isValid(InferenceRule rule) {
    List<String> errors = validate(rule);
    if (!nullOrEmpty(errors)) {
      LOG.warn(
          "Inference rule '{}' failed validation: {}",
          rule == null ? "<null>" : rule.getName(),
          errors);
    }
    return errors.isEmpty();
  }

  private static boolean isBlank(String s) {
    return nullOrEmpty(s) || s.isBlank();
  }

  private static boolean isEmptyPattern(String pattern) {
    String trimmed = pattern.replaceAll("\\s", "");
    return trimmed.isEmpty() || trimmed.equals("{}");
  }

  private static final class ServiceFinder extends ElementVisitorBase {
    boolean found;

    @Override
    public void visit(ElementService el) {
      found = true;
    }

    @Override
    public void visit(ElementSubQuery el) {
      if (el.getQuery() != null && el.getQuery().getQueryPattern() != null) {
        ElementWalker.walk(el.getQuery().getQueryPattern(), this);
      }
    }
  }
}
