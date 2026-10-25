package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;

class OntologyFormatDetectorTest {
  private static final String TURTLE =
      "@prefix ex: <https://example.org/> .\nex:A a <http://www.w3.org/2002/07/owl#Class> .\n";
  private static final String RDF_XML =
      "<?xml version=\"1.0\"?>\n<rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"/>\n";
  private static final String N_TRIPLES =
      "<https://example.org/A> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>"
          + " <http://www.w3.org/2002/07/owl#Class> .\n"
          + "<https://example.org/A> <http://www.w3.org/2000/01/rdf-schema#label> \"A\"@en .\n";
  private static final String JSON_LD = "{\"@id\": \"https://example.org/A\"}";
  private static final String CSV = NativeOntologyCsvCodec.HEADER + "\r\n";

  private static Optional<NativeOntologyImportFormat> detect(
      final String content, final String fileName) {
    return OntologyFormatDetector.detect(content, fileName);
  }

  @ParameterizedTest
  @CsvSource({"TURTLE", "RDFXML", "NTRIPLES", "JSONLD", "CSV"})
  void detectsEachFormatFromContentAloneWhenNoFileNameIsGiven(final String name) {
    final NativeOntologyImportFormat format = NativeOntologyImportFormat.valueOf(name);
    final String content =
        switch (format) {
          case TURTLE -> TURTLE;
          case RDFXML -> RDF_XML;
          case NTRIPLES -> N_TRIPLES;
          case JSONLD -> JSON_LD;
          case CSV -> CSV;
        };
    assertEquals(Optional.of(format), detect(content, null));
  }

  @Test
  void contentBeatsAMisleadingFileName() {
    assertEquals(Optional.of(NativeOntologyImportFormat.RDFXML), detect(RDF_XML, "ontology.ttl"));
    assertEquals(Optional.of(NativeOntologyImportFormat.RDFXML), detect("<rdf:RDF/>", null));
    assertEquals(Optional.of(NativeOntologyImportFormat.TURTLE), detect(TURTLE, "ontology.csv"));
    assertEquals(Optional.of(NativeOntologyImportFormat.CSV), detect(CSV, "ontology.json"));
  }

  @Test
  void onlyTheCompleteCanonicalCsvHeaderHasAContentSignature() {
    final String legacy = CSV.substring(0, CSV.indexOf(",abstract"));
    assertEquals(Optional.empty(), detect(legacy, null));
    assertEquals(Optional.empty(), detect(CSV.replace("kind,iri", "iri,kind"), null));
    assertEquals(Optional.of(NativeOntologyImportFormat.CSV), detect(legacy, "old.csv"));
    assertEquals(Optional.of(NativeOntologyImportFormat.CSV), detect(CSV, null));
  }

  @Test
  void skipsABomBlankLinesAndLeadingComments() {
    assertEquals(
        Optional.of(NativeOntologyImportFormat.TURTLE),
        detect("﻿\n# exported by a tool\n\n" + TURTLE, null));
    assertEquals(Optional.of(NativeOntologyImportFormat.CSV), detect("﻿" + CSV, "ontology.txt"));
  }

  @Test
  void aTurtleFileThatStartsWithAnIriTripleButUsesAPrefixedNameLaterIsNotNTriples() {
    final String mixed =
        "<https://example.org/A> a <http://www.w3.org/2002/07/owl#Class> .\n"
            + "@prefix ex: <https://example.org/> .\nex:B a ex:A .\n";
    assertEquals(Optional.of(NativeOntologyImportFormat.TURTLE), detect(mixed, null));
  }

  @Test
  void anIriSubjectIsNotTakenForAnXmlElement() {
    assertEquals(
        Optional.of(NativeOntologyImportFormat.NTRIPLES),
        detect("<urn:a> <urn:b> <urn:c> .\n", null));
    assertEquals(
        Optional.of(NativeOntologyImportFormat.NTRIPLES),
        detect("<urn:example/A> <urn:b> <urn:c> .\n", null));
    assertEquals(
        Optional.of(NativeOntologyImportFormat.TURTLE),
        detect("<urn:example/A> a <urn:Class> .\n", null));
  }

  @Test
  void fallsBackToTheFileExtensionWhenContentHasNoSignature() {
    assertEquals(Optional.of(NativeOntologyImportFormat.NTRIPLES), detect("", "dump.NT"));
    assertEquals(Optional.of(NativeOntologyImportFormat.RDFXML), detect("not rdf", "x.owl"));
    assertEquals(Optional.of(NativeOntologyImportFormat.JSONLD), detect("", "x.jsonld"));
  }

  @Test
  void unknownContentWithAnUnknownExtensionIsNotDetected() {
    assertEquals(Optional.empty(), detect("just some words", "notes.txt"));
    assertEquals(Optional.empty(), detect("just some words", null));
    assertEquals(Optional.empty(), detect(null, "file"));
  }

  @Test
  void readsOnlyTheWindowSoASignatureInsideItStillMatches() {
    final String longTurtle = TURTLE + "# " + "x".repeat(OntologyFormatDetector.WINDOW * 2);
    assertEquals(Optional.of(NativeOntologyImportFormat.TURTLE), detect(longTurtle, null));
    final String longNTriples = N_TRIPLES.repeat(OntologyFormatDetector.WINDOW / 40);
    assertEquals(Optional.of(NativeOntologyImportFormat.NTRIPLES), detect(longNTriples, null));
  }

  @Test
  void aBrowserSampleWithOneExtraCharacterMatchesTheFullNTriplesSource() {
    final String source = "<urn:a> <urn:b> <urn:c> .\n".repeat(4_000);
    final String sample = source.substring(0, OntologyFormatDetector.WINDOW + 1);
    assertEquals(Optional.of(NativeOntologyImportFormat.NTRIPLES), detect(source, "large.nt"));
    assertEquals(detect(source, "large.nt"), detect(sample, "large.nt"));
    assertEquals(
        Optional.of(NativeOntologyImportFormat.TURTLE),
        detect(source.substring(0, OntologyFormatDetector.WINDOW), "large.nt"));
  }

  @Test
  void aRequestedFormatIsUsedWithoutLookingAtTheContent() {
    final PreviewNativeOntologyImport request =
        new PreviewNativeOntologyImport()
            .withFormat(NativeOntologyImportFormat.CSV)
            .withData(TURTLE);
    assertEquals(
        Optional.of(NativeOntologyImportFormat.CSV), OntologyFormatDetector.resolve(request));
    assertEquals(
        Optional.of(NativeOntologyImportFormat.TURTLE),
        OntologyFormatDetector.resolve(request.withFormat(null)));
  }
}
