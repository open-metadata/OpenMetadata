package org.openmetadata.service.rdf;

import static java.util.Map.entry;
import static java.util.stream.Collectors.toMap;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.rdf.SanitizedModelBuilder.CONSISTENCY_FAILURE;
import static org.openmetadata.service.rdf.SanitizedModelBuilder.MAX_REFERENCE_LOOKUPS;
import static org.openmetadata.service.rdf.SanitizedModelBuilder.SCOPE_ERROR;
import static org.openmetadata.service.rdf.SanitizedModelFixture.BASE;
import static org.openmetadata.service.rdf.SanitizedModelFixture.DOMAIN_RESTRICTED;
import static org.openmetadata.service.rdf.SanitizedModelFixture.DOMAIN_VISIBLE;
import static org.openmetadata.service.rdf.SanitizedModelFixture.HIDDEN_COLUMN_PREFIX;
import static org.openmetadata.service.rdf.SanitizedModelFixture.KNOWLEDGE;
import static org.openmetadata.service.rdf.SanitizedModelFixture.RESTRICTED_TAG_ID;
import static org.openmetadata.service.rdf.SanitizedModelFixture.SHARED_TAG_ID;
import static org.openmetadata.service.rdf.SanitizedModelFixture.TABLE_A;
import static org.openmetadata.service.rdf.SanitizedModelFixture.TABLE_B;
import static org.openmetadata.service.rdf.SanitizedModelFixture.TABLE_C;
import static org.openmetadata.service.rdf.SanitizedModelFixture.TABLE_D;
import static org.openmetadata.service.rdf.SanitizedModelFixture.TABLE_DELETED;
import static org.openmetadata.service.rdf.SanitizedModelFixture.TABLE_OUTSIDE_READABLE;
import static org.openmetadata.service.rdf.SanitizedModelFixture.TABLE_OUTSIDE_RESTRICTED;
import static org.openmetadata.service.rdf.SanitizedModelFixture.domainIri;
import static org.openmetadata.service.rdf.SanitizedModelFixture.tableIri;
import static org.openmetadata.service.rdf.SanitizedModelFixture.tagIri;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.ResultSet;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.sparql.engine.binding.Binding;
import org.apache.jena.sparql.resultset.ResultsCompare;
import org.apache.jena.update.UpdateAction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.rdf.SanitizedModelBuilder.CallerPermissions;
import org.openmetadata.service.rdf.SanitizedModelBuilder.EntityIri;
import org.openmetadata.service.rdf.SanitizedModelBuilder.FactAdmissionException;
import org.openmetadata.service.rdf.SanitizedModelBuilder.KnowledgeSource;
import org.openmetadata.service.rdf.SanitizedModelBuilder.ReferenceState;
import org.openmetadata.service.rdf.SanitizedModelBuilder.ReferenceStates;
import org.openmetadata.service.rdf.SanitizedModelBuilder.RetrievalBudgetExceededException;
import org.openmetadata.service.rdf.SanitizedModelBuilder.SanitizedModel;

/**
 * Candidate L of docs/adr/2026-09-14-authorized-sparql.md on four tables: the caller may see A, C
 * and D but not B. Expected answers are the ADR's; the reference model removes B's facts from the
 * unrestricted knowledge graph by IRI convention, independently of the builder's retrieval.
 */
