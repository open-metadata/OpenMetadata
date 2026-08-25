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
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/**
 * Real-behavior coverage for the pure/private helpers that build and filter the
 * 3D Knowledge Graph response in {@link RdfRepository}. These methods are
 * private; we reach them via reflection rather than re-running the full
 * SPARQL → API path so the assertions stay close to the logic under review.
 *
 * <p>The harness mirrors {@code RdfParserHelpersTest}: it constructs a
 * disabled {@link RdfRepository} with a configured baseUri (the entity-URI
 * helpers depend on it) and installs it as the singleton, then resets the
 * singleton in {@code @AfterAll}.
 */
class RdfGraphHelpersTest {

  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String ONTOLOGY_PREFIX = "https://open-metadata.org/ontology/";
  private static final String PROV_PREFIX = "http://www.w3.org/ns/prov#";

  private static RdfRepository repo;
  private static Class<?> edgeInfoClass;
  private static Constructor<?> edgeInfoCtor;

  @BeforeAll
  static void setUp() throws Exception {
    RdfConfiguration cfg = new RdfConfiguration();
    cfg.setEnabled(false);
    cfg.setBaseUri(URI.create(BASE_URI));
    Constructor<RdfRepository> ctor =
        RdfRepository.class.getDeclaredConstructor(RdfConfiguration.class);
    ctor.setAccessible(true);
    repo = ctor.newInstance(cfg);
    Field instance = RdfRepository.class.getDeclaredField("INSTANCE");
    instance.setAccessible(true);
    instance.set(null, repo);

    edgeInfoClass = Class.forName("org.openmetadata.service.rdf.RdfRepository$EdgeInfo");
    edgeInfoCtor =
        edgeInfoClass.getDeclaredConstructor(
            String.class, String.class, String.class, String.class);
    edgeInfoCtor.setAccessible(true);
  }

  @AfterAll
  static void tearDown() {
    RdfRepository.reset();
  }

  @Test
  void formatRelationshipLabelMapsKnownRelation() throws Exception {
    Method m = privateMethod("formatRelationshipLabel", String.class);
    assertEquals("Has Column", m.invoke(repo, "hascolumn"));
  }

  @Test
  void formatRelationshipLabelHandlesEmptyStringWithoutThrowing() throws Exception {
    Method m = privateMethod("formatRelationshipLabel", String.class);
    assertEquals("", m.invoke(repo, ""));
  }

  @Test
  void formatRelationshipLabelTitleCasesUnknownCamelCaseRelation() throws Exception {
    Method m = privateMethod("formatRelationshipLabel", String.class);
    assertEquals("Some New Rel", m.invoke(repo, "someNewRel"));
  }

  @Test
  void extractEntityRelationTypeMapsCausationPredicatesToDirection() throws Exception {
    Method m = privateMethod("extractEntityRelationType", String.class);
    assertEquals("upstream", m.invoke(repo, PROV_PREFIX + "wasDerivedFrom"));
    assertEquals("downstream", m.invoke(repo, PROV_PREFIX + "wasInfluencedBy"));
    assertEquals("upstream", m.invoke(repo, ONTOLOGY_PREFIX + "UPSTREAM"));
  }

  @Test
  void extractEntityRelationTypeReturnsNullForMissingPredicate() throws Exception {
    Method m = privateMethod("extractEntityRelationType", String.class);
    assertNull(m.invoke(repo, (Object) null));
    assertNull(m.invoke(repo, ""));
  }

  @Test
  void isEntityUriRecognizesWellFormedEntityUri() throws Exception {
    Method m = privateMethod("isEntityUri", String.class);
    assertTrue(
        (boolean) m.invoke(repo, entityUri("table", "11111111-1111-1111-1111-111111111111")));
  }

  @Test
  void isEntityUriRejectsNonEntityAndMalformedUris() throws Exception {
    Method m = privateMethod("isEntityUri", String.class);
    assertFalse((boolean) m.invoke(repo, ONTOLOGY_PREFIX + "UPSTREAM"));
    assertFalse((boolean) m.invoke(repo, BASE_URI + "entity/table"));
  }

  @Test
  void escapeSparqlUriRejectsInvalidUris() throws Exception {
    Method m = privateMethod("escapeSparqlUri", String.class);
    assertSparqlUriRejected(m, null);
    assertSparqlUriRejected(m, "   ");
    assertSparqlUriRejected(m, "https://open-metadata.org/<injected>");
    assertSparqlUriRejected(m, "https://open-metadata.org/has space");
    assertSparqlUriRejected(m, "entity/table/x");
  }

  @Test
  void escapeSparqlUriReturnsValidAbsoluteIriUnchanged() throws Exception {
    Method m = privateMethod("escapeSparqlUri", String.class);
    String uri = entityUri("table", "abc");
    assertEquals(uri, m.invoke(repo, uri));
  }

