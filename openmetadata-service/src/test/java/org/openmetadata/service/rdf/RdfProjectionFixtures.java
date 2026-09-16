package org.openmetadata.service.rdf;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

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
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.resources.settings.SettingsCache;

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
      final RdfRepository repository =
          new RdfRepository(
              new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
              storage,
              null);
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
      try (MockedStatic<SettingsCache> ignored = mockRelationSettings()) {
        for (GlossaryTermRelationType type : relationSettings().getRelationTypes()) {
          repository.bulkAddGlossaryTermRelations(
              List.of(new RdfRepository.GlossaryTermRelationData(source, target, type.getName())));
        }
      }
      repository.addLineageWithDetails("table", source, "table", target, lineageDetails());
      projection.add(dataset.getNamedModel(BASE + "graph/knowledge"));
    } finally {
      dataset.close();
    }
  }

  static MockedStatic<SettingsCache> mockRelationSettings() {
    final MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class);
    settingsCache
        .when(
            () ->
                SettingsCache.getSetting(
                    SettingsType.GLOSSARY_TERM_RELATION_SETTINGS,
                    GlossaryTermRelationSettings.class))
        .thenReturn(relationSettings());
    return settingsCache;
  }

  private static GlossaryTermRelationSettings relationSettings() {
    return new GlossaryTermRelationSettings()
        .withRelationTypes(
            List.of(
                relation("relatedTo", "https://open-metadata.org/ontology/relatedTo"),
                relation("synonym", "http://www.w3.org/2004/02/skos/core#exactMatch"),
                relation("antonym", "https://open-metadata.org/ontology/antonym"),
                relation("broader", "http://www.w3.org/2004/02/skos/core#broader"),
                relation("narrower", "http://www.w3.org/2004/02/skos/core#narrower"),
                relation("partOf", "https://open-metadata.org/ontology/partOf"),
                relation("hasPart", "https://open-metadata.org/ontology/hasPart"),
                relation("calculatedFrom", "https://open-metadata.org/ontology/calculatedFrom"),
                relation("usedToCalculate", "https://open-metadata.org/ontology/usedToCalculate"),
                relation("seeAlso", "http://www.w3.org/2000/01/rdf-schema#seeAlso")));
  }

  private static GlossaryTermRelationType relation(String name, String predicate) {
    return new GlossaryTermRelationType().withName(name).withRdfPredicate(URI.create(predicate));
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
