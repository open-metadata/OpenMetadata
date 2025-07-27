package org.openmetadata.service.rdf;

import static org.openmetadata.service.util.RdfTestUtils.*;
import static org.openmetadata.service.util.TestUtils.*;

import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;

/**
 * Comprehensive tests for RDF relationship storage and retrieval
 */
@Slf4j
public class RdfRelationshipTest extends OpenMetadataApplicationTest {

  private static DatabaseResourceTest databaseResourceTest;
  private static DatabaseSchemaResourceTest schemaResourceTest;
  private static TableResourceTest tableResourceTest;
  private static TeamResourceTest teamResourceTest;
  private static UserResourceTest userResourceTest;

  @BeforeAll
  public static void setup() throws IOException {
    databaseResourceTest = new DatabaseResourceTest();
    schemaResourceTest = new DatabaseSchemaResourceTest();
    tableResourceTest = new TableResourceTest();
    teamResourceTest = new TeamResourceTest();
    userResourceTest = new UserResourceTest();

    databaseResourceTest.setup(null);
    schemaResourceTest.setup(null);
    tableResourceTest.setup(null);
    teamResourceTest.setup(null);
    userResourceTest.setup(null);
  }

  @Test
  void testHierarchicalContainsRelationships(TestInfo test) throws IOException {
    if (!isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create database
    CreateDatabase createDatabase =
        databaseResourceTest
            .createRequest(test)
            .withService(REDSHIFT_REFERENCE.getFullyQualifiedName());
    Database database = databaseResourceTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Create schema in database
    CreateDatabaseSchema createSchema =
        schemaResourceTest.createRequest(test).withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = schemaResourceTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Create table in schema
    CreateTable createTable =
        tableResourceTest.createRequest(test).withDatabaseSchema(schema.getFullyQualifiedName());
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Verify hierarchical relationships
    LOG.info("Verifying databaseService CONTAINS database");
    verifyContainsRelationshipInRdf(REDSHIFT_REFERENCE, database.getEntityReference());

    LOG.info("Verifying database CONTAINS databaseSchema");
    verifyContainsRelationshipInRdf(database.getEntityReference(), schema.getEntityReference());

    LOG.info("Verifying databaseSchema CONTAINS table");
    verifyContainsRelationshipInRdf(schema.getEntityReference(), table.getEntityReference());
  }

  @Test
  void testOwnershipRelationships(TestInfo test) throws IOException {
    if (!isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create user
    CreateUser createUser = userResourceTest.createRequest(test);
    User user = userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Create team
    CreateTeam createTeam = teamResourceTest.createRequest(test);
    Team team = teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);

    // Create table owned by user
    CreateTable createTable1 =
        tableResourceTest
            .createRequest(test, 1)
            .withDatabaseSchema(TEST_SCHEMA_REFERENCE.getFullyQualifiedName())
            .withOwners(listOf(user.getEntityReference()));
    Table table1 = tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    // Create table owned by team
    CreateTable createTable2 =
        tableResourceTest
            .createRequest(test, 2)
            .withDatabaseSchema(TEST_SCHEMA_REFERENCE.getFullyQualifiedName())
            .withOwners(listOf(team.getEntityReference()));
    Table table2 = tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    // Verify ownership relationships are stored as hasOwner in the entity
    LOG.info("Verifying table1 hasOwner user");
    verifyOwnerInRdf(table1.getFullyQualifiedName(), user.getEntityReference());

    LOG.info("Verifying table2 hasOwner team");
    verifyOwnerInRdf(table2.getFullyQualifiedName(), team.getEntityReference());
  }

  @Test
  void testLineageRelationships(TestInfo test) throws IOException {
    if (!isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create source table
    CreateTable createSource =
        tableResourceTest
            .createRequest(test, 1)
            .withDatabaseSchema(TEST_SCHEMA_REFERENCE.getFullyQualifiedName());
    Table sourceTable = tableResourceTest.createEntity(createSource, ADMIN_AUTH_HEADERS);

    // Create target table
    CreateTable createTarget =
        tableResourceTest
            .createRequest(test, 2)
            .withDatabaseSchema(TEST_SCHEMA_REFERENCE.getFullyQualifiedName());
    Table targetTable = tableResourceTest.createEntity(createTarget, ADMIN_AUTH_HEADERS);

    // Add lineage relationship (this would typically be done through the lineage API)
    Entity.getCollectionDAO()
        .relationshipDAO()
        .insert(
            sourceTable.getId(),
            targetTable.getId(),
            sourceTable.getEntityReference().getType(),
            targetTable.getEntityReference().getType(),
            Relationship.UPSTREAM.ordinal());

    // Force RDF update for the relationship
    RdfUpdater.addRelationship(
        new org.openmetadata.schema.type.EntityRelationship()
            .withFromId(targetTable.getId())
            .withToId(sourceTable.getId())
            .withFromEntity(targetTable.getEntityReference().getType())
            .withToEntity(sourceTable.getEntityReference().getType())
            .withRelationshipType(Relationship.UPSTREAM));

    // Verify lineage relationship
    LOG.info("Verifying targetTable UPSTREAM sourceTable");
    verifyUpstreamRelationshipInRdf(
        targetTable.getEntityReference(), sourceTable.getEntityReference());
  }

  @Test
  void testTagRelationships(TestInfo test) throws IOException {
    if (!isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create table with tags
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDatabaseSchema(TEST_SCHEMA_REFERENCE.getFullyQualifiedName())
            .withTags(listOf(PII_SENSITIVE_TAG_LABEL));
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Verify tag relationships
    LOG.info("Verifying table has PII tag");
    verifyTagsInRdf(table.getFullyQualifiedName(), table.getTags());
  }

  @Test
  void testTeamHierarchyRelationships(TestInfo test) throws IOException {
    if (!isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create parent team
    CreateTeam createParent = teamResourceTest.createRequest(test, 1);
    Team parentTeam = teamResourceTest.createEntity(createParent, ADMIN_AUTH_HEADERS);

    // Create child team
    CreateTeam createChild =
        teamResourceTest.createRequest(test, 2).withParents(listOf(parentTeam.getId()));
    Team childTeam = teamResourceTest.createEntity(createChild, ADMIN_AUTH_HEADERS);

    // Create user in child team
    CreateUser createUser =
        userResourceTest.createRequest(test).withTeams(listOf(childTeam.getId()));
    User user = userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Verify team hierarchy
    LOG.info("Verifying parentTeam PARENT_OF childTeam");
    verifyRelationshipInRdf(
        parentTeam.getEntityReference(), childTeam.getEntityReference(), Relationship.PARENT_OF);

    // Verify user team membership
    LOG.info("Verifying childTeam CONTAINS user");
    verifyContainsRelationshipInRdf(childTeam.getEntityReference(), user.getEntityReference());
  }

  @Test
  void testMultipleRelationshipTypes(TestInfo test) throws IOException {
    if (!isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create entities
    CreateTable createTable1 =
        tableResourceTest
            .createRequest(test, 1)
            .withDatabaseSchema(TEST_SCHEMA_REFERENCE.getFullyQualifiedName());
    Table table1 = tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        tableResourceTest
            .createRequest(test, 2)
            .withDatabaseSchema(TEST_SCHEMA_REFERENCE.getFullyQualifiedName());
    Table table2 = tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    // Add multiple relationship types between same entities
    // UPSTREAM relationship
    Entity.getCollectionDAO()
        .relationshipDAO()
        .insert(
            table1.getId(),
            table2.getId(),
            table1.getEntityReference().getType(),
            table2.getEntityReference().getType(),
            Relationship.UPSTREAM.ordinal());

    RdfUpdater.addRelationship(
        new org.openmetadata.schema.type.EntityRelationship()
            .withFromId(table2.getId())
            .withToId(table1.getId())
            .withFromEntity(table2.getEntityReference().getType())
            .withToEntity(table1.getEntityReference().getType())
            .withRelationshipType(Relationship.UPSTREAM));

    // JOINED_WITH relationship
    Entity.getCollectionDAO()
        .relationshipDAO()
        .insert(
            table1.getId(),
            table2.getId(),
            table1.getEntityReference().getType(),
            table2.getEntityReference().getType(),
            Relationship.JOINED_WITH.ordinal());

    RdfUpdater.addRelationship(
        new org.openmetadata.schema.type.EntityRelationship()
            .withFromId(table1.getId())
            .withToId(table2.getId())
            .withFromEntity(table1.getEntityReference().getType())
            .withToEntity(table2.getEntityReference().getType())
            .withRelationshipType(Relationship.JOINED_WITH));

    // Verify both relationships exist
    LOG.info("Verifying table2 UPSTREAM table1");
    verifyUpstreamRelationshipInRdf(table2.getEntityReference(), table1.getEntityReference());

    LOG.info("Verifying table1 JOINED_WITH table2");
    verifyJoinedWithRelationshipInRdf(table1.getEntityReference(), table2.getEntityReference());
  }
}
