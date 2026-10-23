package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec.Column;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.rdf.SafeRdfModelParser;

class NativeOntologyCsvCodecTest {
  private static final String EX = "https://example.org/";
  private static final String TURTLE =
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix ex: <https://example.org/> .
      @prefix om: <https://open-metadata.org/ontology/> .

      <https://example.org/shop> a owl:Ontology ;
        rdfs:label "Shop" ;
        rdfs:comment "Orders and customers" .

      <https://example.org/Party> a owl:Class ; rdfs:label "Party" .
      <https://example.org/Customer> a owl:Class ;
        rdfs:label "Customer" ;
        rdfs:comment "Someone who buys" ;
        rdfs:subClassOf <https://example.org/Party> ;
        skos:altLabel "Client" ;
        skos:exactMatch <https://schema.org/Customer> .
      <https://example.org/Segment> a skos:Concept ;
        skos:prefLabel "Segment" ;
        skos:definition "A group of customers" .

      <https://example.org/buys> a owl:ObjectProperty, owl:TransitiveProperty ;
        rdfs:label "buys" ;
        rdfs:domain <https://example.org/Customer> ;
        rdfs:range <https://example.org/Party> ;
        owl:inverseOf <https://example.org/boughtBy> ;
        owl:propertyDisjointWith <https://example.org/sells> .
      <https://example.org/grandparentOf> a owl:ObjectProperty ;
        owl:propertyChainAxiom ( <https://example.org/parentOf> <https://example.org/parentOf> ) .
      <https://example.org/size> a owl:DatatypeProperty ;
        rdfs:range [ a rdfs:Datatype ; owl:oneOf ( "small" "4"^^xsd:integer "a;b\\\"c" ) ] .
      <https://example.org/code> a owl:DatatypeProperty ;
        rdfs:label "code" ;
        rdfs:range xsd:string ;
        om:unitAnnotation "id" ;
        om:identifierIntent true .

      <https://example.org/Customer> rdfs:subClassOf [
        a owl:Restriction ;
        owl:onProperty <https://example.org/buys> ;
        owl:someValuesFrom <https://example.org/Party>
      ] .
      <https://example.org/acme> a <https://example.org/Customer> .
      <https://example.org/acme> <https://example.org/buys> <https://example.org/widget> .
      <https://example.org/acme> <https://example.org/code> "A-1" .
      """;

  private static NativeOntologyDocument fromTurtle() {
    final var model = new SafeRdfModelParser().parse(TURTLE, RdfSerializationFormat.TURTLE);
    try {
      return NativeOntologyRdfImporter.read(model);
    } finally {
      model.close();
    }
  }

  private static String row(final String... columnAndText) {
    final String[] cells = new String[Column.values().length];
    java.util.Arrays.fill(cells, "");
    for (int index = 0; index < columnAndText.length; index += 2) {
      cells[Column.valueOf(columnAndText[index]).ordinal()] = columnAndText[index + 1];
    }
    return NativeOntologyCsvCodec.ROW_FORMAT.format((Object[]) cells);
  }

  private static String csv(final String... rows) {
    return NativeOntologyCsvCodec.HEADER + "\r\n" + String.join("\r\n", rows) + "\r\n";
  }

  private static String concept(final String iri) {
    return row("KIND", "CONCEPT", "IRI", iri, "CONCEPT_TYPE", "OWL_CLASS");
  }

  private static String errorOf(final String csv) {
    return assertThrows(BadRequestException.class, () -> NativeOntologyCsvCodec.read(csv))
        .getMessage();
  }

  @Test
  void writesTheCanonicalCsvForAnOntologyThatUsesEveryColumn() {
    final String expected = readResource("every-column.csv");
    assertEquals(expected, NativeOntologyCsvCodec.write(fromTurtle()));
  }

  @Test
  void writeThenReadThenWriteGivesTheSameBytes() {
    final String written = NativeOntologyCsvCodec.write(fromTurtle());
    final NativeOntologyDocument reread = NativeOntologyCsvCodec.read(written);
    assertEquals(written, NativeOntologyCsvCodec.write(reread));
    assertEquals(fromTurtle(), reread);
  }

  @Test
  void readsTheSameDocumentAsTheRdfReaderForTheSameOntology() {
    final NativeOntologyDocument rdf = fromTurtle();
    final NativeOntologyDocument csv =
        NativeOntologyCsvCodec.read(readResource("every-column.csv"));
    assertEquals(rdf.header(), csv.header());
    assertEquals(rdf.concepts(), csv.concepts());
    assertEquals(rdf.properties(), csv.properties());
    assertEquals(rdf.axioms(), csv.axioms());
  }

  @Test
  void foldsASingleNamedSuperclassIntoTheParentsCellAndKeepsComplexOnesAsAxiomRows() {
    final String written = NativeOntologyCsvCodec.write(fromTurtle());
    assertTrue(written.contains("OWL_CLASS,https://example.org/Party,Client"), written);
    assertEquals(
        1,
        written.lines().filter(line -> line.contains(",SUBCLASS_OF,")).count(),
        "only the restriction superclass stays an axiom row");
  }

  @Test
  void aRepeatedNamedSuperclassStaysAnAxiomRowSoNoStatementIsLost() {
    final OntologyAxiom parent =
        new OntologyAxiom()
            .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
            .withSubjectIri(URI.create(EX + "A"))
            .withExpressions(
                new java.util.ArrayList<>(
                    List.of(NativeOntologyCsvReader.namedClass(URI.create(EX + "B")))));
    final var concept =
        new org.openmetadata.schema.entity.data.OntologyConcept()
            .withIri(URI.create(EX + "A"))
            .withConceptType(org.openmetadata.schema.type.OntologyConceptType.OWL_CLASS);
    final NativeOntologyDocument twice =
        new NativeOntologyDocument(
            null,
            List.of(concept),
            List.of(),
            List.of(parent, JsonUtils.deepCopy(parent, OntologyAxiom.class)));
    final String written = NativeOntologyCsvCodec.write(twice);
    assertEquals(2, NativeOntologyCsvCodec.read(written).axioms().size());
    assertEquals(written, NativeOntologyCsvCodec.write(NativeOntologyCsvCodec.read(written)));
  }

  @Test
  void quotedItemsKeepSemicolonsQuotesAndLineBreaksAndRowNumbersCountRecords() {
    final String csv =
        csv(
            row(
                "KIND",
                "CONCEPT",
                "IRI",
                EX + "A",
                "CONCEPT_TYPE",
                "OWL_CLASS",
                "DESCRIPTION",
                "first line\nsecond line",
                "SYNONYMS",
                "\"a;b\";\"say \"\"hi\"\"\";plain"),
            concept("relative"));
    assertEquals(
        "CSV row 3, column iri: 'relative' is not an absolute IRI",
        errorOf(csv),
        "the multi-line description is one record");
    final NativeOntologyDocument good =
        NativeOntologyCsvCodec.read(csv.replace("relative", EX + "B"));
    assertEquals("first line\nsecond line", good.concepts().getFirst().getDescription());
    assertEquals(
        List.of("a;b", "say \"hi\"", "plain"),
        List.copyOf(good.concepts().getFirst().getSynonyms()));
  }

  @Test
  void rejectsEveryMalformedInputWithTheRowAndColumnAtFault() {
    final String thing = "http://www.w3.org/2002/07/owl#Thing";
    assertEquals(
        "CSV row 1: the header must be exactly " + NativeOntologyCsvCodec.HEADER,
        errorOf("kind,iri\r\nCONCEPT,https://example.org/A\r\n"));
    assertEquals(
        "CSV row 2, column kind: unknown value 'THING'; expected one of"
            + " [ONTOLOGY, CONCEPT, PROPERTY, AXIOM]",
        errorOf(csv(row("KIND", "THING"))));
    assertEquals(
        "CSV row 2, column conceptType: a CONCEPT row requires a value",
        errorOf(csv(row("KIND", "CONCEPT", "IRI", EX + "A"))));
    assertEquals(
        "CSV row 2, column unit: a CONCEPT row leaves this cell empty",
        errorOf(
            csv(
                row(
                    "KIND",
                    "CONCEPT",
                    "IRI",
                    EX + "A",
                    "CONCEPT_TYPE",
                    "OWL_CLASS",
                    "UNIT",
                    "m"))));
    assertEquals(
        "CSV row 2, column conceptType: unknown value 'CLASS'; expected one of"
            + " [SKOS_CONCEPT, OWL_CLASS, BOTH]",
        errorOf(csv(row("KIND", "CONCEPT", "IRI", EX + "A", "CONCEPT_TYPE", "CLASS"))));
    assertEquals(
        "CSV row 2, column iri: '"
            + thing
            + "' belongs to reserved RDF, RDFS, OWL, XSD, or SKOS"
            + " vocabulary",
        errorOf(csv(concept(thing))));
    assertEquals(
        "CSV row 3, column iri: '" + EX + "A' repeats the definition in row 2",
        errorOf(csv(concept(EX + "A"), concept(EX + "A"))));
    assertEquals(
        "CSV row 2, column parents: '" + EX + "B' is listed twice",
        errorOf(
            csv(
                row(
                    "KIND",
                    "CONCEPT",
                    "IRI",
                    EX + "A",
                    "CONCEPT_TYPE",
                    "OWL_CLASS",
                    "PARENTS",
                    EX + "B;" + EX + "B"))));
    assertEquals(
        "CSV row 3: a second ONTOLOGY row; the first is row 2",
        errorOf(csv(row("KIND", "ONTOLOGY"), row("KIND", "ONTOLOGY"))));
    assertEquals(
        "CSV row 2: expected 23 cells but found 2",
        errorOf(NativeOntologyCsvCodec.HEADER + "\r\nCONCEPT,x\r\n"));
  }

  @Test
  void rejectsMalformedCellSyntaxNamingTheColumn() {
    final String axiom = row("KIND", "AXIOM", "IRI", EX + "A", "AXIOM_TYPE", "SUBCLASS_OF");
    assertEquals(
        "CSV row 2, column expressions: unknown expression property 'colour'",
        errorOf(
            csv(
                axiom.replace(
                    "SUBCLASS_OF,,,,",
                    "SUBCLASS_OF,,,,\"[{\"\"kind\"\":\"\"NAMED_CLASS\"\",\"\"colour\"\":1}]\""))));
    assertTrue(
        errorOf(
                csv(
                    row(
                        "KIND",
                        "PROPERTY",
                        "IRI",
                        EX + "p",
                        "PROPERTY_KIND",
                        "DATA",
                        "ENUM_VALUES",
                        "red")))
            .startsWith("CSV row 2, column enumValues: a literal uses N-Triples syntax"));
    assertEquals(
        "CSV row 2: OWL 2 DL profile validation failed: A class axiom requires at least one class"
            + " expression",
        errorOf(csv(axiom)));
  }

  @Test
  void enforcesTheInputAndStatementBudgets() {
    final String oversized = "x".repeat(SafeRdfModelParser.MAX_INPUT_BYTES + 1);
    assertEquals("Native ontology CSV must contain at most 10 MiB of data", errorOf(oversized));
    final String parents =
        IntStream.range(0, SafeRdfModelParser.MAX_TRIPLES)
            .mapToObj(index -> EX + "P" + index)
            .collect(Collectors.joining(";"));
    assertEquals(
        "CSV row 2: the file exceeds its statement or time budget",
        errorOf(
            csv(
                row(
                    "KIND",
                    "CONCEPT",
                    "IRI",
                    EX + "A",
                    "CONCEPT_TYPE",
                    "OWL_CLASS",
                    "PARENTS",
                    parents))));
  }

  @Test
  void headerRecognitionToleratesABomAndACarriageReturn() {
    assertTrue(NativeOntologyCsvCodec.isHeader("\uFEFF" + NativeOntologyCsvCodec.HEADER + "\r"));
    assertEquals(false, NativeOntologyCsvCodec.isHeader("kind,iri,label"));
    assertEquals(false, NativeOntologyCsvCodec.isHeader(null));
  }

  private static String readResource(final String name) {
    try (var stream =
        NativeOntologyCsvCodecTest.class.getResourceAsStream("/ontology/csv/" + name)) {
      return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    } catch (java.io.IOException exception) {
      throw new IllegalStateException(exception);
    }
  }
}
