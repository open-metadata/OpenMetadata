package org.openmetadata.it.tests;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

abstract class OntologyReleaseExportSupport extends BaseOntologyApprovalIT {
  static final URI CUSTOMER = URI.create("https://example.org/model/Customer");
  static final URI PARTY = URI.create("https://example.org/model/Party");
  static final URI KNOWS = URI.create("https://example.org/model/knows");
  static final URI KNOWN_BY = URI.create("https://example.org/model/knownBy");
  static final URI SUPPLIER = URI.create("https://example.org/model/Supplier");
  static final String SKOSXL = "http://www.w3.org/2008/05/skos-xl#";

  static CreateOntologyProperty inverseProperty(Ontology ontology) {
    return new CreateOntologyProperty()
        .withName("knownBy")
        .withIri(KNOWN_BY)
        .withKind(OntologyPropertyKind.OBJECT)
        .withDomain(List.of(PARTY))
        .withRange(List.of(CUSTOMER))
        .withOntology(ontology.getFullyQualifiedName());
  }

  static Table table(TestNamespace ns, String schemaFqn, String name) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix(name))
                .withDatabaseSchema(schemaFqn)
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.STRING))));
  }

  static void bind(
      OpenMetadataClient client, OntologyConcept concept, UUID tableId, long revision) {
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/ontologyConcepts/" + concept.getId() + "/bindings",
            new UpdateOntologyConceptBinding()
                .withExpectedRevision(revision)
                .withAsset(
                    new OntologyAssetBinding()
                        .withAssetType(OntologyBindingAssetType.TABLE)
                        .withAssetId(tableId)),
            OntologyConceptBindingsResponse.class);
  }

  static Model parseTurtle(String text) {
    Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(text, Lang.TURTLE).parse(model);
    return model;
  }

  static CreateOntologyProperty property(Ontology ontology) {
    return new CreateOntologyProperty()
        .withName("knows")
        .withIri(KNOWS)
        .withKind(OntologyPropertyKind.OBJECT)
        .withDomain(List.of(CUSTOMER))
        .withRange(List.of(PARTY))
        .withOntology(ontology.getFullyQualifiedName());
  }

  static CreateOntologyAxiom axiom(Ontology ontology) {
    return new CreateOntologyAxiom()
        .withName("customer-is-party")
        .withDisplayName("Customer is a party")
        .withDescription("Every customer is a party")
        .withOntology(ontology.getFullyQualifiedName())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(CUSTOMER)
        .withProvenance(RelationProvenance.MANUAL)
        .withExpressions(
            List.of(
                new OntologyExpression()
                    .withKind(OntologyExpressionKind.NAMED_CLASS)
                    .withClassIri(PARTY)));
  }

  static String export(OpenMetadataClient client, UUID releaseId, String format) {
    return export(client, releaseId, format, "");
  }

  static String export(OpenMetadataClient client, UUID releaseId, String format, String options) {
    return client
        .getHttpClient()
        .executeForString(
            HttpMethod.GET,
            "/v1/ontologyReleases/" + releaseId + "/export?format=" + format + options,
            null,
            RequestOptions.builder().header("Accept", "*/*").build());
  }
}