  @Test
  void relativeRelationLabelFlipsUpstreamWhenFocalIsSource() throws Exception {
    String focal = entityUri("table", "focal");
    String other = entityUri("table", "other");
    Object edge = edgeInfoCtor.newInstance(focal, other, "upstream", ONTOLOGY_PREFIX + "UPSTREAM");
    assertEquals("downstream", invokeRelativeLabel(edge, focal));
  }

  @Test
  void relativeRelationLabelLeavesNonLineageRelationUnchanged() throws Exception {
    String focal = entityUri("table", "focal");
    String other = entityUri("column", "col");
    Object edge = edgeInfoCtor.newInstance(focal, other, "contains", ONTOLOGY_PREFIX + "contains");
    assertEquals("contains", invokeRelativeLabel(edge, focal));
  }

  @Test
  void relativeRelationLabelLeavesEdgeNotTouchingFocalUnchanged() throws Exception {
    String focal = entityUri("table", "focal");
    String a = entityUri("table", "a");
    String b = entityUri("table", "b");
    Object edge = edgeInfoCtor.newInstance(a, b, "upstream", ONTOLOGY_PREFIX + "UPSTREAM");
    assertEquals("upstream", invokeRelativeLabel(edge, focal));
  }

  @Test
  void applyGraphFiltersReturnsInputUnchangedWhenNoFilters() throws Exception {
    String root = entityUri("table", "root");
    String column = entityUri("column", "c1");
    Set<String> nodes = new HashSet<>(List.of(root, column));
    List<Object> edges =
        List.of(edgeInfoCtor.newInstance(root, column, "contains", ONTOLOGY_PREFIX + "contains"));

    Object filtered = invokeApplyGraphFilters(root, nodes, edges, Set.of(), Set.of());

    assertEquals(nodes, filteredNodeUris(filtered));
    assertSame(edges, filteredEdgesRaw(filtered));
  }

  @Test
  void applyGraphFiltersKeepsRootAndMatchingTypesDropsOthers() throws Exception {
    String root = entityUri("table", "root");
    String otherTable = entityUri("table", "t2");
    String column = entityUri("column", "c1");
    String dashboard = entityUri("dashboard", "d1");
    Set<String> nodes = new HashSet<>(List.of(root, otherTable, column, dashboard));
    List<Object> edges =
        List.of(
            edgeInfoCtor.newInstance(root, otherTable, "upstream", ONTOLOGY_PREFIX + "UPSTREAM"),
            edgeInfoCtor.newInstance(root, column, "contains", ONTOLOGY_PREFIX + "contains"),
            edgeInfoCtor.newInstance(dashboard, root, "uses", ONTOLOGY_PREFIX + "uses"));

    Object filtered = invokeApplyGraphFilters(root, nodes, edges, Set.of("table"), Set.of());

    Set<String> resultNodes = filteredNodeUris(filtered);
    assertTrue(resultNodes.contains(root));
    assertTrue(resultNodes.contains(otherTable));
    assertFalse(resultNodes.contains(column));
    assertFalse(resultNodes.contains(dashboard));
    List<String> relations = edgeRelations(filtered);
    assertEquals(List.of("upstream"), relations);
  }

  @Test
  void applyGraphFiltersDropsDisallowedRelationsAndPrunesDisconnectedNodes() throws Exception {
    String root = entityUri("table", "root");
    String upstreamTable = entityUri("table", "t2");
    String column = entityUri("column", "c1");
    Set<String> nodes = new HashSet<>(List.of(root, upstreamTable, column));
    List<Object> edges =
        List.of(
            edgeInfoCtor.newInstance(root, upstreamTable, "upstream", ONTOLOGY_PREFIX + "UPSTREAM"),
            edgeInfoCtor.newInstance(root, column, "contains", ONTOLOGY_PREFIX + "contains"));

    Object filtered = invokeApplyGraphFilters(root, nodes, edges, Set.of(), Set.of("upstream"));

    List<String> relations = edgeRelations(filtered);
    assertEquals(List.of("upstream"), relations);
    Set<String> resultNodes = filteredNodeUris(filtered);
    assertTrue(resultNodes.contains(root));
    assertTrue(resultNodes.contains(upstreamTable));
    assertFalse(resultNodes.contains(column));
  }

  @Test
  void parseEntityGraphEdgesCollapsesForwardAndReversePredicatesToOneCanonicalEdge()
      throws Exception {
    String a = entityUri("table", "a");
    String b = entityUri("table", "b");
    String json =
        sparqlResults(
            List.of(
                binding(a, ONTOLOGY_PREFIX + "UPSTREAM", b),
                binding(b, PROV_PREFIX + "wasInfluencedBy", a)));

    Object batch = invokeParseEdges(json);

    List<Object> edges = edgeBatchEdges(batch);
    assertEquals(1, edges.size());
    Object edge = edges.get(0);
    assertEquals("upstream", edgeField(edge, "relation"));
    assertEquals(a, edgeField(edge, "fromUri"));
    assertEquals(b, edgeField(edge, "toUri"));
    assertFalse(edgeBatchReachedLimit(batch));
  }