class SanitizedModelExperimentTest {
  private static final int TRIPLE_BUDGET = 1_000;
  private static final int LOOKUP_LIMIT_TRIPLE_BUDGET = 10_000;
  private static final String STALE_SIGNALS_ON_C =
      """
      ASK { { <C> om:isDeleted ?deleted }
            UNION { <C> <http://www.w3.org/ns/prov#invalidatedAtTime> ?invalidatedAt } }
      """;
  private static final String PREFIXES =
      """
      PREFIX om: <https://open-metadata.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      """;
  private static final Map<String, String> PLACEHOLDERS =
      Map.ofEntries(
          entry("<A>", "<" + tableIri(TABLE_A) + ">"),
          entry("<B>", "<" + tableIri(TABLE_B) + ">"),
          entry("<C>", "<" + tableIri(TABLE_C) + ">"),
          entry("<D>", "<" + tableIri(TABLE_D) + ">"),
          entry("<E>", "<" + tableIri(TABLE_DELETED) + ">"),
          entry("<OUTSIDE_RESTRICTED>", "<" + tableIri(TABLE_OUTSIDE_RESTRICTED) + ">"),
          entry("<T_RESTRICTED>", "<" + tagIri(RESTRICTED_TAG_ID) + ">"),
          entry("<T_SHARED>", "<" + tagIri(SHARED_TAG_ID) + ">"),
          entry("<D_VISIBLE>", "<" + domainIri(DOMAIN_VISIBLE) + ">"),
          entry("<D_RESTRICTED>", "<" + domainIri(DOMAIN_RESTRICTED) + ">"));
  private static final String TABLE_SCALAR_ATTRIBUTES =
      """
      ASK { %s om:hasServiceType "Postgres" ; om:entityStatus "Approved" ;
               om:processedLineage true ; <http://purl.org/dc/terms/hasVersion> ?version }
      """;
  private static final String DOMAIN_SCALAR_ATTRIBUTES =
      """
      ASK { %s a om:Domain , <http://www.w3.org/2004/02/skos/core#Collection> ;
               om:domainType "Aggregate" ; om:entityStatus "Approved" ;
               <http://purl.org/dc/terms/description> "Domain %s" ;
               <http://purl.org/dc/terms/modified> ?modified ;
               <http://www.w3.org/ns/dcat#version> ?version ;
               <http://purl.org/dc/terms/hasVersion> ?number }
      """;
  private static final List<String> INVARIANCE_QUERIES =
      List.of(
          "SELECT (COUNT(?x) AS ?n) WHERE { <A> om:upstream ?x }",
          "ASK { <A> om:upstream+ <C> }",
          "SELECT ?label WHERE { ?x rdfs:label ?label }",
          "SELECT ?x WHERE { ?x a om:Table }",
          "SELECT ?t WHERE { <A> om:hasTag ?t FILTER NOT EXISTS { ?o om:hasTag ?t FILTER(?o != <A>) } }",
          "SELECT ?x ?z WHERE { ?x om:upstream ?y . ?y om:upstream ?z }",
          "SELECT (COUNT(?column) AS ?n) WHERE { ?table om:hasColumn ?column }",
          "SELECT ?x WHERE { ?x om:downstream ?y MINUS { ?y om:upstream ?x } }");

  protected final Dataset store = SanitizedModelFixture.store();

  protected KnowledgeSource source(final Dataset dataset) {
    return SanitizedModelFixture.local(dataset);
  }

  @AfterEach
  void closeStore() {
    store.close();
  }

  @Test
  void sanitizedModelIsTheKnowledgeGraphWithoutTheHiddenTable() {
    final Model reference = withoutHiddenTable(knowledgeGraph());
    final SanitizedModel sanitized = sanitized();
    assertTrue(
        sanitized.model().isIsomorphicWith(reference),
        () ->
            "only in reference: %s%nonly in sanitized: %s"
                .formatted(
                    reference.difference(sanitized.model()).listStatements().toList(),
                    sanitized.model().difference(reference).listStatements().toList()));
    assertTrue(reference.size() < knowledgeGraph().size());
    // Visible resources, then their columns and extension, then extension properties.
    assertEquals(3, sanitized.retrievalQueries());
  }

  @Test
  void countExcludesTheHiddenUpstream() {
    final String query = "SELECT (COUNT(?x) AS ?n) WHERE { <A> om:upstream ?x }";
    assertEquals(2, count(knowledgeGraph(), query));
    assertEquals(1, count(sanitized().model(), query));
  }

  @ParameterizedTest(name = "{0}")
  @CsvSource(
      delimiter = '|',
      textBlock =
          """
          A2a transitive path through hidden B | ASK { <A> om:upstream+ <C> }                       | true  | false
          A2b inverse transitive path          | ASK { <C> ^om:upstream+ <A> }                      | true  | false
          A2c visible inverse edge             | ASK { <D> ^om:upstream <A> }                       | true  | true
          A2d wrong direction                  | ASK { <A> ^om:upstream+ <D> }                      | false | false
          A2e zero-length on visible term      | ASK { <A> om:upstream* <A> }                       | true  | true
          A2e zero-length on an absent term    | ASK { <urn:x:absent> om:upstream* <urn:x:absent> } | false | false
          A2e zero-length on hidden B as absent | ASK { <B> om:upstream* <B> }                      | true  | false
          A2f zero-or-more cannot reach B      | ASK { <A> om:upstream* <B> }                       | true  | false
          """)
  void propertyPathsNeverCrossTheHiddenTable(
      final String name, final String query, final boolean unrestricted, final boolean sanitized) {
    assertEquals(unrestricted, ask(knowledgeGraph(), query), name);
    assertEquals(sanitized, ask(sanitized().model(), query), name);
  }

