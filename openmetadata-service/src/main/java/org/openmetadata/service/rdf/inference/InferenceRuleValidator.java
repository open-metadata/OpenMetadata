package org.openmetadata.service.rdf.inference;

import java.util.ArrayList;
import java.util.List;
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
 * <p>Checks performed (in order; first failing check returns):
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
      return errors;
    }
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
      // RDFS is a placeholder — the engine doesn't ship a parser for that body shape yet.
      errors.add(
          "ruleType=RDFS is reserved for future use; current engine only ships CONSTRUCT support");
      return errors;
    }
    if (rule.getPriority() != null && (rule.getPriority() < 0 || rule.getPriority() > 10_000)) {
      errors.add("'priority' must be between 0 and 10000");
    }
    if (!errors.isEmpty()) {
      return errors;
    }

    Query parsed;
    try {
      parsed = QueryFactory.create(rule.getRuleBody());
    } catch (QueryException e) {
      errors.add("ruleBody failed to parse as SPARQL: " + e.getMessage());
      return errors;
    }
    if (!parsed.isConstructType()) {
      errors.add(
          "ruleBody must be a SPARQL CONSTRUCT query for ruleType=CONSTRUCT (got "
              + parsed.queryType()
              + "); inference rules emit new triples and only CONSTRUCT does that");
      return errors;
    }
    if (parsed.getQueryPattern() == null || isEmptyPattern(parsed.getQueryPattern().toString())) {
      errors.add("ruleBody must have a non-empty WHERE pattern");
    }
    if (parsed.getConstructTemplate() == null
        || parsed.getConstructTemplate().getTriples().isEmpty()) {
      errors.add("ruleBody CONSTRUCT template must contain at least one triple pattern");
    }
    ServiceFinder serviceFinder = new ServiceFinder();
    if (parsed.getQueryPattern() != null) {
      ElementWalker.walk(parsed.getQueryPattern(), serviceFinder);
    }
    if (serviceFinder.found) {
      errors.add(
          "ruleBody must not contain SERVICE clauses; inference is local-only and federated rules are rejected");
    }
    return errors;
  }

  /**
   * @return true if the rule passed validation; false otherwise. Errors are logged at WARN.
   */
  public static boolean isValid(InferenceRule rule) {
    List<String> errors = validate(rule);
    if (!errors.isEmpty()) {
      LOG.warn(
          "Inference rule '{}' failed validation: {}",
          rule == null ? "<null>" : rule.getName(),
          errors);
    }
    return errors.isEmpty();
  }

  private static boolean isBlank(String s) {
    return s == null || s.isBlank();
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
