package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Statement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.service.ontology.NativeOntologyDocument;

/**
 * Real published ontologies, copied verbatim into {@code ontology/upstream}, must read instead of
 * failing on the first statement outside the native profile. The counts are what the importer
 * keeps; the skipped total is what it reports leaving out.
 */
class UpstreamOntologyImportTest {
  private final NativeOntologyRdfImporter importer = new NativeOntologyRdfImporter();

  /**
   * {@code superProperties} counts the {@code rdfs:subPropertyOf} links the reader keeps; {@code
   * unresolved} is how many of them name a property outside the file, which a preview against an
   * empty target drops and adds to the skipped total.
   */
  @ParameterizedTest
  @CsvSource({
    "dcat3.ttl,TURTLE,9,39,14,1307,18,15",
    "prov-o.ttl,TURTLE,30,65,35,548,41,0",
    "org.ttl,TURTLE,9,35,21,408,9,2",
    "time.ttl,TURTLE,20,58,133,532,13,0",
    "sosa.ttl,TURTLE,16,34,1,149,0,0",
    "ssn.ttl,TURTLE,11,24,72,91,0,0",
    "odrl.ttl,TURTLE,214,66,478,544,22,0",
    "skos.rdf,RDFXML,0,0,4,209,0,0",
    "foaf.rdf,RDFXML,14,68,23,158,13,1"
  })
  void anUpstreamOntologyReadsAndReportsWhatItLeavesOut(
      String file,
      NativeOntologyImportFormat format,
      int concepts,
      int properties,
      int axioms,
      int skipped,
      int superProperties,
      int unresolved)
      throws IOException {
    final var source =
        importer.read(new PreviewNativeOntologyImport().withFormat(format).withData(load(file)));

    final NativeOntologyDocument document = source.document();
    assertEquals(concepts, document.concepts().size(), file + " concepts");
    assertEquals(properties, document.properties().size(), file + " properties");
    assertEquals(axioms, document.axioms().size(), file + " axioms");
    assertEquals(skipped, document.skipped().getTotal(), file + " skipped");
    assertEquals(
        superProperties,
        document.properties().stream().mapToInt(p -> p.getSuperProperties().size()).sum(),
        file + " superProperties");

    assertEquals(
        skipped + unresolved,
        importer.summarize(source).getSkippedStatements().getTotal(),
        file + " summarized");
  }

  @Test
  void readingTheSameFileTwiceReportsTheSameThing() throws IOException {
    final var request =
        new PreviewNativeOntologyImport()
            .withFormat(NativeOntologyImportFormat.TURTLE)
            .withData(load("dcat3.ttl"));

    assertEquals(importer.read(request).document(), importer.read(request).document());
  }

  @ParameterizedTest
  @ValueSource(strings = {"dcat3.ttl", "org.ttl", "odrl.ttl"})
  void statementOrderDoesNotChangeTheDocumentOrTheSkipReport(String file) throws IOException {
    final var request =
        new PreviewNativeOntologyImport()
            .withFormat(NativeOntologyImportFormat.TURTLE)
            .withData(load(file));
    final NativeOntologyDocument expected = importer.read(request).document();
    final List<Statement> statements =
        importer.parse(request.getData(), RdfSerializationFormat.TURTLE).listStatements().toList();

    for (int seed = 0; seed < 5; seed++) {
      final List<Statement> shuffled = new ArrayList<>(statements);
      Collections.shuffle(shuffled, new Random(seed));
      final Model reordered = ModelFactory.createDefaultModel().add(shuffled);
      final NativeOntologyDocument actual = NativeOntologyRdfImporter.read(reordered);
      assertEquals(expected, actual, file + " seed " + seed);
      assertEquals(expected.skipped(), actual.skipped(), file + " seed " + seed);
    }
  }

  private static String load(final String file) throws IOException {
    try (InputStream stream =
        UpstreamOntologyImportTest.class.getResourceAsStream("/ontology/upstream/" + file)) {
      return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
}