  @Test
  void cycleThroughTheHiddenTableIsNotAVisibleCycle() {
    SanitizedModelFixture.addUpstream(store, TABLE_C, TABLE_A);
    assertTrue(ask(knowledgeGraph(), "ASK { <A> om:upstream+ <A> }"));
    assertFalse(ask(sanitized().model(), "ASK { <A> om:upstream+ <A> }"));
    assertTrue(ask(sanitized().model(), "ASK { <C> om:upstream <A> }"));
  }

  @Test
  void adrExampleAnswersMatchTheAuthorizedView() {
    final Model model = sanitized().model();
    assertTrue(ask(knowledgeGraph(), "ASK { ?x rdfs:label \"secret_b\" }"));
    assertFalse(ask(model, "ASK { ?x rdfs:label \"secret_b\" }"));
    assertEquals(4, count(knowledgeGraph(), "SELECT (COUNT(?x) AS ?n) WHERE { ?x a om:Table }"));
    assertEquals(3, count(model, "SELECT (COUNT(?x) AS ?n) WHERE { ?x a om:Table }"));
    assertEquals(
        List.of(tagIri(SHARED_TAG_ID)),
        column(
            model, "SELECT ?t WHERE { <A> om:hasTag ?t FILTER NOT EXISTS { <B> om:hasTag ?t } }"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "SELECT ?t WHERE { <A> om:hasTag ?t FILTER EXISTS { ?o om:hasTag ?t FILTER(?o != <A>) } }",
        "SELECT ?x ?z WHERE { ?x om:upstream ?y . ?y om:upstream ?z }",
        "SELECT (COUNT(*) AS ?n) WHERE { { SELECT DISTINCT ?t WHERE { ?table om:hasTag ?t } } }",
        "SELECT ?table ?label WHERE { ?table a om:Table OPTIONAL { ?table rdfs:label ?label } }",
        "SELECT ?table (COUNT(?c) AS ?n) WHERE { ?table om:hasColumn ?c } GROUP BY ?table",
        "SELECT ?x WHERE { ?x om:downstream ?y MINUS { ?y om:upstream ?x } }",
        "SELECT ?s ?p ?o WHERE { ?s ?p ?o }"
      })
  void joinsSubqueriesAndExistsMatchTheReference(final String query) {
    assertSameAnswer(
        query,
        answer(withoutHiddenTable(knowledgeGraph()), query),
        answer(sanitized().model(), query));
  }

  @Test
  void hiddenOnlyMutationsLeaveVisibleAnswersUnchanged() {
    final List<Answer> before = answers(sanitized().model());
    final List<Answer> unrestrictedBefore = answers(knowledgeGraph());
    mutateHiddenTable();
    final List<Answer> after = answers(sanitized().model());
    for (int index = 0; index < INVARIANCE_QUERIES.size(); index++) {
      assertSameAnswer(INVARIANCE_QUERIES.get(index), before.get(index), after.get(index));
    }
    assertNotEquals(unrestrictedBefore, answers(knowledgeGraph()));
  }

  @Test
  void ownedColumnsAndExtensionFollowTheirTable() {
    final Model model = sanitized().model();
    assertTrue(
        ask(
            model,
            "ASK { <A> om:hasColumn/om:fullyQualifiedName \"service.db.schema.orders.id\" }"));
    assertTrue(
        ask(model, "ASK { <A> om:hasExtension/om:hasExtensionProperty/om:extensionValue ?v }"));
    assertFalse(ask(model, "ASK { ?c om:fullyQualifiedName \"service.db.schema.secret_b.id\" }"));
  }

  @Test
  void tagFactsFollowTheTagPolicyNotTheTableThatWroteThem() {
    assertTrue(ask(sanitized().model(), "ASK { <T_RESTRICTED> rdfs:label ?label }"));
    final Model model = sanitized(SanitizedModelFixture.restrictedTablesAndTagsHidden()).model();
    assertFalse(ask(model, "ASK { ?table om:hasTag ?t }"));
    assertFalse(ask(model, "ASK { ?t om:tagFQN ?fqn }"));
    assertTrue(ask(model, "ASK { <A> rdfs:label \"orders\" }"));
  }

  @Test
  void inferredAndDefaultGraphFactsAreNeverRetrieved() {
    final String inferred = BASE + "graph/inferred/transitive-upstream";
    final String fact = "<A> om:upstream <C>";
    UpdateAction.parseExecute(
        resolve(
            PREFIXES + "INSERT DATA { GRAPH <" + inferred + "> { " + fact + " } " + fact + " }"),
        store);
    assertFalse(ask(sanitized().model(), "ASK { <A> om:upstream <C> }"));
  }

  @Test
  void tagApplicationStateOnASharedTagFailsClosed() {
    SanitizedModelFixture.addTagApplicationState(store);
    assertFailsClosedOn(BASE + "ontology/labelType");
    assertFailsClosedOn(BASE + "ontology/tagState");
  }

  @Test
  void scalarTableAttributesFollowTheirTable() {
    SanitizedModelFixture.addScalarAttributes(store);
    final Model model = sanitizedWithDomains().model();
    assertTrue(ask(knowledgeGraph(), TABLE_SCALAR_ATTRIBUTES.formatted("<B>")));
    assertTrue(ask(model, TABLE_SCALAR_ATTRIBUTES.formatted("<A>")));
    assertFalse(ask(model, "ASK { <B> ?p ?o }"));
  }

  @Test
  void scalarDomainAttributesFollowTheirDomain() {
    SanitizedModelFixture.addScalarAttributes(store);
    final Model model = sanitizedWithDomains().model();
    assertTrue(
        ask(knowledgeGraph(), DOMAIN_SCALAR_ATTRIBUTES.formatted("<D_RESTRICTED>", "Secret")));
    assertTrue(ask(model, DOMAIN_SCALAR_ATTRIBUTES.formatted("<D_VISIBLE>", "Finance")));
    assertFalse(ask(model, "ASK { <D_RESTRICTED> ?p ?o }"));
  }

  @Test
  void edgesToADeletedEntityLeaveTheNonDeletedDataset() {
    SanitizedModelFixture.addDeletedUpstream(store);
    final Model model = sanitized().model();
    assertTrue(ask(knowledgeGraph(), "ASK { <A> om:upstream <E> . <E> om:isDeleted true }"));
    assertFalse(ask(model, "ASK { { <A> ?p <E> } UNION { <E> ?p ?o } }"));
    assertEquals(1, count(model, "SELECT (COUNT(?x) AS ?n) WHERE { <A> om:upstream ?x }"));
  }

  @Test
  void nonDeletedFlagOnACandidateIsAdmitted() {
    SanitizedModelFixture.addDeletedFlag(store);
    assertTrue(ask(sanitized().model(), "ASK { <C> om:isDeleted false }"));
  }

  @Test
  void candidateDeletedInTheProjectionIsAConsistencyFailure() {
    SanitizedModelFixture.markCandidateDeletedInProjection(store);
    assertFailsClosedOn(CONSISTENCY_FAILURE + "candidate " + tableIri(TABLE_C));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "<C> om:isDeleted true",
        "<C> <http://www.w3.org/ns/prov#invalidatedAtTime>"
            + " \"2026-09-15T00:00:00Z\"^^<http://www.w3.org/2001/XMLSchema#dateTime>"
      })
  void eachStaleProjectionSignalAloneRejectsANonDeletedCandidate(final String signal) {
    assertFalse(ask(knowledgeGraph(), STALE_SIGNALS_ON_C));
    insertKnowledge(signal);
    assertFailsClosedOn(CONSISTENCY_FAILURE + "candidate " + tableIri(TABLE_C));
  }

