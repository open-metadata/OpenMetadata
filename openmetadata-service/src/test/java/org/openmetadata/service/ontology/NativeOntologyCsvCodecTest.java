package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
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
        om:abstract true ;
        <http://purl.org/dc/terms/source> <https://example.org/standard> ;
        owl:deprecated true ;
        <http://purl.org/dc/terms/isReplacedBy> <https://example.org/Party> ;
        rdfs:subClassOf <https://example.org/Party> ;
        skos:altLabel "Client" ;
        skos:exactMatch <https://schema.org/Customer> .
      <https://example.org/Segment> a skos:Concept ;
        skos:prefLabel "Segment" ;
        skos:definition "A group of customers" .

      <https://example.org/buys> a owl:ObjectProperty, owl:TransitiveProperty ;
        rdfs:label "buys" ;
        owl:deprecated true ;
        <http://purl.org/dc/terms/isReplacedBy> <https://example.org/grandparentOf> ;
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
  void roundTripsClassAndPropertyMetadata() {
    final NativeOntologyDocument document = fromTurtle();
    document
        .concepts()
        .getFirst()
        .withAbstract(true)
        .withDefinitionSource(URI.create(EX + "standard"))
        .withDeprecated(true)
        .withReplacedBy(URI.create(EX + "Party"));
    document
        .properties()
        .getFirst()
        .withDeprecated(true)
        .withReplacedBy(URI.create(EX + "grandparentOf"));

    final String written = NativeOntologyCsvCodec.write(document);
    final NativeOntologyDocument reread = NativeOntologyCsvCodec.read(written);
    assertEquals(document, reread);
    assertEquals(written, NativeOntologyCsvCodec.write(reread));
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
  void caseDistinctConceptsKeepTheirOwnParentsAfterWriting() {
    final NativeOntologyDocument document =
        NativeOntologyCsvCodec.read(
            csv(
                row(
                    "KIND",
                    "CONCEPT",
                    "IRI",
                    "https://EXAMPLE.org/C",
                    "CONCEPT_TYPE",
                    "OWL_CLASS",
                    "PARENTS",
                    "urn:P"),
                row(
                    "KIND",
                    "CONCEPT",
                    "IRI",
                    "https://example.org/C",
                    "CONCEPT_TYPE",
                    "OWL_CLASS",
                    "PARENTS",
                    "urn:Q")));
    final NativeOntologyDocument reread =
        NativeOntologyCsvCodec.read(NativeOntologyCsvCodec.write(document));
    assertEquals(2, reread.axioms().size());
    assertEquals(
        List.of("https://EXAMPLE.org/C urn:P", "https://example.org/C urn:Q"),
        reread.axioms().stream()
            .map(
                axiom ->
                    axiom.getSubjectIri().toString()
                        + " "
                        + axiom.getExpressions().getFirst().getClassIri().toString())
            .sorted()
            .toList());
  }

  @Test
  void anUndeclaredCaseDistinctSubjectStaysItsOwnAxiom() {
    final NativeOntologyDocument document =
        NativeOntologyCsvCodec.read(
            csv(
                concept("https://EXAMPLE.org/C"),
                row(
                    "KIND",
                    "AXIOM",
                    "AXIOM_TYPE",
                    "SUBCLASS_OF",
                    "IRI",
                    "https://example.org/C",
                    "EXPRESSIONS",
                    "[{\"kind\":\"NAMED_CLASS\",\"classIri\":\"urn:Q\"}]")));
    final String written = NativeOntologyCsvCodec.write(document);
    assertEquals(1, written.lines().filter(line -> line.contains(",SUBCLASS_OF,")).count());
    final NativeOntologyDocument reread = NativeOntologyCsvCodec.read(written);
    assertEquals(1, reread.axioms().size());
    assertEquals("https://example.org/C", reread.axioms().getFirst().getSubjectIri().toString());
    assertEquals(
        "urn:Q", reread.axioms().getFirst().getExpressions().getFirst().getClassIri().toString());
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
  void rejectsLegacyPartialAndReorderedHeaders() {
    final String expected =
        "CSV row 1: the header must be exactly " + NativeOntologyCsvCodec.HEADER;
    final String legacy =
        NativeOntologyCsvCodec.HEADER.substring(
            0, NativeOntologyCsvCodec.HEADER.indexOf(",abstract"));
    for (final String header :
        List.of(
            legacy, "kind,iri", NativeOntologyCsvCodec.HEADER.replace("kind,iri", "iri,kind"))) {
      assertEquals(expected, errorOf(header + "\r\n"));
      assertEquals(false, NativeOntologyCsvCodec.isHeader(header));
    }
  }

  @Test
  void metadataCellsRequireTrueOrEmptyFlagsAndAbsoluteIris() {
    for (final String flag : List.of("ABSTRACT", "DEPRECATED")) {
      for (final String invalid : List.of("false", "TRUE", "1", "0", "yes", " true")) {
        assertTrue(
            errorOf(
                    csv(
                        row(
                            "KIND",
                            "CONCEPT",
                            "IRI",
                            EX + "A",
                            "CONCEPT_TYPE",
                            "OWL_CLASS",
                            flag,
                            invalid)))
                .endsWith("expected true or an empty cell"));
      }
    }
    for (final String column : List.of("DEFINITION_SOURCE", "REPLACED_BY")) {
      assertTrue(
          errorOf(
                  csv(
                      row(
                          "KIND",
                          "CONCEPT",
                          "IRI",
                          EX + "A",
                          "CONCEPT_TYPE",
                          "OWL_CLASS",
                          column,
                          "relative")))
              .endsWith("'relative' is not an absolute IRI"));
    }
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
                        "DEPRECATED",
                        "false")))
            .endsWith("expected true or an empty cell"));
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
                        "REPLACED_BY",
                        "relative")))
            .endsWith("'relative' is not an absolute IRI"));
    final var defaults =
        NativeOntologyCsvCodec.read(
            csv(
                concept(EX + "A"),
                row("KIND", "PROPERTY", "IRI", EX + "p", "PROPERTY_KIND", "DATA")));
    assertEquals(Boolean.FALSE, defaults.concepts().getFirst().getAbstract());
    assertEquals(Boolean.FALSE, defaults.concepts().getFirst().getDeprecated());
    assertEquals(Boolean.FALSE, defaults.properties().getFirst().getDeprecated());
  }

  @Test
  void metadataIsRejectedOnInapplicableRowKinds() {
    for (final String column :
        List.of("ABSTRACT", "DEFINITION_SOURCE", "DEPRECATED", "REPLACED_BY")) {
      final String value =
          column.equals("ABSTRACT") || column.equals("DEPRECATED") ? "true" : EX + "B";
      for (final String kind : List.of("ONTOLOGY", "AXIOM")) {
        assertTrue(
            errorOf(
                    csv(
                        row(
                            "KIND",
                            kind,
                            "IRI",
                            EX + "A",
                            "AXIOM_TYPE",
                            kind.equals("AXIOM") ? "SUBCLASS_OF" : "",
                            column,
                            value)))
                .endsWith("a " + kind + " row leaves this cell empty"));
      }
    }
    for (final String column : List.of("ABSTRACT", "DEFINITION_SOURCE")) {
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
                          column,
                          "true")))
              .endsWith("a PROPERTY row leaves this cell empty"));
    }
  }

  @Test
  void rejectsPropertyMetadataThatTheKindCannotCarryNamingTheColumn() {
    assertEquals(
        "CSV row 2, column unit: only a DATA property can define a unit",
        errorOf(
            csv(
                row(
                    "KIND",
                    "PROPERTY",
                    "IRI",
                    EX + "p",
                    "PROPERTY_KIND",
                    "OBJECT",
                    "UNIT",
                    "kg"))));
    assertEquals(
        "CSV row 2, column inverse: only an OBJECT property can have an inverse",
        errorOf(
            csv(
                row(
                    "KIND",
                    "PROPERTY",
                    "IRI",
                    EX + "p",
                    "PROPERTY_KIND",
                    "DATA",
                    "INVERSE",
                    EX + "q"))));
    assertEquals(
        "CSV row 2, column identifier: only a DATA property can be an identifier",
        errorOf(
            csv(
                row(
                    "KIND",
                    "PROPERTY",
                    "IRI",
                    EX + "p",
                    "PROPERTY_KIND",
                    "ANNOTATION",
                    "IDENTIFIER",
                    "true"))));
    assertEquals(
        "CSV row 2, column characteristics: TRANSITIVE is not allowed on a DATA property",
        errorOf(
            csv(
                row(
                    "KIND",
                    "PROPERTY",
                    "IRI",
                    EX + "p",
                    "PROPERTY_KIND",
                    "DATA",
                    "CHARACTERISTICS",
                    "TRANSITIVE"))));
  }

  @Test
  void rejectsExpressionCellsWithTextAfterTheJsonValue() {
    assertTrue(
        errorOf(
                csv(
                    row(
                        "KIND",
                        "AXIOM",
                        "IRI",
                        EX + "A",
                        "AXIOM_TYPE",
                        "SUBCLASS_OF",
                        "EXPRESSIONS",
                        "[] []")))
            .startsWith("CSV row 2, column expressions: malformed JSON: Trailing token"));
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
        "CSV row 2: expected 27 cells but found 2",
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
  void rejectsMalformedMultiValueIriMappingLiteralAndExpressionCells() {
    assertEquals(
        "CSV row 2, column parents: an empty item is not allowed",
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
                    EX + "B;"))));
    assertEquals(
        "CSV row 2, column iri: 'https://example.org/bad iri' is not an absolute IRI",
        errorOf(csv(concept("https://example.org/bad iri"))));
    assertEquals(
        "CSV row 2, column mappings: mapping 'EXACT' must be TYPE:iri",
        errorOf(
            csv(
                row(
                    "KIND",
                    "CONCEPT",
                    "IRI",
                    EX + "A",
                    "CONCEPT_TYPE",
                    "OWL_CLASS",
                    "MAPPINGS",
                    "EXACT"))));
    final String taggedLiteral = NativeOntologyCsvCells.join(List.of("\"red\"@en"));
    final String malformedLiteral = NativeOntologyCsvCells.join(List.of("\"unterminated"));
    assertEquals(
        "CSV row 2, column enumValues: language-tagged literals cannot be represented in native ontologies",
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
                    taggedLiteral))));
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
                        malformedLiteral)))
            .startsWith("CSV row 2, column enumValues: malformed N-Triples literal:"));
    assertEquals(
        "CSV row 2, column expressions: malformed JSON: expected an array of expressions",
        errorOf(
            csv(
                row(
                    "KIND",
                    "AXIOM",
                    "IRI",
                    EX + "A",
                    "AXIOM_TYPE",
                    "SUBCLASS_OF",
                    "EXPRESSIONS",
                    "null"))));
    assertTrue(
        errorOf(
                csv(
                    row(
                        "KIND",
                        "AXIOM",
                        "IRI",
                        EX + "A",
                        "AXIOM_TYPE",
                        "SUBCLASS_OF",
                        "EXPRESSIONS",
                        "[")))
            .startsWith("CSV row 2, column expressions: malformed JSON:"));
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
  void countsCsvRowsTowardTheDefinitionLimit() {
    final String[] rows =
        IntStream.range(0, 1001)
            .mapToObj(index -> concept(EX + "C" + index))
            .toArray(String[]::new);
    assertEquals(
        1000,
        NativeOntologyCsvCodec.read(csv(java.util.Arrays.copyOf(rows, 1000))).concepts().size());
    assertEquals("CSV row 1002: at most 1000 definitions are allowed", errorOf(csv(rows)));
  }

  @Test
  void headerRecognitionToleratesABomAndACarriageReturn() {
    assertTrue(NativeOntologyCsvCodec.isHeader("\uFEFF" + NativeOntologyCsvCodec.HEADER + "\r"));
    assertEquals(false, NativeOntologyCsvCodec.isHeader("kind,iri,label"));
    assertEquals(false, NativeOntologyCsvCodec.isHeader("kind,\"iri\"oops"));
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

  @Test
  void documentedHeaderAndExampleMatchTheCodec() throws Exception {
    final Path doc = Path.of("..", "docs", "native-ontology-csv.md");
    final List<String> lines = Files.readAllLines(doc, StandardCharsets.UTF_8);

    final List<String> headerLines =
        lines.stream().filter(NativeOntologyCsvCodec::isHeader).collect(Collectors.toList());
    assertEquals(
        List.of(NativeOntologyCsvCodec.HEADER, NativeOntologyCsvCodec.HEADER), headerLines);

    final int example = lines.lastIndexOf(NativeOntologyCsvCodec.HEADER);
    final String csv = String.join("\r\n", lines.subList(example, lines.size() - 1)) + "\r\n";
    assertEquals(2, NativeOntologyCsvCodec.read(csv).concepts().size());
  }
}
