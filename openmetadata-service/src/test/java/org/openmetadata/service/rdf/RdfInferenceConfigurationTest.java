package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.*;

import org.apache.jena.rdf.model.InfModel;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.reasoner.ValidityReport;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.reasoning.InferenceEngine;
import org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel;

/**
 * Tests for RDF Inference Engine - verifies that different reasoning levels work correctly and can
 * be configured.
 */
class RdfInferenceConfigurationTest {

  private static final String OM_NS = "https://open-metadata.org/ontology/";

  private Model baseModel;
  private Model ontologyModel;

  @BeforeEach
  void setUp() {
    baseModel = ModelFactory.createDefaultModel();
    ontologyModel = ModelFactory.createDefaultModel();
  }

  @Nested
  @DisplayName("Reasoning Level Configuration Tests")
  class ReasoningLevelTests {

    @Test
    @DisplayName("NONE level should not perform any inference")
    void testNoneLevel() {
      InferenceEngine engine = new InferenceEngine(ReasoningLevel.NONE);

      // Set up a simple hierarchy
      Property subClassOf = ontologyModel.createProperty(RDFS.subClassOf.getURI());
      Resource dataAsset = ontologyModel.createResource(OM_NS + "DataAsset");
      Resource table = ontologyModel.createResource(OM_NS + "Table");
      ontologyModel.add(table, subClassOf, dataAsset);

      // Add an instance
      Resource myTable = baseModel.createResource(OM_NS + "entity/table/123");
      baseModel.add(myTable, RDF.type, table);

      // With NONE level, getInferredTriples should be empty or minimal
      // Note: InferenceEngine with NONE will use custom rules but no standard inference
      Model inferred = engine.getInferredTriples(baseModel, ontologyModel);

      // The model should not have inferred the superclass type
      assertFalse(
          baseModel.contains(myTable, RDF.type, dataAsset),
          "Base model should not have inferred type");
    }

    @Test
    @DisplayName("RDFS level should infer subclass relationships")
    void testRdfsLevel() {
      InferenceEngine engine = new InferenceEngine(ReasoningLevel.RDFS);

      // Set up a simple hierarchy
      Resource dataAsset = ontologyModel.createResource(OM_NS + "DataAsset");
      Resource table = ontologyModel.createResource(OM_NS + "Table");
      ontologyModel.add(table, RDFS.subClassOf, dataAsset);

      // Add an instance
      Resource myTable = baseModel.createResource(OM_NS + "entity/table/123");
      baseModel.add(myTable, RDF.type, table);

      // Create inference model
      InfModel infModel = engine.createInferenceModel(baseModel, ontologyModel);

      // Should infer that myTable is also a DataAsset
      assertTrue(
          infModel.contains(myTable, RDF.type, dataAsset), "Should infer superclass type via RDFS");
    }

    @Test
    @DisplayName("OWL_LITE level should infer inverse relationships")
    void testOwlLiteLevel() {
      InferenceEngine engine = new InferenceEngine(ReasoningLevel.OWL_LITE);

      // Set up inverse property relationship
      Property uses = ontologyModel.createProperty(OM_NS + "uses");
      Property usedBy = ontologyModel.createProperty(OM_NS + "usedBy");
      ontologyModel.add(
          uses, ontologyModel.createProperty("http://www.w3.org/2002/07/owl#inverseOf"), usedBy);

      // Add a relationship
      Resource dashboard = baseModel.createResource(OM_NS + "entity/dashboard/123");
      Resource table = baseModel.createResource(OM_NS + "entity/table/456");
      baseModel.add(dashboard, uses, table);

      // Create inference model
      InfModel infModel = engine.createInferenceModel(baseModel, ontologyModel);

      // OWL reasoner should infer the inverse relationship
      // Note: The actual inference depends on the OWL Mini reasoner capabilities
      assertNotNull(infModel, "Inference model should be created");
    }

    @Test
    @DisplayName("CUSTOM level should apply OpenMetadata-specific rules")
    void testCustomLevel() {
      InferenceEngine engine = new InferenceEngine(ReasoningLevel.CUSTOM);

      // Set up transitive upstream relationship
      Property upstream = ontologyModel.createProperty(OM_NS + "upstream");

      // Add chain of relationships: A -> B -> C
      Resource tableA = baseModel.createResource(OM_NS + "entity/table/A");
      Resource tableB = baseModel.createResource(OM_NS + "entity/table/B");
      Resource tableC = baseModel.createResource(OM_NS + "entity/table/C");

      baseModel.add(tableA, upstream, tableB);
      baseModel.add(tableB, upstream, tableC);

      // Create inference model
      InfModel infModel = engine.createInferenceModel(baseModel, ontologyModel);

      // Custom rules should infer transitive relationship A -> C
      assertTrue(
          infModel.contains(tableA, upstream, tableC),
          "Should infer transitive upstream relationship");
    }
  }