  @Test
  void referenceLookupAcceptsExactlyTheLimitOfDistinctEntities() {
    insertKnowledge(outsideUpstreams(MAX_REFERENCE_LOOKUPS, "<A>"));
    final List<Set<EntityIri>> lookups = new ArrayList<>();
    final Model model = sanitized(allDeleted(lookups), LOOKUP_LIMIT_TRIPLE_BUDGET).model();
    assertEquals(List.of(MAX_REFERENCE_LOOKUPS), lookups.stream().map(Set::size).toList());
    assertEquals(1, count(model, "SELECT (COUNT(?x) AS ?n) WHERE { <A> om:upstream ?x }"));
  }

  @Test
  void referenceLookupBeyondTheLimitFailsWithoutAPartialModel() {
    insertKnowledge(outsideUpstreams(MAX_REFERENCE_LOOKUPS + 1, "<A>"));
    final List<Set<EntityIri>> lookups = new ArrayList<>();
    final RetrievalBudgetExceededException failure =
        assertThrows(
            RetrievalBudgetExceededException.class,
            () -> sanitized(allDeleted(lookups), LOOKUP_LIMIT_TRIPLE_BUDGET));
    assertTrue(failure.getMessage().contains("partial lookup"), failure.getMessage());
    assertTrue(lookups.isEmpty(), "the lookup must not run for part of the references");
  }

