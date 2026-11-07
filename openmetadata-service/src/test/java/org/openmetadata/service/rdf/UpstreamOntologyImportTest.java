package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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

  @ParameterizedTest
  @CsvSource({
    "dcat3.ttl,TURTLE,9,39,14,1325",
    "prov-o.ttl,TURTLE,30,65,35,589",
    "org.ttl,TURTLE,9,35,21,417",
    "time.ttl,TURTLE,20,58,133,545",
    "sosa.ttl,TURTLE,16,34,1,149",
    "ssn.ttl,TURTLE,11,24,72,91",
    "odrl.ttl,TURTLE,214,66,478,566",
    "skos.rdf,RDFXML,0,0,4,209",
    "foaf.rdf,RDFXML,14,68,23,171"
  })
  void anUpstreamOntologyReadsAndReportsWhatItLeavesOut(
      String file,
      NativeOntologyImportFormat format,
      int concepts,
      int properties,
      int axioms,
      int skipped)
      throws IOException {
    final var source =
        importer.read(new PreviewNativeOntologyImport().withFormat(format).withData(load(file)));

    final NativeOntologyDocument document = source.document();
    assertEquals(concepts, document.concepts().size(), file + " concepts");
    assertEquals(properties, document.properties().size(), file + " properties");
    assertEquals(axioms, document.axioms().size(), file + " axioms");
    assertEquals(skipped, document.skipped().getTotal(), file + " skipped");

    assertEquals(skipped, importer.summarize(source).getSkippedStatements().getTotal());
  }

  @Test
  void readingTheSameFileTwiceReportsTheSameThing() throws IOException {
    final var request =
        new PreviewNativeOntologyImport()
            .withFormat(NativeOntologyImportFormat.TURTLE)
            .withData(load("dcat3.ttl"));

    assertEquals(importer.read(request).document(), importer.read(request).document());
  }

  private static String load(final String file) throws IOException {
    try (InputStream stream =
        UpstreamOntologyImportTest.class.getResourceAsStream("/ontology/upstream/" + file)) {
      return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
}
