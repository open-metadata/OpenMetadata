package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReleaseExportAssetsIT extends OntologyReleaseExportSupport {
  @Test
  void boundAssetsAreLinkedOncePerBindingAndOnlyWhenRequested(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "assets");
    var customer = declareClass(ontology, "Customer", CUSTOMER);
    declareClass(ontology, "Party", PARTY);
    var schema = DatabaseSchemaTestFactory.createSimple(ns);
    var first = table(ns, schema.getFullyQualifiedName(), "boundOne");
    var second = table(ns, schema.getFullyQualifiedName(), "boundTwo");
    bind(client, customer, first.getId(), 0L);
    bind(client, customer, second.getId(), 1L);
    OntologyRelease release = capture(ontology);

    Model linked =
        parseTurtle(export(client, release.getId(), "turtle", "&includeBoundAssets=true"));
    Model plain = parseTurtle(export(client, release.getId(), "turtle"));

    var property = linked.createProperty("https://open-metadata.org/ontology/boundAsset");
    assertEquals(
        Set.of(
            "https://open-metadata.org/entity/table/" + first.getId(),
            "https://open-metadata.org/entity/table/" + second.getId()),
        linked
            .listObjectsOfProperty(linked.getResource(CUSTOMER.toString()), property)
            .toList()
            .stream()
            .map(Object::toString)
            .collect(Collectors.toSet()));
    assertEquals(2, linked.listStatements(null, property, (RDFNode) null).toList().size());
    assertFalse(plain.contains(null, plain.createProperty(property.getURI())));
  }

  @Test
  void aReaderWhoCannotViewATableGetsNoLinkToIt(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "assetsHidden");
    var customer = declareClass(ontology, "Customer", CUSTOMER);
    var schema = DatabaseSchemaTestFactory.createSimple(ns);
    try (RdfAccessFixtures fixtures = new RdfAccessFixtures("assetsHidden" + ns.shortPrefix())) {
      var reader = OntologyBindingFixtures.ownerReader(fixtures, Entity.TABLE);
      var visible =
          client
              .tables()
              .create(
                  new CreateTable()
                      .withName(ns.prefix("visibleToReader"))
                      .withDatabaseSchema(schema.getFullyQualifiedName())
                      .withOwners(List.of(OntologyBindingFixtures.readerReference(reader)))
                      .withColumns(
                          List.of(
                              new Column().withName("id").withDataType(ColumnDataType.STRING))));
      var hidden = table(ns, schema.getFullyQualifiedName(), "hiddenFromReader");
      bind(client, customer, visible.getId(), 0L);
      bind(client, customer, hidden.getId(), 1L);
      OntologyRelease release = capture(ontology);

      Model asReader =
          parseTurtle(export(reader, release.getId(), "turtle", "&includeBoundAssets=true"));
      Model asAdmin =
          parseTurtle(export(client, release.getId(), "turtle", "&includeBoundAssets=true"));

      var property = asReader.createProperty("https://open-metadata.org/ontology/boundAsset");
      assertEquals(
          List.of("https://open-metadata.org/entity/table/" + visible.getId()),
          asReader.listObjectsOfProperty(property).toList().stream()
              .map(Object::toString)
              .toList());
      assertEquals(2, asAdmin.listStatements(null, property, (RDFNode) null).toList().size());
    }
  }
}
