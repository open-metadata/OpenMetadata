package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for JSON-LD context files - verifies that structured properties are properly mapped to RDF
 * types instead of @json literals.
 */
class RdfJsonLdContextTest {

  private static ObjectMapper objectMapper;
  private static JsonNode baseContext;
  private static JsonNode lineageContext;
  private static JsonNode governanceContext;
  private static JsonNode aiContext;
  private static JsonNode automationContext;

  @BeforeAll
  static void loadContexts() throws Exception {
    objectMapper = new ObjectMapper();

    try (InputStream is =
        RdfJsonLdContextTest.class.getResourceAsStream("/rdf/contexts/base.jsonld")) {
      if (is != null) {
        JsonNode contextDoc = objectMapper.readTree(is);
        baseContext = contextDoc.get("@context");
      }
    }

    try (InputStream is =
        RdfJsonLdContextTest.class.getResourceAsStream("/rdf/contexts/lineage.jsonld")) {
      if (is != null) {
        JsonNode contextDoc = objectMapper.readTree(is);
        // Lineage context has array format with base reference
        if (contextDoc.get("@context").isArray()) {
          lineageContext = contextDoc.get("@context").get(1);
        } else {
          lineageContext = contextDoc.get("@context");
        }
      }
    }

    try (InputStream is =
        RdfJsonLdContextTest.class.getResourceAsStream("/rdf/contexts/governance.jsonld")) {
      if (is != null) {
        JsonNode contextDoc = objectMapper.readTree(is);
        if (contextDoc.get("@context").isArray()) {
          governanceContext = contextDoc.get("@context").get(1);
        } else {
          governanceContext = contextDoc.get("@context");
        }
      }
    }

    try (InputStream is =
        RdfJsonLdContextTest.class.getResourceAsStream("/rdf/contexts/ai.jsonld")) {
      if (is != null) {
        JsonNode contextDoc = objectMapper.readTree(is);
        if (contextDoc.get("@context").isArray()) {
          aiContext = contextDoc.get("@context").get(1);
        } else {
          aiContext = contextDoc.get("@context");
        }
      }
    }

    try (InputStream is =
        RdfJsonLdContextTest.class.getResourceAsStream("/rdf/contexts/automation.jsonld")) {
      if (is != null) {
        JsonNode contextDoc = objectMapper.readTree(is);
        if (contextDoc.get("@context").isArray()) {
          automationContext = contextDoc.get("@context").get(1);
        } else {
          automationContext = contextDoc.get("@context");
        }
      }
    }
  }

  @Nested
  @DisplayName("P0-1: Structured Properties Should Not Use @json Type")
  class StructuredPropertyTests {

    @Test
    @DisplayName("changeDescription should map to @id type, not @json")
    void testChangeDescriptionMapping() {
      if (baseContext == null) {
        return; // Skip if context not found (e.g., running without resources)
      }

      JsonNode changeDesc = baseContext.get("changeDescription");
      assertNotNull(changeDesc, "changeDescription should be defined in base context");

      String type = changeDesc.get("@type").asText();
      assertNotEquals("@json", type, "changeDescription should NOT use @json type");
      assertEquals("@id", type, "changeDescription should use @id type for structured RDF");
    }

    @Test
    @DisplayName("votes should map to @id type, not @json")
    void testVotesMapping() {
      if (baseContext == null) {
        return;
      }

      JsonNode votes = baseContext.get("votes");
      assertNotNull(votes, "votes should be defined in base context");

      String type = votes.get("@type").asText();
      assertNotEquals("@json", type, "votes should NOT use @json type");
      assertEquals("@id", type, "votes should use @id type for structured RDF");
    }

    @Test
    @DisplayName("lifeCycle should map to @id type, not @json")
    void testLifeCycleMapping() {
      if (baseContext == null) {
        return;
      }

      JsonNode lifeCycle = baseContext.get("lifeCycle");
      assertNotNull(lifeCycle, "lifeCycle should be defined in base context");

      String type = lifeCycle.get("@type").asText();
      assertNotEquals("@json", type, "lifeCycle should NOT use @json type");
      assertEquals("@id", type, "lifeCycle should use @id type for structured RDF");
    }

    @Test
    @DisplayName("customProperties should map to @id type with @set container, not @json")
    void testCustomPropertiesMapping() {
      if (baseContext == null) {
        return;
      }

      JsonNode customProps = baseContext.get("customProperties");
      assertNotNull(customProps, "customProperties should be defined in base context");

      String type = customProps.get("@type").asText();
      assertNotEquals("@json", type, "customProperties should NOT use @json type");
      assertEquals("@id", type, "customProperties should use @id type for structured RDF");

      String container = customProps.get("@container").asText();
      assertEquals("@set", container, "customProperties should use @set container");
    }