  @Test
  void repeatedReferencesToOneEntityUseOneLookupSlot() {
    insertKnowledge(outsideUpstreams(MAX_REFERENCE_LOOKUPS, "<A>", "<C>"));
    assertEquals(
        MAX_REFERENCE_LOOKUPS,
        count(knowledgeGraph(), "SELECT (COUNT(?x) AS ?n) WHERE { <C> om:upstream ?x }"));
    final List<Set<EntityIri>> lookups = new ArrayList<>();
    final Model model = sanitized(allDeleted(lookups), LOOKUP_LIMIT_TRIPLE_BUDGET).model();
    assertEquals(List.of(MAX_REFERENCE_LOOKUPS), lookups.stream().map(Set::size).toList());
    assertFalse(ask(model, "ASK { <C> om:upstream ?x }"));
  }

  @ParameterizedTest(name = "{0}")
  @CsvSource(
      delimiter = '|',
      textBlock =
          """
          https://open-metadata.org/entity/notAnEntityType/0b000000-0000-4000-8000-000000000000 | does not name a registered entity type
          https://open-metadata.org/entity/table/0B000000-0000-4000-8000-000000000000           | does not carry a canonical entity id
          https://open-metadata.org/entity/table/1-1-1-1-1                                      | does not carry a canonical entity id
          """)
  void invalidReferenceIdentityFailsBeforeAnyLookup(final String reference, final String reason) {
    insertKnowledge("<A> om:upstream <%s>".formatted(reference));
    final List<Set<EntityIri>> lookups = new ArrayList<>();
    final FactAdmissionException failure =
        assertThrows(
            FactAdmissionException.class, () -> sanitized(allDeleted(lookups), TRIPLE_BUDGET));
    assertTrue(
        failure
            .getMessage()
            .contains(CONSISTENCY_FAILURE + "reference " + reference + " " + reason),
        failure.getMessage());
    assertTrue(lookups.isEmpty(), "an invalid reference must not reach the catalog lookup");
  }

  @Test
  void inconsistentCatalogAnswerIsAConsistencyFailure() {
    SanitizedModelFixture.addUpstream(store, TABLE_A, TABLE_OUTSIDE_READABLE);
    final ReferenceStates withoutDeletionState =
        SanitizedModelFixture.referenceStates(
            references ->
                references.stream()
                    .collect(
                        toMap(
                            EntityIri::iri,
                            reference ->
                                (ReferenceState)
                                    new ReferenceState.Inconsistent("no deletion state"))));
    final FactAdmissionException failure =
        assertThrows(
            FactAdmissionException.class, () -> sanitized(withoutDeletionState, TRIPLE_BUDGET));
    assertTrue(
        failure
            .getMessage()
            .contains(
                CONSISTENCY_FAILURE
                    + "reference "
                    + tableIri(TABLE_OUTSIDE_READABLE)
                    + ": no deletion state"),
        failure.getMessage());
  }

  @Test
  void readableEntityOutsideTheCandidatesIsAScopeErrorNotHidden() {
    SanitizedModelFixture.addUpstream(store, TABLE_A, TABLE_OUTSIDE_READABLE);
    assertFailsClosedOn(SCOPE_ERROR + tableIri(TABLE_OUTSIDE_READABLE));
  }

  @Test
  void unreadableEntityOutsideTheCandidatesIsHidden() {
    SanitizedModelFixture.addUpstream(store, TABLE_A, TABLE_OUTSIDE_RESTRICTED);
    assertTrue(ask(knowledgeGraph(), "ASK { <A> om:upstream <OUTSIDE_RESTRICTED> }"));
    assertFalse(ask(sanitized().model(), "ASK { <A> ?p <OUTSIDE_RESTRICTED> }"));
  }

  @Test
  void lineageDetailsWithoutAPermissionMappingFailClosed() {
    SanitizedModelFixture.addLineageDetails(store, TABLE_A, TABLE_D);
    assertFailsClosedOn(BASE + "ontology/hasLineageDetails");
  }

