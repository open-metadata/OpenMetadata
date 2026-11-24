package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.repositoryRoot;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.withDatabase;

import java.util.List;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

class GlossaryOntologyCleanupMigrationTest {
  private static final List<String> RETIRED_TERM_FIELDS =
      List.of(
          "attributes",
          "effectiveAttributes",
          "realizedIn",
          "conceptType",
          "ontologySource",
          "sourceMemoryIds");
  private static final String TERM =
      """
      {"name":"Employee","iri":"https://example.org/Employee",
       "conceptMappings":[{"conceptIri":"https://example.org/Person","mappingType":"CLOSE_MATCH"}],
       "attributes":[{"name":"salary"}],"effectiveAttributes":[],"realizedIn":[],
       "conceptType":"OWL_CLASS","ontologySource":{},"sourceMemoryIds":[]}
      """;
  private static final String GLOSSARY =
      """
      {"name":"People","namespaces":[{"prefix":"ex","namespace":"https://example.org/"}],
       "ontologyConfiguration":{"layer":"Domain"}}
      """;

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void cleanupPreservesReleasedGlossariesRelationsAndNativeDefinitions(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          createFixture(handle, dialect);
          List<String> statements = cleanupStatements(dialect);
          assertEquals(8, statements.size());
          statements.forEach(handle::execute);
          statements.forEach(handle::execute);

          assertTerm(handle, "glossary_term_entity", "glossaryTerm");
          assertTerm(handle, "entity_extension", "glossaryTerm");
          assertGlossary(handle, "glossary_entity", "glossary");
          assertGlossary(handle, "entity_extension", "glossary");
          assertEquals(
              JsonUtils.readTree(TERM),
              JsonUtils.readTree(readJson(handle, "entity_extension", "ontologyConcept")));
          assertEquals(
              List.of("glossary-draft", "native-draft"),
              handle
                  .createQuery("SELECT id FROM ontology_change_set_entity ORDER BY id")
                  .mapTo(String.class)
                  .list());
          assertEquals(
              List.of("glossary-draft", "native-draft"),
              handle
                  .createQuery(
                      "SELECT id FROM entity_extension WHERE jsonSchema = 'ontologyChangeSet' ORDER BY id")
                  .mapTo(String.class)
                  .list());
          assertEquals(
              List.of("native-memory", "term-relation"),
              handle
                  .createQuery("SELECT id FROM entity_relationship ORDER BY id")
                  .mapTo(String.class)
                  .list());
        });
  }

  private static List<String> cleanupStatements(ConnectionType dialect) {
    return MigrationFile.parseSQLFile(
            repositoryRoot()
                .resolve(
                    "bootstrap/sql/migrations/native/2.1.0/"
                        + (dialect == ConnectionType.MYSQL ? "mysql" : "postgres")
                        + "/schemaChanges.sql")
                .toFile(),
            dialect)
        .stream()
        .dropWhile(statement -> !statement.contains("UPDATE glossary_entity SET json = "))
        .limit(8)
        .toList();
  }

  private static void createFixture(Handle handle, ConnectionType dialect) {
    String jsonType = dialect == ConnectionType.MYSQL ? "JSON" : "JSONB";
    for (String table :
        List.of(
            "glossary_entity",
            "glossary_term_entity",
            "entity_extension",
            "ontology_change_set_entity")) {
      handle.execute(
          "CREATE TABLE "
              + table
              + " (id VARCHAR(36), jsonSchema VARCHAR(128), json "
              + jsonType
              + ")");
    }
    handle.execute(
        "CREATE TABLE entity_relationship (id VARCHAR(36), fromId VARCHAR(36), toId VARCHAR(36), fromEntity VARCHAR(128), toEntity VARCHAR(128), relation INTEGER)");
    insert(handle, dialect, "glossary_entity", "glossary", "glossary", GLOSSARY);
    insert(handle, dialect, "glossary_term_entity", "glossaryTerm", "glossaryTerm", TERM);
    insert(handle, dialect, "entity_extension", "glossary", "glossary", GLOSSARY);
    insert(handle, dialect, "entity_extension", "glossaryTerm", "glossaryTerm", TERM);
    insert(handle, dialect, "entity_extension", "ontologyConcept", "ontologyConcept", TERM);
    String retiredDraft = "{\"operations\":[{\"operationType\":\"UPSERT_ATTRIBUTE\"}]}";
    String termDraft =
        "{\"operations\":[{\"operationType\":\"CREATE_TERM\",\"term\":" + TERM + "}]}";
    String nativeDraft =
        "{\"ontology\":{\"id\":\"native\"},\"operations\":[{\"operationType\":\"UPSERT_CONCEPT\"}]}";
    String glossaryDraft =
        "{\"operations\":[{\"operationType\":\"CREATE_TERM\",\"term\":{\"name\":\"Employee\"}}]}";
    insert(
        handle,
        dialect,
        "ontology_change_set_entity",
        "retired-draft",
        "ontologyChangeSet",
        retiredDraft);
    insert(
        handle,
        dialect,
        "ontology_change_set_entity",
        "retired-term-draft",
        "ontologyChangeSet",
        termDraft);
    insert(handle, dialect, "entity_extension", "retired-draft", "ontologyChangeSet", retiredDraft);
    insert(
        handle, dialect, "entity_extension", "retired-term-draft", "ontologyChangeSet", termDraft);
    insert(
        handle,
        dialect,
        "ontology_change_set_entity",
        "native-draft",
        "ontologyChangeSet",
        nativeDraft);
    insert(
        handle,
        dialect,
        "ontology_change_set_entity",
        "glossary-draft",
        "ontologyChangeSet",
        glossaryDraft);
    insert(handle, dialect, "entity_extension", "native-draft", "ontologyChangeSet", nativeDraft);
    insert(
        handle, dialect, "entity_extension", "glossary-draft", "ontologyChangeSet", glossaryDraft);
    relation(handle, "retired-draft", "ontologyChangeSet", "user", Relationship.HAS);
    relation(handle, "retired-term-draft", "user", "ontologyChangeSet", Relationship.HAS);
    relation(handle, "term-relation", "glossaryTerm", "glossaryTerm", Relationship.RELATED_TO);
    relation(handle, "term-realization", "glossaryTerm", "table", Relationship.MAPPED_TO);
    relation(handle, "term-memory", "glossaryTerm", "contextMemory", Relationship.DERIVED_FROM);
    relation(
        handle, "native-memory", "ontologyConcept", "contextMemory", Relationship.DERIVED_FROM);
  }

  private static void insert(
      Handle handle, ConnectionType dialect, String table, String id, String schema, String json) {
    handle
        .createUpdate(
            "INSERT INTO "
                + table
                + " (id, jsonSchema, json) VALUES (:id, :schema, "
                + (dialect == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)")
                + ")")
        .bind("id", id)
        .bind("schema", schema)
        .bind("json", json)
        .execute();
  }

  private static void relation(
      Handle handle, String id, String source, String target, Relationship relation) {
    handle
        .createUpdate(
            "INSERT INTO entity_relationship (id, fromId, toId, fromEntity, toEntity, relation) VALUES (:id, :id, :id, :source, :target, :relation)")
        .bind("id", id)
        .bind("source", source)
        .bind("target", target)
        .bind("relation", relation.ordinal())
        .execute();
  }

  private static String readJson(Handle handle, String table, String id) {
    return handle
        .createQuery("SELECT json FROM " + table + " WHERE id = :id")
        .bind("id", id)
        .mapTo(String.class)
        .one();
  }

  private static void assertTerm(Handle handle, String table, String id) {
    var term = JsonUtils.readTree(readJson(handle, table, id));
    RETIRED_TERM_FIELDS.forEach(field -> assertFalse(term.has(field), field));
    assertEquals("Employee", term.path("name").asText());
    assertEquals("https://example.org/Employee", term.path("iri").asText());
    assertEquals(JsonUtils.readTree(TERM).path("conceptMappings"), term.path("conceptMappings"));
  }

  private static void assertGlossary(Handle handle, String table, String id) {
    var glossary = JsonUtils.readTree(readJson(handle, table, id));
    assertFalse(glossary.has("ontologyConfiguration"));
    assertEquals("People", glossary.path("name").asText());
    assertTrue(glossary.path("namespaces").isArray());
    assertEquals(JsonUtils.readTree(GLOSSARY).path("namespaces"), glossary.path("namespaces"));
  }
}
