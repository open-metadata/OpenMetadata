/*
 *  Copyright 2024 Collate.
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.StringReader;
import java.util.List;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.rdf.GlossaryRdfImporter.DatatypeIntent;
import org.openmetadata.service.rdf.GlossaryRdfImporter.TermIntent;

/** Unit tests for the OWL/SKOS &rarr; glossary-term parsing in {@link GlossaryRdfImporter}. */
class GlossaryRdfImporterTest {
  private static final String HCP = "http://example.com/ontology/hcp#";

  private static final String ONTOLOGY =
      """
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix owl:  <http://www.w3.org/2002/07/owl#> .
      @prefix hcp:  <http://example.com/ontology/hcp#> .
      @prefix sct:  <http://snomed.info/id/> .
      @prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

      hcp:scheme a skos:ConceptScheme ; rdfs:label "HCP Scheme" .

      hcp:HealthcareProvider a skos:Concept ;
          skos:prefLabel "Healthcare Provider" ;
          skos:definition "A person who delivers care." ;
          skos:altLabel "HCP" , "Provider" ;
          skos:closeMatch sct:158965000 ;
          skos:inScheme hcp:scheme .

      hcp:Physician a owl:Class ;
          skos:prefLabel "Physician" ;
          rdfs:subClassOf hcp:HealthcareProvider ;
          hcp:prescribes hcp:Drug ;
          skos:inScheme hcp:scheme .

      hcp:Drug a skos:Concept ;
          skos:prefLabel "Drug" ;
          skos:inScheme hcp:scheme .

      hcp:prescribes a owl:ObjectProperty, owl:FunctionalProperty ;
          rdfs:label "prescribes" ;
          rdfs:domain hcp:Physician ;
          rdfs:range hcp:Drug ;
          owl:inverseOf hcp:prescribedBy .

      hcp:hasNpiNumber a owl:DatatypeProperty ;
          rdfs:label "has NPI number" ;
          rdfs:domain hcp:HealthcareProvider ;
          rdfs:range xsd:string ;
          rdfs:comment "10-digit National Provider Identifier." .

      hcp:hasYearsExperience a owl:DatatypeProperty ;
          rdfs:domain hcp:HealthcareProvider ;
          rdfs:range xsd:integer .
      """;

  @Test
  void parsesConceptsHierarchySynonymsMappingsAndRelations() {
    List<TermIntent> intents = parse(ONTOLOGY);

    assertEquals(3, intents.size(), "should parse skos:Concept and owl:Class as terms");

    TermIntent provider = find(intents, HCP + "HealthcareProvider");
    assertEquals("HealthcareProvider", provider.name);
    assertEquals("Healthcare Provider", provider.displayName);
    assertEquals("A person who delivers care.", provider.description);
    assertEquals(2, provider.synonyms.size(), "both skos:altLabel values become synonyms");
    assertTrue(provider.synonyms.containsAll(List.of("HCP", "Provider")));
    assertNull(provider.parentIri, "root concept has no parent");
    assertEquals(1, provider.conceptMappings.size(), "external skos:closeMatch -> conceptMapping");
    ConceptMapping mapping = provider.conceptMappings.get(0);
    assertEquals(ConceptMapping.ConceptMappingType.CLOSE_MATCH, mapping.getMappingType());
    assertEquals("http://snomed.info/id/158965000", mapping.getConceptIri().toString());

    TermIntent physician = find(intents, HCP + "Physician");
    assertEquals(HCP + "HealthcareProvider", physician.parentIri, "rdfs:subClassOf -> parent");
    assertEquals(1, physician.relations.size(), "custom object property -> typed relation");
    assertEquals("prescribes", physician.relations.get(0)[0]);
    assertEquals(HCP + "Drug", physician.relations.get(0)[1]);

    TermIntent drug = find(intents, HCP + "Drug");
    assertNull(drug.parentIri);
    assertTrue(drug.relations.isEmpty());
  }

