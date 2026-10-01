/*
 *  Copyright 2026 Collate
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

package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.vocabulary.OWL;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * The RDF tool descriptions are public: every MCP client reads them. They may only advertise
 * vocabulary the projection really writes, the same contract the ontology tests enforce for the
 * SQL-to-SPARQL mappings.
 */
class RdfToolDescriptionVocabularyTest {

  private static final String OM = "https://open-metadata.org/ontology/";
  private static final Set<String> RDF_TOOLS =
      Set.of(
          "sparql_query",
          "entity_neighborhood",
          "find_by_tag",
          "shacl_validate",
          "ontology_describe");
  private static final Set<String> QUERY_PERMISSION_TOOLS =
      Set.of("sparql_query", "entity_neighborhood", "find_by_tag", "ontology_describe");
  private static final int SPARQL_QUERY_DESCRIPTION_BUDGET = 3_000;
  private static final Pattern OM_TERM = Pattern.compile("\\bom:([A-Za-z][A-Za-z0-9]*)");
  private static final Pattern COLUMN_LINEAGE_QUERY =
      Pattern.compile("SELECT DISTINCT \\?column.*?OFFSET 0");

  /**
   * Terms the descriptions use although the ontology does not label them {@code om:Stored}, each
   * with the reason. A term that stops needing its exception fails {@link
   * #exceptionsAreStillNeeded}, so this list cannot rot.
   */
  private static final Map<String, String> JUSTIFIED_EXCEPTIONS =
      Map.of(
          "hasChildColumn",
          "Labeled InferenceOnly as 'not emitted', but RdfPropertyMapper.emitColumnChildren writes it"
              + " for nested Table.columns (pinned by RdfColumnLineageTraversalTest). The label is"
              + " stale; nested columns cannot be joined to their asset without it.");

  private static Model ontology;
  private static Map<String, McpSchema.Tool> tools;

  @BeforeAll
  static void load() {
    ontology = RDFDataMgr.loadModel("rdf/ontology/openmetadata.ttl");
    tools = new HashMap<>();
    McpUtils.getToolProperties("json/data/mcp/tools.json").stream()
        .filter(tool -> RDF_TOOLS.contains(tool.name()))
        .forEach(tool -> tools.put(tool.name(), tool));
  }

  @AfterAll
  static void close() {
    ontology.close();
  }

  @Test
  void everyRdfToolIsDefined() {
    assertThat(tools.keySet()).isEqualTo(RDF_TOOLS);
  }

  @Test
  void everyAdvertisedTermIsDeclaredAndProjected() {
    final Set<String> problems = new TreeSet<>();
    advertisedTerms().forEach(term -> collectProblem(term, problems));

    assertThat(problems).isEmpty();
  }

  @Test
  void exceptionsAreStillNeeded() {
    JUSTIFIED_EXCEPTIONS
        .keySet()
        .forEach(
            term -> {
              assertThat(advertisedTerms()).as("%s is advertised", term).contains(term);
              assertThat(isStored(term)).as("%s is already labeled Stored", term).isFalse();
            });
  }

  @Test
  void unprojectedFieldsAreNeverAdvertised() {
    tools
        .values()
        .forEach(
            tool ->
                assertThat(textOf(tool).toLowerCase(Locale.ROOT))
                    .as(tool.name())
                    .doesNotContain("changedescription", "votes"));
  }

  @Test
  void sparqlQueryStaysWithinItsCharacterBudget() {
    assertThat(tools.get("sparql_query").description().length())
        .isLessThanOrEqualTo(SPARQL_QUERY_DESCRIPTION_BUDGET);
  }

  @Test
  void permissionWordingMatchesTheAccessMatrix() {
    QUERY_PERMISSION_TOOLS.forEach(
        name ->
            assertThat(tools.get(name).description())
                .as(name)
                .contains("ExecuteSparqlQuery")
                .doesNotContain("Admin only"));
    assertThat(tools.get("shacl_validate").description())
        .contains("Admin only")
        .doesNotContainIgnoringCase("bot");
    assertThat(tools.get("ontology_describe").description())
        .contains("no 'resource') is open to every caller");
  }

  @Test
  void sparqlQueryDescribesPagingTheProfileAndTheColumnLineageContract() {
    assertThat(tools.get("sparql_query").description())
        .contains("ORDER BY", "LIMIT 250", "OFFSET", "fewer rows than LIMIT")
        .contains("'truncated' is true", "completeness.status is TRUNCATED")
        .contains("SELECT only", "no FROM, GRAPH or SERVICE", "no inference")
        .contains("plain string literals, not IRIs", "RdfIndexApp")
        .contains("?output om:upstream ?source");
  }

  @Test
  void theAdvertisedColumnLineageQueryIsValidSparql() {
    final Matcher query = COLUMN_LINEAGE_QUERY.matcher(tools.get("sparql_query").description());

    assertThat(query.find()).as("column lineage template present").isTrue();
    QueryFactory.create("PREFIX om: <" + OM + ">\n" + query.group());
  }

  private static Set<String> advertisedTerms() {
    final Set<String> terms = new TreeSet<>();
    tools.values().forEach(tool -> addTerms(textOf(tool), terms));
    return terms;
  }

  private static void addTerms(final String text, final Set<String> terms) {
    final Matcher matcher = OM_TERM.matcher(text);
    while (matcher.find()) {
      terms.add(matcher.group(1));
    }
  }

  private static String textOf(final McpSchema.Tool tool) {
    final StringBuilder text = new StringBuilder(tool.description());
    tool.inputSchema()
        .properties()
        .values()
        .forEach(property -> text.append(' ').append(((Map<?, ?>) property).get("description")));
    return text.toString();
  }

  private static void collectProblem(final String term, final Set<String> problems) {
    final Resource resource = ontology.createResource(OM + term);
    if (!ontology.contains(resource, RDF.type)) {
      problems.add("om:" + term + " is not declared in the ontology");
    } else if (isProperty(resource) && !isStored(term) && !JUSTIFIED_EXCEPTIONS.containsKey(term)) {
      problems.add("om:" + term + " is a property that is not labeled om:Stored");
    }
  }

  private static boolean isProperty(final Resource resource) {
    return List.of(RDF.Property, OWL.ObjectProperty, OWL.DatatypeProperty, OWL.AnnotationProperty)
        .stream()
        .anyMatch(type -> ontology.contains(resource, RDF.type, type));
  }

  private static boolean isStored(final String term) {
    final Property status = ontology.createProperty(OM + "projectionStatus");
    return ontology.contains(
        ontology.createResource(OM + term), status, ontology.createResource(OM + "Stored"));
  }
}
