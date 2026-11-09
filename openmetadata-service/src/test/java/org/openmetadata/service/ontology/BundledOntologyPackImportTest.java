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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
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
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;
import org.openmetadata.service.rdf.RdfSerializationFormat;

/**
 * Every bundled pack is read by the real native importer. {@code members} is what the importer
 * keeps (concepts, properties and axioms). {@code skipped} is what reading the pack reports leaving
 * out. {@code previewSkipped} adds what the preview then drops because a subproperty link names a
 * property the pack never declares, so a change to either the pack bytes or the importer shows up
 * here.
 */
class BundledOntologyPackImportTest {
  private final OntologyPackCatalog catalog = OntologyPackCatalog.bundled();
  private final OntologyPackContentLoader loader =
      new OntologyPackContentLoader(getClass().getClassLoader());

  static Stream<Arguments> packs() {
    return Stream.of(
        Arguments.of("brick", 11825, 11216, 11228),
        Arguments.of("dcat", 62, 1307, 1322),
        Arguments.of("dpv", 3692, 8425, 8425),
        Arguments.of("epcis", 231, 1003, 1003),
        Arguments.of("fhir", 16567, 19235, 19509),
        Arguments.of("fibo", 9940, 102527, 102529),
        Arguments.of("foaf", 105, 158, 159),
        Arguments.of("gs1", 1523, 14098, 14128),
        Arguments.of("hr-open", 14, 0, 0),
        Arguments.of("iof", 2642, 8283, 8286),
        Arguments.of("isa-95", 16, 0, 0),
        Arguments.of("odrl", 758, 544, 544),
        Arguments.of("org", 65, 408, 410),
        Arguments.of("owl-time", 211, 532, 532),
        Arguments.of("prov-o", 130, 548, 548),
        Arguments.of("sosa-ssn", 144, 199, 199));
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
      final String packId, final int members, final int skipped, final int previewSkipped) {
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
  void everyPackFitsOneOntologyAndPreviewsWithoutErrors(
      final String packId, final int members, final int skipped, final int previewSkipped) {
    assertTrue(members <= OntologyReleaseManifest.MAX_MEMBERS, packId + " members");
    final var selected =
        loader.select(
            catalog,
            packId,
            catalog.require(packId).getModules().stream().map(module -> module.getId()).toList());
    final var model = new OntologyPackModels(loader).load(selected.modules());
    final NativeOntologyRdfImporter.Source source;
    try {
      source =
          new NativeOntologyRdfImporter.Source(
              NativeOntologyImportFormat.fromValue(selected.format()),
              NativeOntologyRdfImporter.read(model));
    } finally {
      model.close();
    }

    final var preview = new NativeOntologyRdfImporter().previewUnbounded(source, emptyTarget());

    final var summary = preview.getSummary();
    assertEquals(
        previewSkipped, summary.getSkippedStatements().getTotal(), packId + " preview skipped");
    assertFalse(summary.getItems().isEmpty(), packId + " items");
    assertFalse(preview.getChangeSet().getOperations().isEmpty(), packId + " operations");
  }

  private static OntologyWorkingSnapshot.Snapshot emptyTarget() {
    final Ontology root =
        new Ontology()
            .withId(UUID.randomUUID())
            .withName("library")
            .withFullyQualifiedName("library");
    return new OntologyWorkingSnapshot.Snapshot(
        new OntologyState().withOntologyId(root.getId()).withWorkingRevision(0L),
        List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
  }

  private Model wholePack(final String packId) {
    final Model model = ModelFactory.createDefaultModel();
    for (final var module : catalog.require(packId).getModules()) {
      final RdfSerializationFormat format =
          RdfSerializationFormat.parse(module.getFormat().value());
      RDFParser.fromString(
              loader.load(module.getResourcePath()).body(), format.rdfFormat().getLang())
          .parse(model);
    }
    return model;
  }
}