  @Test
  void conflictingOwnersInOneRetrievalWaveFailClosed() {
    final String shared = columnIri("service.db.schema.shared.id");
    insertKnowledge(
        "<A> om:hasColumn <%1$s> . <C> om:hasColumn <%1$s> . <%1$s> a om:Column".formatted(shared));
    assertOwnershipConflict(shared);
  }

  @Test
  void incompatibleKindsForOneOwnedNodeFailClosed() {
    final String shared = columnIri("service.db.schema.orders.shared");
    insertKnowledge(
        "<A> om:hasColumn <%1$s> . <A> om:hasExtension <%1$s> . <%1$s> a om:Column"
            .formatted(shared));
    assertOwnershipConflict(shared);
  }

  @Test
  void conflictingClaimAcrossRetrievalWavesFailsClosed() {
    final String customersColumn = columnIri("service.db.schema.customers.id");
    insertKnowledge(
        "<%s> om:hasExtensionProperty <%s>"
            .formatted(BASE + "extension/" + TABLE_A, customersColumn));
    assertOwnershipConflict(customersColumn);
  }

  @ParameterizedTest
  @ValueSource(strings = {"<B>", "<D>"})
  void structuredEdgeCannotClaimACatalogResource(final String table) {
    insertKnowledge("<A> om:hasColumn " + table);
    assertOwnershipConflict(resolve(table).substring(1, resolve(table).length() - 1));
  }

  @Test
  void repeatedIdenticalOwnershipClaimsRemainValid() {
    final String id = columnIri("service.db.schema.orders.id");
    final String key = columnIri("service.db.schema.orders.key");
    final String nested = columnIri("service.db.schema.orders.nested");
    insertKnowledge(
        """
        <A> om:hasColumn <%2$s> . <%2$s> a om:Column ; om:fullyQualifiedName "service.db.schema.orders.key" .
        <%1$s> om:hasChildColumn <%3$s> , <%1$s> . <%2$s> om:hasChildColumn <%3$s> .
        <%3$s> a om:Column ; om:fullyQualifiedName "service.db.schema.orders.nested" .
        """
            .formatted(id, key, nested));
    final Model model = sanitized().model();
    assertEquals(
        2,
        count(
            model,
            "SELECT (COUNT(DISTINCT ?parent) AS ?n) WHERE { ?parent om:hasChildColumn <%s> }"
                .formatted(nested)));
    assertTrue(ask(model, "ASK { <%1$s> om:hasChildColumn <%1$s> }".formatted(id)));
  }

  @Test
  void referenceToAMissingEntityIsAConsistencyFailure() {
    final String unknown = tableIri(UUID.fromString("f0000000-0000-4000-8000-000000000000"));
    UpdateAction.parseExecute(
        resolve(
            PREFIXES
                + "INSERT DATA { GRAPH <"
                + KNOWLEDGE
                + "> { <A> om:upstream <"
                + unknown
                + "> } }"),
        store);
    assertFailsClosedOn(CONSISTENCY_FAILURE + "referenced entity " + unknown);
  }

