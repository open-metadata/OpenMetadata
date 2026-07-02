package org.openmetadata.service.rdf.inference;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;

/**
 * Failure-mode coverage for {@link InferenceRuleValidator}. Each test exercises a way the
 * validator must reject a hostile or malformed rule before it can be applied server-side.
 */
class InferenceRuleValidatorTest {

  private static final String VALID_BODY =
      "PREFIX om: <https://open-metadata.org/ontology/>\n"
          + "CONSTRUCT { ?x om:transitivelyDerivedFrom ?y }\n"
          + "WHERE { ?x <http://www.w3.org/ns/prov#wasDerivedFrom>+ ?y . FILTER(?x != ?y) }";

  private static InferenceRule rule(String name, String body) {
    return new InferenceRule()
        .withName(name)
        .withRuleType(InferenceRule.RuleType.CONSTRUCT)
        .withRuleBody(body)
        .withEnabled(true)
        .withPriority(100);
  }

  private static List<String> validate(InferenceRule rule) {
    return InferenceRuleValidator.validate(rule);
  }

  @Nested
  @DisplayName("Required fields")
  class RequiredFields {

    @Test
    @DisplayName("Null rule produces a single error")
    void nullRuleRejected() {
      List<String> errors = validate(null);
      assertFalse(errors.isEmpty());
      assertTrue(errors.get(0).contains("must not be null"));
    }

    @Test
    @DisplayName("Blank name is rejected")
    void blankNameRejected() {
      assertTrue(
          validate(rule("", VALID_BODY)).stream()
              .anyMatch(e -> e.contains("'name' must not be blank")));
    }

    @Test
    @DisplayName("Name with uppercase or spaces is rejected (must match the schema pattern)")
    void invalidNamePatternRejected() {
      assertTrue(
          validate(rule("MyRule", VALID_BODY)).stream()
              .anyMatch(e -> e.contains("name") && e.contains("lowercase")));
      assertTrue(
          validate(rule("my rule", VALID_BODY)).stream()
              .anyMatch(e -> e.contains("name") && e.contains("lowercase")));
      assertTrue(
          validate(rule("a", VALID_BODY)).stream()
              .anyMatch(e -> e.contains("name") && e.contains("3-64")));
    }

    @Test
    @DisplayName("Blank ruleBody is rejected")
    void blankBodyRejected() {
      assertTrue(
          validate(rule("good-name", "")).stream()
              .anyMatch(e -> e.contains("'ruleBody' must not be blank")));
    }
  }

  @Nested
  @DisplayName("RuleType handling")
  class RuleTypeHandling {

    @Test
    @DisplayName("RDFS ruleType is rejected (reserved for future)")
    void rdfsTypeRejected() {
      InferenceRule r = rule("future-rdfs", VALID_BODY).withRuleType(InferenceRule.RuleType.RDFS);
      assertTrue(validate(r).stream().anyMatch(e -> e.contains("RDFS is reserved for future use")));
    }
  }

  @Nested
  @DisplayName("SPARQL body shape")
  class SparqlBodyShape {

    @Test
    @DisplayName("Garbage SPARQL is rejected with a parse error")
    void parseError() {
      List<String> errors = validate(rule("bad-syntax", "this is not sparql"));
      assertTrue(errors.stream().anyMatch(e -> e.startsWith("ruleBody failed to parse as SPARQL")));
    }

    @Test
    @DisplayName("SELECT body is rejected — must be CONSTRUCT for ruleType=CONSTRUCT")
    void selectBodyRejected() {
      String selectBody = "SELECT ?s WHERE { ?s ?p ?o }";
      assertTrue(
          validate(rule("must-be-construct", selectBody)).stream()
              .anyMatch(e -> e.contains("must be a SPARQL CONSTRUCT query")));
    }

    @Test
    @DisplayName("ASK body is rejected")
    void askBodyRejected() {
      String askBody = "ASK { ?s ?p ?o }";
      assertTrue(
          validate(rule("ask-not-allowed", askBody)).stream()
              .anyMatch(e -> e.contains("must be a SPARQL CONSTRUCT")));
    }