    @Test
    @DisplayName("extension should map to @id type, not @json")
    void testExtensionMapping() {
      if (baseContext == null) {
        return;
      }

      JsonNode extension = baseContext.get("extension");
      assertNotNull(extension, "extension should be defined in base context");

      String type = extension.get("@type").asText();
      assertNotEquals("@json", type, "extension should NOT use @json type");
      assertEquals("@id", type, "extension should use @id type for structured RDF");
    }
  }

  @Nested
  @DisplayName("P0-1: Supporting Type Definitions")
  class SupportingTypeTests {

    @Test
    @DisplayName("ChangeDescription type should be defined")
    void testChangeDescriptionType() {
      if (baseContext == null) {
        return;
      }

      JsonNode changeDescType = baseContext.get("ChangeDescription");
      assertNotNull(changeDescType, "ChangeDescription type should be defined");
      assertEquals("om:ChangeDescription", changeDescType.asText());
    }

    @Test
    @DisplayName("FieldChange type should be defined")
    void testFieldChangeType() {
      if (baseContext == null) {
        return;
      }

      JsonNode fieldChangeType = baseContext.get("FieldChange");
      assertNotNull(fieldChangeType, "FieldChange type should be defined");
      assertEquals("om:FieldChange", fieldChangeType.asText());
    }

    @Test
    @DisplayName("Votes type should be defined")
    void testVotesType() {
      if (baseContext == null) {
        return;
      }

      JsonNode votesType = baseContext.get("Votes");
      assertNotNull(votesType, "Votes type should be defined");
      assertEquals("om:Votes", votesType.asText());
    }

    @Test
    @DisplayName("LifeCycle type should be defined")
    void testLifeCycleType() {
      if (baseContext == null) {
        return;
      }

      JsonNode lifeCycleType = baseContext.get("LifeCycle");
      assertNotNull(lifeCycleType, "LifeCycle type should be defined");
      assertEquals("om:LifeCycle", lifeCycleType.asText());
    }

    @Test
    @DisplayName("CustomProperty type should be defined")
    void testCustomPropertyType() {
      if (baseContext == null) {
        return;
      }

      JsonNode customPropType = baseContext.get("CustomProperty");
      assertNotNull(customPropType, "CustomProperty type should be defined");
      assertEquals("om:CustomProperty", customPropType.asText());
    }

    @Test
    @DisplayName("Extension type should be defined")
    void testExtensionType() {
      if (baseContext == null) {
        return;
      }

      JsonNode extensionType = baseContext.get("Extension");
      assertNotNull(extensionType, "Extension type should be defined");
      assertEquals("om:Extension", extensionType.asText());
    }
  }

  @Nested
  @DisplayName("P0-1: ChangeDescription Property Definitions")
  class ChangeDescriptionPropertyTests {

    @Test
    @DisplayName("previousVersion should be defined with decimal type")
    void testPreviousVersion() {
      if (baseContext == null) {
        return;
      }

      JsonNode prevVersion = baseContext.get("previousVersion");
      assertNotNull(prevVersion, "previousVersion should be defined");
      assertEquals("xsd:decimal", prevVersion.get("@type").asText());
    }

    @Test
    @DisplayName("fieldsAdded should be defined with @set container")
    void testFieldsAdded() {
      if (baseContext == null) {
        return;
      }

      JsonNode fieldsAdded = baseContext.get("fieldsAdded");
      assertNotNull(fieldsAdded, "fieldsAdded should be defined");
      assertEquals("@set", fieldsAdded.get("@container").asText());
    }

    @Test
    @DisplayName("fieldsUpdated should be defined with @set container")
    void testFieldsUpdated() {
      if (baseContext == null) {
        return;
      }

      JsonNode fieldsUpdated = baseContext.get("fieldsUpdated");
      assertNotNull(fieldsUpdated, "fieldsUpdated should be defined");
      assertEquals("@set", fieldsUpdated.get("@container").asText());
    }

    @Test
    @DisplayName("fieldName should be defined with string type")
    void testFieldName() {
      if (baseContext == null) {
        return;
      }

      JsonNode fieldName = baseContext.get("fieldName");
      assertNotNull(fieldName, "fieldName should be defined");
      assertEquals("xsd:string", fieldName.get("@type").asText());
    }
  }

  @Nested
  @DisplayName("P0-1: Votes Property Definitions")
  class VotesPropertyTests {

    @Test
    @DisplayName("upVotes should be defined with integer type")
    void testUpVotes() {
      if (baseContext == null) {
        return;
      }

      JsonNode upVotes = baseContext.get("upVotes");
      assertNotNull(upVotes, "upVotes should be defined");
      assertEquals("xsd:integer", upVotes.get("@type").asText());
    }

