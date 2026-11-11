package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;

/**
 * A plan must apply as previewed, so a restriction whose data range a save would refuse is skipped
 * and counted at preview time. These are the shapes FHIR R5 (date and gYear unions) and FIBO
 * (a custom {@code rdfs:Datatype}) put in front of the importer.
 */
class NativeOntologyImportProfileCascadeTest {
  private static final String PREFIXES =
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix ex: <https://example.org/> .
      ex:R a owl:Class . ex:label a owl:DatatypeProperty . ex:Text a rdfs:Datatype .
      """;

  @ParameterizedTest
  @ValueSource(
      strings = {
        "ex:R rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:label ;"
            + " owl:allValuesFrom [ a rdfs:Datatype ; owl:unionOf ( xsd:date xsd:gYear ) ] ] .",
        "ex:R rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:label ;"
            + " owl:allValuesFrom ex:Text ] .",
        "ex:R rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:label ;"
            + " owl:someValuesFrom ex:Text ] .",
        "ex:R rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:label ;"
            + " owl:qualifiedCardinality 1 ; owl:onDataRange xsd:date ] .",
        "ex:R owl:equivalentClass [ a owl:Restriction ; owl:onProperty ex:label ;"
            + " owl:someValuesFrom [ a rdfs:Datatype ; owl:unionOf ( xsd:string ex:Text ) ] ] ."
      })
  void aRestrictionOverADataRangeASaveWouldRefuseIsSkippedAtPreview(final String axiom) {
    final NativeOntologyImportPreview preview = preview(PREFIXES + axiom);

    final var types =
        preview.getChangeSet().getOperations().stream()
            .map(operation -> operation.getOperationType())
            .toList();
    assertTrue(!types.contains(OntologyChangeOperationType.UPSERT_AXIOM), types.toString());
    assertEquals(1, preview.getSummary().getCounts().getSkippedRelations());
  }

  @Test
  void aPropertyListsItsDomainsInIriOrderWhateverOrderTheSourceStatesThem() {
    final String domains =
        "ex:zeta, ex:mu, ex:alpha, ex:omega, ex:beta, ex:kappa, ex:delta, ex:sigma, ex:eta";
    final NativeOntologyImportPreview preview =
        preview(
            PREFIXES
                + "ex:zeta a owl:Class . ex:mu a owl:Class . ex:alpha a owl:Class ."
                + " ex:omega a owl:Class . ex:beta a owl:Class . ex:kappa a owl:Class ."
                + " ex:delta a owl:Class . ex:sigma a owl:Class . ex:eta a owl:Class ."
                + " ex:prop a owl:ObjectProperty ; rdfs:domain "
                + domains
                + " .");

    final var property =
        preview.getChangeSet().getOperations().stream()
            .map(operation -> operation.getProperty())
            .filter(java.util.Objects::nonNull)
            .filter(candidate -> candidate.getIri().toString().endsWith("/prop"))
            .findFirst()
            .orElseThrow();
    final List<String> listed = property.getDomain().stream().map(URI::toString).toList();
    assertEquals(listed.stream().sorted().toList(), listed);
  }

  private static NativeOntologyImportPreview preview(final String turtle) {
    final Ontology root =
        new Ontology()
            .withId(UUID.randomUUID())
            .withName("Imported")
            .withFullyQualifiedName("Imported")
            .withIri(URI.create("https://example.org/ontology"));
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            new OntologyState().withOntologyId(root.getId()).withWorkingRevision(3L),
            List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
    final var importer = new NativeOntologyRdfImporter();
    return importer.preview(
        importer.read(
            new PreviewNativeOntologyImport()
                .withFormat(NativeOntologyImportFormat.TURTLE)
                .withData(turtle)),
        snapshot);
  }
}