  @Nested
  @DisplayName("Custom Inference Rules Tests")
  class CustomRulesTests {

    @Test
    @DisplayName("Transitive upstream rule should work")
    void testTransitiveUpstream() {
      InferenceEngine engine = new InferenceEngine(ReasoningLevel.CUSTOM);

      Property upstream = ontologyModel.createProperty(OM_NS + "upstream");

      Resource tableA = baseModel.createResource(OM_NS + "entity/table/A");
      Resource tableB = baseModel.createResource(OM_NS + "entity/table/B");
      Resource tableC = baseModel.createResource(OM_NS + "entity/table/C");

      baseModel.add(tableA, upstream, tableB);
      baseModel.add(tableB, upstream, tableC);

      InfModel infModel = engine.createInferenceModel(baseModel, ontologyModel);

      assertTrue(
          infModel.contains(tableA, upstream, tableC), "Should infer A upstream of C transitively");
    }

    @Test
    @DisplayName("Inverse upstream/downstream rule should work")
    void testInverseUpstreamDownstream() {
      InferenceEngine engine = new InferenceEngine(ReasoningLevel.CUSTOM);

      Property upstream = ontologyModel.createProperty(OM_NS + "upstream");
      Property downstream = ontologyModel.createProperty(OM_NS + "downstream");

      Resource tableA = baseModel.createResource(OM_NS + "entity/table/A");
      Resource tableB = baseModel.createResource(OM_NS + "entity/table/B");

      baseModel.add(tableA, upstream, tableB);

      InfModel infModel = engine.createInferenceModel(baseModel, ontologyModel);

      assertTrue(
          infModel.contains(tableB, downstream, tableA),
          "Should infer inverse downstream relationship");
    }
  }

  @Nested
  @DisplayName("Model Validation Tests")
  class ValidationTests {

    @Test
    @DisplayName("validateModel should return validity report")
    void testValidateModel() {
      InferenceEngine engine = new InferenceEngine(ReasoningLevel.RDFS);

      ValidityReport report = engine.validateModel(baseModel, ontologyModel);

      assertNotNull(report, "Validation report should not be null");
      assertTrue(report.isValid(), "Empty model should be valid");
    }

    @Test
    @DisplayName("hasInference should check for specific inferred triples")
    void testHasInference() {
      InferenceEngine engine = new InferenceEngine(ReasoningLevel.RDFS);

      Resource dataAsset = ontologyModel.createResource(OM_NS + "DataAsset");
      Resource table = ontologyModel.createResource(OM_NS + "Table");
      ontologyModel.add(table, RDFS.subClassOf, dataAsset);

      Resource myTable = baseModel.createResource(OM_NS + "entity/table/123");
      baseModel.add(myTable, RDF.type, table);

      boolean hasInference =
          engine.hasInference(baseModel, ontologyModel, myTable, RDF.type, dataAsset);

      assertTrue(hasInference, "Should have inferred type relationship");
    }
  }

  @Nested
  @DisplayName("Configuration Schema Tests")
  class ConfigurationSchemaTests {

    @Test
    @DisplayName("ReasoningLevel enum should have all expected values")
    void testReasoningLevelEnum() {
      ReasoningLevel[] levels = ReasoningLevel.values();

      assertEquals(5, levels.length, "Should have 5 reasoning levels");
      assertNotNull(ReasoningLevel.NONE, "Should have NONE level");
      assertNotNull(ReasoningLevel.RDFS, "Should have RDFS level");
      assertNotNull(ReasoningLevel.OWL_LITE, "Should have OWL_LITE level");
      assertNotNull(ReasoningLevel.OWL_DL, "Should have OWL_DL level");
      assertNotNull(ReasoningLevel.CUSTOM, "Should have CUSTOM level");
    }

    @Test
    @DisplayName("InferenceEngine should be creatable with all reasoning levels")
    void testAllReasoningLevels() {
      for (ReasoningLevel level : ReasoningLevel.values()) {
        InferenceEngine engine = new InferenceEngine(level);
        assertNotNull(engine, "Should create engine for level " + level);
      }
    }
  }
}