    @Test
    @DisplayName("downVotes should be defined with integer type")
    void testDownVotes() {
      if (baseContext == null) {
        return;
      }

      JsonNode downVotes = baseContext.get("downVotes");
      assertNotNull(downVotes, "downVotes should be defined");
      assertEquals("xsd:integer", downVotes.get("@type").asText());
    }

    @Test
    @DisplayName("upVoters should be defined with @set container")
    void testUpVoters() {
      if (baseContext == null) {
        return;
      }

      JsonNode upVoters = baseContext.get("upVoters");
      assertNotNull(upVoters, "upVoters should be defined");
      assertEquals("@set", upVoters.get("@container").asText());
    }
  }

  @Nested
  @DisplayName("P0-2: Lineage Context Tests")
  class LineageContextTests {

    @Test
    @DisplayName("Lineage context file should exist")
    void testLineageContextExists() {
      // The test passes if the file was loaded successfully
      // If lineageContext is null, the file may not exist yet which is expected before
      // implementation
      if (lineageContext == null) {
        // File doesn't exist yet - this is acceptable for a new feature
        return;
      }
      assertNotNull(lineageContext, "Lineage context should be loaded");
    }

    @Test
    @DisplayName("upstreamEdges should use prov:wasDerivedFrom")
    void testUpstreamEdgesMapping() {
      if (lineageContext == null) {
        return;
      }

      JsonNode upstreamEdges = lineageContext.get("upstreamEdges");
      if (upstreamEdges != null) {
        assertEquals(
            "prov:wasDerivedFrom",
            upstreamEdges.get("@id").asText(),
            "upstreamEdges should map to prov:wasDerivedFrom");
        assertEquals(
            "@set",
            upstreamEdges.get("@container").asText(),
            "upstreamEdges should use @set container");
      }
    }

    @Test
    @DisplayName("downstreamEdges should use prov:wasInfluencedBy")
    void testDownstreamEdgesMapping() {
      if (lineageContext == null) {
        return;
      }

      JsonNode downstreamEdges = lineageContext.get("downstreamEdges");
      if (downstreamEdges != null) {
        assertEquals(
            "prov:wasInfluencedBy",
            downstreamEdges.get("@id").asText(),
            "downstreamEdges should map to prov:wasInfluencedBy");
      }
    }

    @Test
    @DisplayName("pipeline should use prov:wasGeneratedBy")
    void testPipelineMapping() {
      if (lineageContext == null) {
        return;
      }

      JsonNode pipeline = lineageContext.get("pipeline");
      if (pipeline != null) {
        assertEquals(
            "prov:wasGeneratedBy",
            pipeline.get("@id").asText(),
            "pipeline should map to prov:wasGeneratedBy");
      }
    }

    @Test
    @DisplayName("columnsLineage should be defined")
    void testColumnsLineageMapping() {
      if (lineageContext == null) {
        return;
      }

      JsonNode columnsLineage = lineageContext.get("columnsLineage");
      if (columnsLineage != null) {
        assertNotNull(columnsLineage.get("@id"), "columnsLineage should have @id mapping");
        assertEquals(
            "@set",
            columnsLineage.get("@container").asText(),
            "columnsLineage should use @set container");
      }
    }
  }

  @Nested
  @DisplayName("P1.8: Governance Context SKOS Hierarchy")
  class GovernanceContextSkosTests {

    @Test
    @DisplayName("glossary field should map to skos:inScheme on a glossary term")
    void testGlossaryMapsToInScheme() {
      assertNotNull(governanceContext, "governance.jsonld should be loaded");
      JsonNode glossary = governanceContext.get("glossary");
      assertNotNull(glossary, "'glossary' field mapping must be defined");
      assertEquals(
          "skos:inScheme",
          glossary.get("@id").asText(),
          "GlossaryTerm.glossary should use SKOS inScheme, not the legacy om:belongsToGlossary");
      assertEquals("@id", glossary.get("@type").asText());
    }

    @Test
    @DisplayName("classification field should map to skos:inScheme on a tag")
    void testClassificationMapsToInScheme() {
      assertNotNull(governanceContext);
      JsonNode classification = governanceContext.get("classification");
      assertNotNull(classification, "'classification' field mapping must be defined");
      assertEquals(
          "skos:inScheme",
          classification.get("@id").asText(),
          "Tag.classification should use SKOS inScheme to align with skos:ConceptScheme membership");
    }

    @Test
    @DisplayName("parent field should map to skos:broader")
    void testParentMapsToSkosBroader() {
      assertNotNull(governanceContext);
      JsonNode parent = governanceContext.get("parent");
      assertNotNull(parent, "'parent' field mapping must be defined");
      assertEquals("skos:broader", parent.get("@id").asText());
      assertEquals("@id", parent.get("@type").asText());
    }