    @Test
    @DisplayName("DESCRIBE body is rejected")
    void describeBodyRejected() {
      String describeBody = "DESCRIBE <https://open-metadata.org/entity/table/abc>";
      assertTrue(
          validate(rule("describe-not-allowed", describeBody)).stream()
              .anyMatch(e -> e.contains("must be a SPARQL CONSTRUCT")));
    }

    @Test
    @DisplayName("CONSTRUCT with empty WHERE pattern is rejected")
    void emptyWherePatternRejected() {
      String emptyWhere = "CONSTRUCT { <urn:s> <urn:p> <urn:o> } WHERE { }";
      List<String> errors = validate(rule("empty-where", emptyWhere));
      assertTrue(
          errors.stream().anyMatch(e -> e.contains("non-empty WHERE pattern")), "Got: " + errors);
    }

    @Test
    @DisplayName("CONSTRUCT with empty template is rejected")
    void emptyTemplateRejected() {
      String emptyTemplate = "CONSTRUCT { } WHERE { ?s ?p ?o }";
      assertTrue(
          validate(rule("empty-template", emptyTemplate)).stream()
              .anyMatch(e -> e.contains("CONSTRUCT template must contain at least one triple")));
    }
  }

  @Nested
  @DisplayName("SERVICE rejection")
  class ServiceRejection {

    @Test
    @DisplayName("CONSTRUCT body containing a SERVICE clause is rejected")
    void serviceClauseRejected() {
      String body =
          "CONSTRUCT { ?s ?p ?o } WHERE { SERVICE <https://attacker.example/sparql> { ?s ?p ?o } }";
      List<String> errors = validate(rule("federated-rule", body));
      assertTrue(
          errors.stream().anyMatch(e -> e.contains("must not contain SERVICE clauses")),
          "Got: " + errors);
    }

    @Test
    @DisplayName("SERVICE inside a subquery is also rejected")
    void serviceInSubqueryRejected() {
      String body =
          "CONSTRUCT { ?s ?p ?o } WHERE { { SELECT ?s ?p ?o WHERE { SERVICE <https://attacker.example/sparql> { ?s ?p ?o } } } }";
      assertTrue(
          validate(rule("nested-service", body)).stream()
              .anyMatch(e -> e.contains("must not contain SERVICE clauses")));
    }
  }

  @Nested
  @DisplayName("Priority bounds")
  class PriorityBounds {

    @Test
    @DisplayName("Priority below 0 is rejected")
    void negativePriorityRejected() {
      InferenceRule r = rule("low-pri", VALID_BODY).withPriority(-1);
      assertTrue(
          validate(r).stream().anyMatch(e -> e.contains("'priority' must be between 0 and 10000")));
    }

    @Test
    @DisplayName("Priority above 10000 is rejected")
    void highPriorityRejected() {
      InferenceRule r = rule("high-pri", VALID_BODY).withPriority(10_001);
      assertTrue(validate(r).stream().anyMatch(e -> e.contains("'priority' must be between")));
    }
  }

  @Nested
  @DisplayName("Happy path")
  class HappyPath {

    @Test
    @DisplayName("Well-formed CONSTRUCT rule passes validation with no errors")
    void validRulePasses() {
      InferenceRule r = rule("transitive-lineage", VALID_BODY);
      List<String> errors = validate(r);
      assertTrue(errors.isEmpty(), "Expected no errors but got: " + errors);
    }
  }

  @Nested
  @DisplayName("Starter pack rules ship valid")
  class StarterPackValidation {

    @Test
    @DisplayName("All shipped starter-pack rules pass validation")
    void starterPackValid() {
      InferenceRuleRegistry registry = InferenceRuleRegistry.getInstance();
      registry.loadStarterPackIfNeeded();
      List<InferenceRule> rules = registry.list();
      assertTrue(rules.size() >= 4, "Starter pack must ship at least 4 rules");
      for (InferenceRule rule : rules) {
        List<String> errors = validate(rule);
        assertTrue(
            errors.isEmpty(),
            "Starter pack rule '" + rule.getName() + "' must validate cleanly. Got: " + errors);
      }
    }
  }
}