  @Test
  void parseEntityGraphEdgesDropsBindingsWithNonEntityObject() throws Exception {
    String a = entityUri("table", "a");
    String json =
        sparqlResults(
            List.of(binding(a, ONTOLOGY_PREFIX + "UPSTREAM", ONTOLOGY_PREFIX + "SomeConcept")));

    Object batch = invokeParseEdges(json);

    assertTrue(edgeBatchEdges(batch).isEmpty());
    assertFalse(edgeBatchReachedLimit(batch));
  }

  private static String entityUri(String type, String id) {
    return BASE_URI + "entity/" + type + "/" + id;
  }

  private static Method privateMethod(String name, Class<?>... params) throws Exception {
    Method m = RdfRepository.class.getDeclaredMethod(name, params);
    m.setAccessible(true);
    return m;
  }

  private static void assertSparqlUriRejected(Method escapeMethod, String uri) {
    assertThrows(
        IllegalArgumentException.class,
        () -> {
          try {
            escapeMethod.invoke(repo, uri);
          } catch (java.lang.reflect.InvocationTargetException e) {
            throw e.getCause();
          }
        });
  }

  private static String invokeRelativeLabel(Object edgeInfo, String focalUri) throws Exception {
    Method m =
        RdfRepository.class.getDeclaredMethod("relativeRelationLabel", edgeInfoClass, String.class);
    m.setAccessible(true);
    return (String) m.invoke(repo, edgeInfo, focalUri);
  }

  private static Object invokeApplyGraphFilters(
      String rootUri,
      Set<String> nodeUris,
      List<Object> edges,
      Set<String> entityTypeFilters,
      Set<String> relationshipTypeFilters)
      throws Exception {
    Method m =
        RdfRepository.class.getDeclaredMethod(
            "applyGraphFilters", String.class, Set.class, List.class, Set.class, Set.class);
    m.setAccessible(true);
    return m.invoke(repo, rootUri, nodeUris, edges, entityTypeFilters, relationshipTypeFilters);
  }

  private static Object invokeParseEdges(String sparqlResults) throws Exception {
    Method m =
        RdfRepository.class.getDeclaredMethod(
            "parseEntityGraphEdgesFromResults",
            String.class,
            Set.class,
            Set.class,
            Set.class,
            Set.class);
    m.setAccessible(true);
    return m.invoke(
        repo,
        sparqlResults,
        new HashSet<String>(),
        new HashSet<String>(),
        new HashSet<String>(),
        new HashSet<String>());
  }

  @SuppressWarnings("unchecked")
  private static Set<String> filteredNodeUris(Object filteredGraph) throws Exception {
    Method m = filteredGraph.getClass().getDeclaredMethod("nodeUris");
    m.setAccessible(true);
    return (Set<String>) m.invoke(filteredGraph);
  }

  private static Object filteredEdgesRaw(Object filteredGraph) throws Exception {
    Method m = filteredGraph.getClass().getDeclaredMethod("edges");
    m.setAccessible(true);
    return m.invoke(filteredGraph);
  }

  private static List<String> edgeRelations(Object filteredGraph) throws Exception {
    Object edges = filteredEdgesRaw(filteredGraph);
    List<String> relations = new ArrayList<>();
    for (Object edge : (List<?>) edges) {
      relations.add((String) edgeField(edge, "relation"));
    }
    return relations;
  }

  @SuppressWarnings("unchecked")
  private static List<Object> edgeBatchEdges(Object edgeBatch) throws Exception {
    Method m = edgeBatch.getClass().getDeclaredMethod("edges");
    m.setAccessible(true);
    return (List<Object>) m.invoke(edgeBatch);
  }

  private static boolean edgeBatchReachedLimit(Object edgeBatch) throws Exception {
    Method m = edgeBatch.getClass().getDeclaredMethod("reachedLimit");
    m.setAccessible(true);
    return (boolean) m.invoke(edgeBatch);
  }

  private static Object edgeField(Object edge, String fieldName) throws Exception {
    Field f = edgeInfoClass.getDeclaredField(fieldName);
    f.setAccessible(true);
    return f.get(edge);
  }

  private static String binding(String subject, String predicate, String object) {
    return "{"
        + "\"subject\":{\"type\":\"uri\",\"value\":\""
        + subject
        + "\"},"
        + "\"predicate\":{\"type\":\"uri\",\"value\":\""
        + predicate
        + "\"},"
        + "\"object\":{\"type\":\"uri\",\"value\":\""
        + object
        + "\"}"
        + "}";
  }

  private static String sparqlResults(List<String> bindings) {
    return "{"
        + "\"head\":{\"vars\":[\"subject\",\"predicate\",\"object\"]},"
        + "\"results\":{\"bindings\":["
        + String.join(",", bindings)
        + "]}}";
  }
}