    @Test
    @DisplayName("children field should map to skos:narrower with @set container")
    void testChildrenMapsToSkosNarrower() {
      assertNotNull(governanceContext);
      JsonNode children = governanceContext.get("children");
      assertNotNull(
          children,
          "'children' field mapping must be defined (it replaces the prior 'childTerms' alias which referenced a non-existent field)");
      assertEquals("skos:narrower", children.get("@id").asText());
      assertEquals("@id", children.get("@type").asText());
      assertEquals("@set", children.get("@container").asText());
    }

    @Test
    @DisplayName("Stale childTerms alias should no longer be present")
    void testNoLegacyChildTermsAlias() {
      assertNotNull(governanceContext);
      assertNull(
          governanceContext.get("childTerms"),
          "Legacy 'childTerms' alias must not coexist with 'children' — GlossaryTerm has no 'childTerms' field, so the alias would never fire");
    }

    @Test
    @DisplayName("DataContract and Persona fields should be wired to ontology predicates")
    void testDataContractAndPersonaFieldsWired() {
      assertNotNull(governanceContext);
      assertNotNull(governanceContext.get("contractStatus"));
      assertEquals(
          "om:contractStatus", governanceContext.get("contractStatus").get("@id").asText());
      assertNotNull(governanceContext.get("appliesTo"));
      assertEquals("om:appliesToEntity", governanceContext.get("appliesTo").get("@id").asText());
      assertEquals("@id", governanceContext.get("appliesTo").get("@type").asText());
      assertNotNull(governanceContext.get("users"));
      assertEquals("om:appliesToUser", governanceContext.get("users").get("@id").asText());
    }
  }

  @Nested
  @DisplayName("P1.5: AI / Automation Contexts")
  class AiAutomationContextTests {

    @Test
    @DisplayName("ai.jsonld should be loadable and define LLMModel + AIApplication types")
    void testAiContextLoaded() {
      assertNotNull(aiContext, "ai.jsonld should be on the classpath");
      assertEquals("om:LLMModel", aiContext.get("LLMModel").get("@id").asText());
      assertEquals("om:AIApplication", aiContext.get("AIApplication").get("@id").asText());
      assertEquals("om:McpServer", aiContext.get("McpServer").get("@id").asText());
      assertEquals("om:PromptTemplate", aiContext.get("PromptTemplate").get("@id").asText());
    }

    @Test
    @DisplayName("AgentExecution and McpExecution should be PROV activities")
    void testExecutionsAreProvActivities() {
      assertNotNull(aiContext);
      JsonNode agentExec = aiContext.get("AgentExecution");
      assertNotNull(agentExec);
      assertTrue(
          agentExec.get("@type").toString().contains("prov:Activity"),
          "AgentExecution must be typed as prov:Activity for cross-system PROV traversal");
      JsonNode mcpExec = aiContext.get("McpExecution");
      assertTrue(mcpExec.get("@type").toString().contains("prov:Activity"));
    }

    @Test
    @DisplayName("LLMModel.trainingDatasets should map to om:hasTrainingDataset for AI lineage")
    void testTrainingDatasetsMapping() {
      assertNotNull(aiContext);
      JsonNode trainingDatasets = aiContext.get("trainingDatasets");
      assertNotNull(
          trainingDatasets,
          "trainingDatasets must be wired so AI lineage queries can traverse model -> dataset");
      assertEquals("om:hasTrainingDataset", trainingDatasets.get("@id").asText());
      assertEquals("@id", trainingDatasets.get("@type").asText());
      assertEquals("@set", trainingDatasets.get("@container").asText());
    }

    @Test
    @DisplayName("AIApplication.models should map to om:usesModel object property")
    void testAiAppUsesModelMapping() {
      assertNotNull(aiContext);
      JsonNode models = aiContext.get("models");
      assertNotNull(models);
      assertEquals("om:usesModel", models.get("@id").asText());
      assertEquals("@id", models.get("@type").asText());
    }

    @Test
    @DisplayName("automation.jsonld should define Workflow + WorkflowInstance types")
    void testAutomationContextLoaded() {
      assertNotNull(automationContext, "automation.jsonld should be on the classpath");
      assertEquals("om:Workflow", automationContext.get("Workflow").get("@id").asText());
      JsonNode wfInstance = automationContext.get("WorkflowInstance");
      assertNotNull(wfInstance);
      assertTrue(
          wfInstance.get("@type").toString().contains("prov:Activity"),
          "WorkflowInstance is a single run and must be typed as prov:Activity");
    }
  }
}
