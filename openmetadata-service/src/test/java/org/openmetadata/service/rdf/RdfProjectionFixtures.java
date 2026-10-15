package org.openmetadata.service.rdf;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.update.UpdateAction;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

final class RdfProjectionFixtures {
  private static final String BASE = "https://open-metadata.org/";
  private static final ObjectMapper JSON = new ObjectMapper();

  private RdfProjectionFixtures() {}

  static Model project() throws IOException {
    final Model projection = ModelFactory.createDefaultModel();
    final JsonLdTranslator translator = RdfSchemaFixture.translator();
    for (String schema : RdfSchemaFixture.entitySchemas()) {
      final Model entity = translator.toRdf(RdfSchemaFixture.entity(schema));
      projection.add(entity);
      entity.close();
    }
    for (JsonNode fixture : read("/rdf/projection-entities.json")) {
      final Model entity =
          translator.toRdf(
              new RdfSchemaFixture.FixtureEntity(
                  fixture.get("type").asText(), (ObjectNode) fixture.get("fields")));
      projection.add(entity);
      entity.close();
    }
    projectRelationships(projection);
    return projection;
  }

  private static void projectRelationships(final Model projection) throws IOException {
    final Dataset dataset = DatasetFactory.create();
    try {
      final RdfStorageInterface storage = mock(RdfStorageInterface.class);
      doAnswer(
              call -> {
                UpdateAction.parseExecute(call.getArgument(0, String.class), dataset);
                return null;
              })
          .when(storage)
          .executeSparqlUpdate(anyString());
      final CollectionDAO.RelationshipTypeDAO types = mock(CollectionDAO.RelationshipTypeDAO.class);
      final RdfRepository repository =
          new RdfRepository(
              new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
              storage,
              null,
              () -> new RelationshipTypeResolver(types));
      final UUID source = UUID.randomUUID();
      final UUID target = UUID.randomUUID();
      for (Relationship relationship : Relationship.values()) {
        repository.addRelationship(
            new EntityRelationship()
                .withFromId(source)
                .withFromEntity("table")
                .withToId(target)
                .withToEntity("table")
                .withRelationshipType(relationship));
      }
      for (JsonNode definition : read("/json/data/ontology/relationshipTypes.json")) {
        final RelationshipType type = JSON.treeToValue(definition, RelationshipType.class);
        when(types.findEntityByName(type.getName(), Include.NON_DELETED)).thenReturn(type);
        repository.bulkAddGlossaryTermRelations(
            List.of(new RdfRepository.GlossaryTermRelationData(source, target, type.getName())));
      }
      repository.addLineageWithDetails("table", source, "table", target, lineageDetails());
      projection.add(dataset.getNamedModel(BASE + "graph/knowledge"));
    } finally {
      dataset.close();
    }
  }

  private static LineageDetails lineageDetails() {
    return new LineageDetails()
        .withSqlQuery("SELECT id FROM source")
        .withSource(LineageDetails.Source.MANUAL)
        .withDescription("Projection contract fixture")
        .withCreatedAt(1000L)
        .withUpdatedAt(2000L)
        .withCreatedBy("admin")
        .withUpdatedBy("admin")
        .withPipeline(new EntityReference().withId(UUID.randomUUID()).withType("pipeline"))
        .withColumnsLineage(
            List.of(
                new ColumnLineage()
                    .withFromColumns(List.of("service.db.schema.source.id"))
                    .withToColumn("service.db.schema.target.id")
                    .withFunction("identity")));
  }

  private static JsonNode read(final String path) throws IOException {
    try (InputStream input = RdfProjectionFixtures.class.getResourceAsStream(path)) {
      if (input == null) throw new IllegalStateException("Missing projection fixture: " + path);
      return JSON.readTree(input);
    }
  }
}