  @Test
  void exceedingTheRetrievalBudgetFailsInsteadOfAnsweringPartially() {
    final int retrieved = sanitized().retrievedTriples();
    assertDoesNotThrow(() -> sanitized(SanitizedModelFixture.restrictedTablesHidden(), retrieved));
    assertThrows(
        RetrievalBudgetExceededException.class,
        () -> sanitized(SanitizedModelFixture.restrictedTablesHidden(), retrieved - 1));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "SELECT * WHERE { SERVICE <http://example.org/sparql> { ?s ?p ?o } }",
        "ASK { FILTER EXISTS { SERVICE <http://example.org/sparql> { ?s ?p ?o } } }",
        "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } }",
        "ASK { FILTER NOT EXISTS { GRAPH <https://open-metadata.org/graph/knowledge> { ?s ?p ?o } } }",
        "SELECT * FROM <https://open-metadata.org/graph/knowledge> WHERE { ?s ?p ?o }",
        "SELECT * FROM NAMED <https://open-metadata.org/graph/knowledge> WHERE { ?s ?p ?o }",
        "PREFIX text: <http://jena.apache.org/text#> SELECT * WHERE { ?s text:query 'secret' }",
        "PREFIX apf: <http://jena.apache.org/ARQ/property#> SELECT * WHERE { ?s apf:strSplit ('a b' ' ') }",
        "PREFIX list: <http://jena.apache.org/ARQ/list#> SELECT * WHERE { ?list list:member ?m }",
        "SELECT * WHERE { ?s <java:org.example.Leak> ?o }",
        "SELECT * WHERE { ?s ?p ?o FILTER(<http://example.org/fn>(?o)) }",
        "SELECT (<http://example.org/fn>(?o) AS ?x) WHERE { ?s ?p ?o }",
        "SELECT * WHERE { ?s ?p ?o BIND(<http://example.org/fn>(?o) AS ?x) }",
        "SELECT ?s WHERE { ?s ?p ?o } GROUP BY ?s HAVING (<http://example.org/fn>(?s))",
        "SELECT * WHERE { ?s ?p ?o } ORDER BY <http://example.org/fn>(?o)",
        "SELECT * WHERE { ?s ?p ?o } ORDER BY <http://example.org/fn>(?o) LIMIT 1",
        "SELECT (COUNT(<http://example.org/fn>(?o)) AS ?n) WHERE { ?s ?p ?o }",
        "SELECT ?k WHERE { ?s ?p ?o } GROUP BY (<http://example.org/fn>(?o) AS ?k)",
        "SELECT * WHERE { ?s ?p ?o FILTER(CALL(<http://example.org/fn>, ?o)) }",
        "ASK { ?s ?p ?o FILTER NOT EXISTS { ?s ?q ?v FILTER(<http://example.org/fn>(?v)) } }",
        "CONSTRUCT WHERE { ?s ?p ?o }",
        "DESCRIBE <urn:x:absent>"
      })
  void queryProfileRejectsReadsOutsideTheSanitizedModel(final String query) {
    assertThrows(
        IllegalArgumentException.class, () -> SanitizedQueryProfile.requireSupported(query));
  }

  @Test
  void queryProfileAcceptsPathsAggregatesAndExists() {
    for (String query : INVARIANCE_QUERIES) {
      assertDoesNotThrow(() -> SanitizedQueryProfile.requireSupported(resolve(PREFIXES + query)));
    }
  }

  private void assertOwnershipConflict(final String node) {
    final FactAdmissionException failure =
        assertThrows(FactAdmissionException.class, this::sanitized);
    assertTrue(
        failure.getMessage().contains("Ownership conflict for " + node), failure.getMessage());
  }

  private void insertKnowledge(final String triples) {
    UpdateAction.parseExecute(
        resolve(PREFIXES + "INSERT DATA { GRAPH <" + KNOWLEDGE + "> { " + triples + " } }"), store);
  }

  /** {@code <subject> om:upstream <x>} for each subject and {@code count} distinct non-candidates. */
  private static String outsideUpstreams(final int count, final String... subjects) {
    final StringBuilder triples = new StringBuilder();
    for (int index = 0; index < count; index++) {
      final String target =
          tableIri(new UUID(0x0b00_0000_0000_4000L, 0x8000_0000_0000_0000L | index));
      for (String subject : subjects) {
        triples.append(subject).append(" om:upstream <").append(target).append("> .\n");
      }
    }
    return triples.toString();
  }

  /** Records every lookup and reports each requested entity as soft-deleted. */
  private static ReferenceStates allDeleted(final List<Set<EntityIri>> lookups) {
    return SanitizedModelFixture.referenceStates(
        references -> {
          lookups.add(references);
          return references.stream()
              .collect(
                  toMap(
                      EntityIri::iri, reference -> (ReferenceState) new ReferenceState.Deleted()));
        });
  }

  private SanitizedModel sanitized(final ReferenceStates references, final int budget) {
    return new SanitizedModelBuilder(
            source(store),
            SanitizedModelFixture.catalog(),
            references,
            SanitizedModelFixture.restrictedTablesHidden(),
            budget)
        .build();
  }

  private static String columnIri(final String fullyQualifiedName) {
    return BASE + "entity/column/" + fullyQualifiedName;
  }

  private void assertFailsClosedOn(final String unmappedTerm) {
    final FactAdmissionException failure =
        assertThrows(FactAdmissionException.class, this::sanitized);
    assertTrue(failure.getMessage().contains(unmappedTerm), failure.getMessage());
  }

  private SanitizedModel sanitized() {
    return sanitized(SanitizedModelFixture.restrictedTablesHidden());
  }

  private SanitizedModel sanitized(final CallerPermissions permissions) {
    return sanitized(permissions, TRIPLE_BUDGET);
  }

  private SanitizedModel sanitizedWithDomains() {
    return new SanitizedModelBuilder(
            source(store),
            SanitizedModelFixture.catalogWithDomains(),
            SanitizedModelFixture.references(),
            SanitizedModelFixture.restrictedTablesAndDomainsHidden(),
            TRIPLE_BUDGET)
        .build();
  }

  private SanitizedModel sanitized(final CallerPermissions permissions, final int budget) {
    return new SanitizedModelBuilder(
            source(store),
            SanitizedModelFixture.catalog(),
            SanitizedModelFixture.references(),
            permissions,
            budget)
        .build();
  }

  /** The unrestricted (admin) read of the knowledge graph through the same source. */
  private Model knowledgeGraph() {
    return source(store)
        .construct("CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <" + KNOWLEDGE + "> { ?s ?p ?o } }");
  }

  private void mutateHiddenTable() {
    final String hiddenColumn = HIDDEN_COLUMN_PREFIX + "ssn";
    UpdateAction.parseExecute(
        resolve(
            PREFIXES
                + """
                DELETE DATA { GRAPH <%1$s> { <B> rdfs:label "secret_b" . <B> om:hasTag <T_SHARED> } } ;
                INSERT DATA { GRAPH <%1$s> {
                  <B> rdfs:label "renamed_secret" . <B> om:upstream <D> . <D> om:upstream <B> .
                  <B> om:hasColumn <%2$s> . <%2$s> a om:Column ; om:fullyQualifiedName "ssn" .
                } }
                """
                    .formatted(KNOWLEDGE, hiddenColumn)),
        store);
  }

  /** Removes B and the nodes it owns, identified by the projection's IRI conventions. */
  private static Model withoutHiddenTable(final Model knowledgeGraph) {
    final Set<String> hiddenPrefixes =
        Set.of(tableIri(TABLE_B), HIDDEN_COLUMN_PREFIX, BASE + "extension/" + TABLE_B);
    final List<Statement> hidden =
        knowledgeGraph
            .listStatements()
            .filterKeep(
                statement ->
                    isHidden(statement.getSubject(), hiddenPrefixes)
                        || isHidden(statement.getObject(), hiddenPrefixes))
            .toList();
    return ModelFactory.createDefaultModel().add(knowledgeGraph).remove(hidden);
  }

  private static boolean isHidden(final RDFNode node, final Set<String> hiddenPrefixes) {
    return node.isURIResource()
        && hiddenPrefixes.stream().anyMatch(node.asResource().getURI()::startsWith);
  }

  private static String resolve(final String template) {
    String query = template;
    for (Map.Entry<String, String> placeholder : PLACEHOLDERS.entrySet()) {
      query = query.replace(placeholder.getKey(), placeholder.getValue());
    }
    return query;
  }

  private static Query parse(final String template) {
    return SanitizedQueryProfile.requireSupported(resolve(PREFIXES + template));
  }

  private static boolean ask(final Model model, final String template) {
    try (QueryExecution execution = QueryExecution.model(model).query(parse(template)).build()) {
      return execution.execAsk();
    }
  }

  private static long count(final Model model, final String template) {
    try (QueryExecution execution = QueryExecution.model(model).query(parse(template)).build()) {
      return execution.execSelect().next().getLiteral("n").getLong();
    }
  }

  private static List<String> column(final Model model, final String template) {
    return answer(model, template).rows().stream()
        .map(row -> row.get(row.vars().next()).getURI())
        .toList();
  }

  private List<Answer> answers(final Model model) {
    return INVARIANCE_QUERIES.stream().map(query -> answer(model, query)).toList();
  }

  private static Answer answer(final Model model, final String template) {
    final Query query = parse(template);
    try (QueryExecution execution = QueryExecution.model(model).query(query).build()) {
      return query.isAskType()
          ? new Answer(execution.execAsk(), List.of())
          : new Answer(null, rows(execution.execSelect()));
    }
  }

  private static List<Binding> rows(final ResultSet results) {
    final List<Binding> rows = new ArrayList<>();
    while (results.hasNext()) {
      rows.add(results.nextBinding());
    }
    return rows;
  }

  private static void assertSameAnswer(
      final String query, final Answer expected, final Answer actual) {
    assertEquals(expected.isTrue(), actual.isTrue(), query);
    assertTrue(
        ResultsCompare.equalsByTerm(expected.rows(), actual.rows()),
        () -> query + "\nexpected " + expected.rows() + "\nactual   " + actual.rows());
  }

  /** Canonical answer: the ASK boolean, or SELECT rows compared unordered by RDF term. */
  private record Answer(Boolean isTrue, List<Binding> rows) {}
}
