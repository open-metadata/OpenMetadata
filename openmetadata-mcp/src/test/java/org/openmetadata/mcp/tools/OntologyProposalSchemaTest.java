package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.ontology.OntologyChangeSetValidator;

class OntologyProposalSchemaTest {
  private static final String SCHEMA_BASE = "https://open-metadata.org/schema/";

  @ParameterizedTest
  @ValueSource(
      strings = {
        "proposal",
        "operation",
        "relationship",
        "mapping",
        "term",
        "glossary",
        "axiom",
        "concept",
        "property"
      })
  void everyAdvertisedPayloadIncludesItsCanonicalLocalReferenceClosure(final String selected) {
    final var description = OntologyProposalSchema.describe(selected);
    assertThat(description.schemas()).containsKey(description.rootSchema());
    assertThat(description.createTool()).isEqualTo("create_ontology_change_set");
    assertThat(description.schemas().size()).isLessThanOrEqualTo(128);
    assertThat(JsonUtils.pojoToJson(description).length()).isLessThan(100_000);
    description
        .schemas()
        .forEach(
            (path, schema) ->
                schema.findValues("$ref").stream()
                    .map(JsonNode::asText)
                    .filter(reference -> !reference.startsWith("#"))
                    .forEach(
                        reference ->
                            assertThat(description.schemas())
                                .containsKey(OntologyProposalSchema.resolve(path, reference))));
  }

  @Test
  void aRelationshipProposalValidatesUsingOnlyTheDiscoveredSchemaBundle() {
    final var description = OntologyProposalSchema.describe("operation");
    final Map<String, String> schemas =
        description.schemas().entrySet().stream()
            .collect(
                Collectors.toMap(
                    entry -> SCHEMA_BASE + entry.getKey(), entry -> entry.getValue().toString()));
    final var validator =
        SchemaRegistry.withDefaultDialect(
                SpecificationVersion.DRAFT_2020_12, builder -> builder.schemas(schemas))
            .getSchema(SchemaLocation.of(SCHEMA_BASE + description.rootSchema()));
    final Map<String, String> from = reference("glossaryTerm");
    final Map<String, Object> relationship =
        Map.of(
            "id",
            id(),
            "fromTerm",
            from,
            "toTerm",
            reference("glossaryTerm"),
            "relationshipType",
            reference("relationshipType"),
            "provenance",
            "AiSuggested",
            "status",
            "Unprocessed",
            "createdBy",
            "alice",
            "createdAt",
            1_795_000_000_000L);
    final Map<String, Object> operation =
        Map.of(
            "id",
            id(),
            "operationType",
            "ADD_RELATIONSHIP",
            "state",
            "ACTIVE",
            "relationship",
            relationship,
            "targetId",
            from.get("id"),
            "baseVersion",
            1.2,
            "sourceMemoryIds",
            List.of(id()),
            "rationale",
            "Keep the supporting source for review");
    assertThat(validator.validate(JsonUtils.valueToTree(operation))).isEmpty();
    final var request =
        OntologyTool.proposal(
            Map.of(
                "name",
                "proposal",
                "displayName",
                "Proposal",
                "description",
                "For review",
                "glossaries",
                List.of("Customer"),
                "operations",
                List.of(operation)));
    assertThat(request.getOperations().getFirst().getRelationship().getProvenance())
        .isEqualTo(RelationProvenance.AI_SUGGESTED);
    assertThat(request.getOperations().getFirst().getSourceMemoryIds()).hasSize(1);
    final OntologyChangeSet proposal =
        new OntologyChangeSet()
            .withOperations(request.getOperations())
            .withUndoCursor(request.getOperations().size());
    OntologyChangeSetValidator.normalizeAndValidate(proposal);
    assertThat(proposal.getUndoCursor()).isEqualTo(1);
    proposal.getOperations().getFirst().setBaseVersion(null);
    assertThatThrownBy(() -> OntologyChangeSetValidator.normalizeAndValidate(proposal))
        .hasMessageContaining("baseVersion is required for an existing target");
  }

  @Test
  void defaultsToOperationAndRejectsArbitrarySchemaPaths() {
    assertThat(OntologyProposalSchema.describe(null).rootSchema())
        .isEqualTo("type/ontologyChangeOperation.json");
    assertThatThrownBy(() -> OntologyProposalSchema.describe("../../credentials"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown ontology schema");
    assertThatThrownBy(
            () ->
                OntologyProposalSchema.resolve(
                    "type/ontologyRelationship.json", "https://other.example/schema"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("non-classpath");
    assertThatThrownBy(
            () ->
                OntologyProposalSchema.resolve(
                    "type/ontologyRelationship.json", "basic.json?query=1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("non-classpath");
  }

  private static String id() {
    return UUID.randomUUID().toString();
  }

  private static Map<String, String> reference(final String type) {
    return Map.of("id", id(), "type", type);
  }
}