  @Test
  void capturesObjectPropertyDomainRangeAndCharacteristics() {
    Model model = ModelFactory.createDefaultModel();
    model.read(new StringReader(ONTOLOGY), null, "TURTLE");

    GlossaryTermRelationType type =
        new GlossaryRdfImporter(null, "test", true).buildRelationType(model, "prescribes");

    assertEquals("prescribes", type.getDisplayName(), "rdfs:label -> displayName");
    assertEquals("prescribedBy", type.getInverseRelation(), "owl:inverseOf -> inverseRelation");
    assertEquals(List.of(HCP + "Physician"), type.getDomain(), "rdfs:domain -> domain");
    assertEquals(List.of(HCP + "Drug"), type.getRange(), "rdfs:range -> range");
    assertTrue(type.getIsFunctional(), "owl:FunctionalProperty -> isFunctional");
    assertEquals(Boolean.FALSE, type.getIsSymmetric(), "no owl:SymmetricProperty -> not symmetric");
  }

  @Test
  void parsesDatatypePropertiesAndMapsXsdTypes() {
    Model model = ModelFactory.createDefaultModel();
    model.read(new StringReader(ONTOLOGY), null, "TURTLE");
    GlossaryRdfImporter importer = new GlossaryRdfImporter(null, "test", true);

    List<DatatypeIntent> datatypes = importer.buildDatatypeIntents(model);
    assertEquals(2, datatypes.size(), "both owl:DatatypeProperty become attribute intents");

    DatatypeIntent npi =
        datatypes.stream()
            .filter(d -> (HCP + "hasNpiNumber").equals(d.iri))
            .findFirst()
            .orElseThrow();
    assertEquals("hasNpiNumber", npi.name, "local name -> custom property name");
    assertEquals(HCP + "HealthcareProvider", npi.domainIri, "rdfs:domain captured");
    assertEquals("string", importer.customPropertyTypeFor(npi.xsdType), "xsd:string -> string");

    DatatypeIntent years =
        datatypes.stream()
            .filter(d -> (HCP + "hasYearsExperience").equals(d.iri))
            .findFirst()
            .orElseThrow();
    assertEquals(
        "integer", importer.customPropertyTypeFor(years.xsdType), "xsd:integer -> integer");
    assertEquals(
        "number",
        importer.customPropertyTypeFor("http://www.w3.org/2001/XMLSchema#double"),
        "xsd:double -> number");
  }

  @Test
  void rejectsOversizedPayload() {
    String huge = "x".repeat(10 * 1024 * 1024 + 1);
    GlossaryRdfImporter importer = new GlossaryRdfImporter(null, "test", true);

    BadRequestException ex =
        assertThrows(
            BadRequestException.class, () -> importer.importRdf(huge, "turtle", "g", true));
    assertTrue(ex.getMessage().contains("exceeds the maximum"), ex.getMessage());
  }

  @Test
  void rejectsRdfXmlWithDoctypeToPreventXxe() {
    String xxe =
        """
        <?xml version="1.0"?>
        <!DOCTYPE rdf:RDF [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/>
        """;
    GlossaryRdfImporter importer = new GlossaryRdfImporter(null, "test", true);

    BadRequestException ex =
        assertThrows(BadRequestException.class, () -> importer.importRdf(xxe, "rdfxml", "g", true));
    assertTrue(ex.getMessage().contains("DOCTYPE"), ex.getMessage());
  }

  @Test
  void rejectsEmptyPayloadWithBadRequest() {
    GlossaryRdfImporter importer = new GlossaryRdfImporter(null, "test", true);

    BadRequestException ex =
        assertThrows(BadRequestException.class, () -> importer.importRdf("", "turtle", "g", true));
    assertTrue(ex.getMessage().contains("must not be empty"), ex.getMessage());
  }

  @Test
  void rejectsJsonLdToPreventSsrf() {
    String jsonld = "{\"@context\": \"http://169.254.169.254/latest/meta-data/\", \"@id\": \"x\"}";
    GlossaryRdfImporter importer = new GlossaryRdfImporter(null, "test", true);

    BadRequestException ex =
        assertThrows(
            BadRequestException.class, () -> importer.importRdf(jsonld, "jsonld", "g", true));
    assertTrue(ex.getMessage().contains("JSON-LD"), ex.getMessage());
  }

  private List<TermIntent> parse(String turtle) {
    Model model = ModelFactory.createDefaultModel();
    model.read(new StringReader(turtle), null, "TURTLE");
    return new GlossaryRdfImporter(null, "test", true).buildTermIntents(model);
  }

  private TermIntent find(List<TermIntent> intents, String iri) {
    TermIntent match =
        intents.stream().filter(intent -> iri.equals(intent.iri)).findFirst().orElse(null);
    assertNotNull(match, "expected term " + iri);
    return match;
  }
}
