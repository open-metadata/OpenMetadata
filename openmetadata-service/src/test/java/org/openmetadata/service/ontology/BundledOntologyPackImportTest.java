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
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.RDFParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.api.data.OntologyPackManifest.InstallMode;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;
import org.openmetadata.service.rdf.RdfSerializationFormat;

/**
 * Every bundled pack is read by the real native importer. {@code members} is what the importer
 * keeps (concepts, properties and axioms) and {@code skipped} is what it reports leaving out, so a
 * change to either the pack bytes or the importer shows up here. Packs over the import's 1,000
 * changed definitions are the ones the manifest sends to the background install job.
 */
class BundledOntologyPackImportTest {
  private static final int MAX_CHANGED_DEFINITIONS = 1000;
  private static final int WORKING_SNAPSHOT_CAP = 10_000;

  private final OntologyPackCatalog catalog = OntologyPackCatalog.bundled();
  private final OntologyPackContentLoader loader =
      new OntologyPackContentLoader(getClass().getClassLoader());

  static Stream<Arguments> packs() {
    return Stream.of(
        Arguments.of("brick", 11825, 11259),
        Arguments.of("dcat", 62, 1325),
        Arguments.of("dpv", 3692, 8494),
        Arguments.of("epcis", 18, 0),
        Arguments.of("fhir", 16567, 19509),
        Arguments.of("fibo", 9940, 103304),
        Arguments.of("foaf", 105, 171),
        Arguments.of("gs1", 1540, 14173),
        Arguments.of("hr-open", 14, 0),
        Arguments.of("isa-95", 16, 0),
        Arguments.of("odrl", 758, 566),
        Arguments.of("org", 65, 417),
        Arguments.of("owl-time", 211, 545),
        Arguments.of("prov-o", 130, 589),
        Arguments.of("sosa-ssn", 144, 200));
  }

  @Test
  void theTableCoversEveryBundledPack() {
    assertEquals(
        catalog.list().stream().map(OntologyPackManifest::getId).collect(Collectors.toSet()),
        packs().map(arguments -> (String) arguments.get()[0]).collect(Collectors.toSet()));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("packs")
  void aBundledPackReadsToTheRecordedMembersAndSkippedReport(
      final String packId, final int members, final int skipped) {
    final var document = NativeOntologyRdfImporter.read(wholePack(packId));

    assertEquals(
        members,
        document.concepts().size() + document.properties().size() + document.axioms().size(),
        packId + " members");
    assertEquals(skipped, document.skipped().getTotal(), packId + " skipped");
  }

  @ParameterizedTest(name = "{0}")
  @ValueSource(strings = {"gs1", "fhir", "dpv"})
  void theSkippedReportDoesNotDependOnParseOrder(final String packId) {
    final int first = NativeOntologyRdfImporter.read(wholePack(packId)).skipped().getTotal();

    for (int run = 0; run < 3; run++) {
      assertEquals(
          first, NativeOntologyRdfImporter.read(wholePack(packId)).skipped().getTotal(), packId);
    }
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("packs")
  void packsTooBigForOneImportAreExactlyTheBackgroundOnes(
      final String packId, final int members, final int skipped) {
    assertEquals(
        members > MAX_CHANGED_DEFINITIONS,
        catalog.require(packId).getInstallMode() == InstallMode.BACKGROUND,
        packId + " installMode");
  }

  @Test
  void onlyBrickAndFhirExceedTheWorkingSnapshotCap() {
    final Set<String> over =
        packs()
            .map(Arguments::get)
            .filter(arguments -> (int) arguments[1] >= WORKING_SNAPSHOT_CAP)
            .map(arguments -> (String) arguments[0])
            .collect(Collectors.toSet());

    assertEquals(Set.of("brick", "fhir"), over);
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("packs")
  void aPackWithinOneImportPreviewsWithoutErrors(
      final String packId, final int members, final int skipped) {
    if (catalog.require(packId).getInstallMode() == InstallMode.BACKGROUND) {
      return;
    }
    final var selected =
        loader.loadSelected(
            catalog,
            packId,
            catalog.require(packId).getModules().stream().map(module -> module.getId()).toList());
    final var importer = new NativeOntologyRdfImporter();

    final var source =
        importer.read(
            new PreviewNativeOntologyImport()
                .withFormat(NativeOntologyImportFormat.fromValue(selected.format()))
                .withData(selected.body()));
    final var summary = importer.summarize(source);

    assertEquals(skipped, summary.getSkippedStatements().getTotal(), packId + " skipped");
    assertFalse(summary.getItems().isEmpty(), packId + " items");
  }

  private Model wholePack(final String packId) {
    final OntologyPackManifest pack = catalog.require(packId);
    final String body =
        pack.getModules().stream()
            .map(module -> loader.load(module.getResourcePath()).body())
            .collect(Collectors.joining(System.lineSeparator()));
    final RdfSerializationFormat format =
        RdfSerializationFormat.parse(pack.getModules().getFirst().getFormat().value());
    final Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(body, format.rdfFormat().getLang()).parse(model);
    return model;
  }
}
