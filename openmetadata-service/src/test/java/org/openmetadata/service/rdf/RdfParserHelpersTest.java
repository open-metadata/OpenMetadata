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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/**
 * Unit coverage for the RDF parser helpers that drive the lineage edge
 * canonicalization in {@code parseEntityGraphEdgesFromResults}. These methods
 * are private; we reach them via reflection rather than re-running the full
 * SPARQL → API path so the assertions stay close to the logic under review.
 */
class RdfParserHelpersTest {

  private static RdfRepository repo;
  private static Class<?> edgeInfoClass;
  private static Constructor<?> edgeInfoCtor;

  @BeforeAll
  static void setUp() throws Exception {
    RdfConfiguration cfg = new RdfConfiguration();
    cfg.setEnabled(false);
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
  void isReverseDirectionPredicateRecognizesProvCausationPredicates() throws Exception {
    Method m = privateMethod("isReverseDirectionPredicate", String.class);
    assertTrue((boolean) m.invoke(repo, "http://www.w3.org/ns/prov#wasDerivedFrom"));
    assertTrue((boolean) m.invoke(repo, "http://www.w3.org/ns/prov#wasInfluencedBy"));
    assertFalse((boolean) m.invoke(repo, "https://open-metadata.org/ontology/UPSTREAM"));
    assertFalse((boolean) m.invoke(repo, "http://www.w3.org/ns/prov#wasGeneratedBy"));
    assertFalse((boolean) m.invoke(repo, ""));
    assertFalse((boolean) m.invoke(repo, (Object) null));
  }

  @Test
  void forwardEquivalentPredicateMapsBothCausationPredicatesToUpstream() throws Exception {
    Method m = privateMethod("forwardEquivalentPredicate", String.class);
    String upstream = "https://open-metadata.org/ontology/UPSTREAM";
    assertEquals(upstream, m.invoke(repo, "http://www.w3.org/ns/prov#wasDerivedFrom"));
    // wasInfluencedBy must also collapse to UPSTREAM (not a non-existent DOWNSTREAM URI),
    // so dedup against an existing UPSTREAM edge still works.
    assertEquals(upstream, m.invoke(repo, "http://www.w3.org/ns/prov#wasInfluencedBy"));
    // Non-reverse predicates pass through unchanged so non-lineage edges aren't rewritten.
    String unrelated = "https://open-metadata.org/ontology/hasOwner";
    assertEquals(unrelated, m.invoke(repo, unrelated));
  }

  @Test
  void relativeRelationLabelFlipsForOutgoingFocalEdge() throws Exception {
    String focal = "https://open-metadata.org/entity/table/focal-uuid";
    String other = "https://open-metadata.org/entity/table/other-uuid";

    // Outgoing edge from focal: focal → other where focal is the upstream of other.
    // From focal's perspective, other is downstream.
    Object outgoing = edgeInfoCtor.newInstance(focal, other, "upstream", "om:UPSTREAM");
    assertEquals("downstream", invokeRelativeLabel(outgoing, focal));

    // Incoming edge to focal: other → focal where other is the upstream of focal.
    // From focal's perspective, other is upstream.
    Object incoming = edgeInfoCtor.newInstance(other, focal, "upstream", "om:UPSTREAM");
    assertEquals("upstream", invokeRelativeLabel(incoming, focal));
  }

  @Test
  void relativeRelationLabelLeavesNonFocalEdgesUntouched() throws Exception {
    String focal = "https://open-metadata.org/entity/table/focal-uuid";
    String a = "https://open-metadata.org/entity/table/a";
    String b = "https://open-metadata.org/entity/table/b";

    // Multi-hop edge that doesn't touch the focal: keep raw relation label.
    Object edge = edgeInfoCtor.newInstance(a, b, "upstream", "om:UPSTREAM");
    assertEquals("upstream", invokeRelativeLabel(edge, focal));
  }

  @Test
  void relativeRelationLabelLeavesNonLineageRelationsAlone() throws Exception {
    String focal = "https://open-metadata.org/entity/table/focal-uuid";
    String other = "https://open-metadata.org/entity/user/owner-uuid";

    Object edge = edgeInfoCtor.newInstance(focal, other, "ownedBy", "om:ownedBy");
    assertEquals("ownedBy", invokeRelativeLabel(edge, focal));
  }

  @Test
  void relativeRelationLabelHandlesNullFocal() throws Exception {
    String a = "https://open-metadata.org/entity/table/a";
    String b = "https://open-metadata.org/entity/table/b";
    Object edge = edgeInfoCtor.newInstance(a, b, "upstream", "om:UPSTREAM");
    assertEquals("upstream", invokeRelativeLabel(edge, null));
  }

  private static Method privateMethod(String name, Class<?>... params) throws Exception {
    Method m = RdfRepository.class.getDeclaredMethod(name, params);
    m.setAccessible(true);
    return m;
  }

  private static String invokeRelativeLabel(Object edgeInfo, String focalUri) throws Exception {
    Method m =
        RdfRepository.class.getDeclaredMethod("relativeRelationLabel", edgeInfoClass, String.class);
    m.setAccessible(true);
    return (String) m.invoke(repo, edgeInfo, focalUri);
  }
}
