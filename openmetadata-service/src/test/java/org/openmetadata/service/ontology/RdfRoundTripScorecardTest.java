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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.riot.RDFParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.ontology.RdfRoundTripScorecard.Construct;
import org.openmetadata.service.ontology.RdfRoundTripScorecard.ConstructScore;
import org.openmetadata.service.ontology.RdfRoundTripScorecard.Scorecard;

class RdfRoundTripScorecardTest {
  private static final String SOURCE =
      """
      @prefix ex: <https://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:Child a owl:Class ;
          rdfs:label "Child" ;
          rdfs:comment "lost annotation" ;
          rdfs:subClassOf ex:Left, ex:Right,
              [ a owl:Restriction ; owl:onProperty ex:related ; owl:someValuesFrom ex:Right ] .
      ex:Left a owl:Class .
      ex:Right a owl:Class .
      ex:related a owl:ObjectProperty, owl:SymmetricProperty .
      ex:code a owl:DatatypeProperty ; rdfs:domain ex:Child ; rdfs:range xsd:string .
      """;

  private static final String ENTITY =
      """
      @prefix ex: <https://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

      ex:Child a owl:Class ; rdfs:subClassOf ex:Left, ex:Right .
      ex:Left a owl:Class .
      ex:Right a owl:Class .
      ex:related a owl:ObjectProperty, owl:SymmetricProperty .
      """;

  private static final String ANNEX =
      """
      @prefix ex: <https://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:Child rdfs:label "Child" ;
          rdfs:subClassOf
              [ a owl:Restriction ; owl:onProperty ex:related ; owl:someValuesFrom ex:Right ] .
      ex:code a owl:DatatypeProperty ; rdfs:domain ex:Child ; rdfs:range xsd:string .
      """;

  @Test
  void categorizesEntityAnnexAndLostTriples(@TempDir final Path tempDir) throws Exception {
    final RdfRoundTripScorecard scorer = new RdfRoundTripScorecard();
    final Model source = parse(SOURCE);
    final Model entity = parse(ENTITY);
    final Model annex = parse(ANNEX);
    final Model exported = ModelFactory.createUnion(entity, annex);
    try {
      final Scorecard scorecard = scorer.analyze("fixture.rdf", source, exported, nquads(annex));

      assertEquals(1, scorecard.preservation().lost());
      assertTrue(scorecard.preservation().entityModel() > 0);
      assertTrue(scorecard.preservation().annex() > 0);
      assertEquals(3, construct(scorecard, Construct.POLYHIERARCHY_EDGES).sourceTriples());
      assertTrue(construct(scorecard, Construct.RESTRICTIONS).preservation().annex() > 0);

      final Path output = tempDir.resolve("scorecard.md");
      scorer.writeMarkdown(scorecard, output);
      final String markdown = Files.readString(output);
      assertTrue(markdown.contains("RDF round-trip scorecard: fixture.rdf"));
      assertTrue(markdown.contains("| OWL restrictions |"));
    } finally {
      exported.close();
      annex.close();
      entity.close();
      source.close();
    }
  }

  private static ConstructScore construct(final Scorecard scorecard, final Construct construct) {
    return scorecard.constructs().stream()
        .filter(score -> score.construct() == construct)
        .findFirst()
        .orElseThrow();
  }

  private static Model parse(final String turtle) {
    final Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(turtle).lang(Lang.TURTLE).parse(model);
    return model;
  }

  private static String nquads(final Model model) {
    final StringWriter writer = new StringWriter();
    RDFDataMgr.write(writer, model, RDFFormat.NQUADS_UTF8);
    return writer.toString();
  }
}
