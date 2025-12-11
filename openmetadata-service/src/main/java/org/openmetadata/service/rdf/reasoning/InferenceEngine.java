package org.openmetadata.service.rdf.reasoning;

import java.util.Iterator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.*;
import org.apache.jena.reasoner.*;
import org.apache.jena.reasoner.rulesys.GenericRuleReasoner;
import org.apache.jena.reasoner.rulesys.Rule;
import org.apache.jena.vocabulary.RDFS;

@Slf4j
public class InferenceEngine {

  private final ReasonerFactory reasonerFactory;
  private Reasoner reasoner;

  public enum ReasoningLevel {
    NONE, // No inference
    RDFS, // Basic RDFS inference (subClassOf, subPropertyOf, domain, range)
    OWL_LITE, // OWL Lite inference (inverseOf, TransitiveProperty, SymmetricProperty)
    OWL_DL, // OWL DL inference (full Description Logic)
    CUSTOM // Custom rules for OpenMetadata-specific inference
  }

  public InferenceEngine(ReasoningLevel level) {
    switch (level) {
      case RDFS:
        // Get RDFS reasoner
        this.reasonerFactory = null;
        this.reasoner = ReasonerRegistry.getRDFSReasoner();
        break;
      case OWL_LITE:
        // Get OWL Mini reasoner
        this.reasonerFactory = null;
        this.reasoner = ReasonerRegistry.getOWLMiniReasoner();
        break;
      case OWL_DL:
        // Get OWL reasoner
        this.reasonerFactory = null;
        this.reasoner = ReasonerRegistry.getOWLReasoner();
        break;
      case CUSTOM:
        this.reasonerFactory = null; // Will use custom rules
        this.reasoner = null;
        break;
      default:
        this.reasonerFactory = null;
        this.reasoner = null;
    }
  }

  /**
   * Create inference model from base model
   */
  public InfModel createInferenceModel(Model baseModel, Model ontologyModel) {
    if (reasoner != null) {
      // Pre-configured reasoner (RDFS, OWL)
      reasoner = reasoner.bindSchema(ontologyModel);
      return ModelFactory.createInfModel(reasoner, baseModel);
    } else if (reasonerFactory != null) {
      // Factory-based reasoner
      reasoner = reasonerFactory.create(null);
      reasoner = reasoner.bindSchema(ontologyModel);
      return ModelFactory.createInfModel(reasoner, baseModel);
    } else {
      // Custom rules reasoner
      List<Rule> rules = createCustomRules();
      reasoner = new GenericRuleReasoner(rules);
      reasoner = reasoner.bindSchema(ontologyModel);
      return ModelFactory.createInfModel(reasoner, baseModel);
    }
  }

  /**
   * Define custom inference rules for OpenMetadata
   */
  private List<Rule> createCustomRules() {
    String rules =
        """
      # Transitive upstream/downstream relationships
      [transitiveUpstream: (?a om:upstream ?b) (?b om:upstream ?c) -> (?a om:upstream ?c)]
      [transitiveDownstream: (?a om:downstream ?b) (?b om:downstream ?c) -> (?a om:downstream ?c)]

      # Inverse relationships
      [inverseUpstream: (?a om:upstream ?b) -> (?b om:downstream ?a)]
      [inverseDownstream: (?a om:downstream ?b) -> (?b om:upstream ?a)]
      [inverseUses: (?a om:uses ?b) -> (?b om:usedBy ?a)]
      [inverseOwns: (?a om:owns ?b) -> (?b om:ownedBy ?a)]

      # PII propagation
      [piiPropagation: (?table om:classifiedAs om:PII) (?downstream om:upstream ?table)
                       -> (?downstream om:classifiedAs om:PII)]

      # Impact analysis
      [deprecatedImpact: (?source om:status "deprecated") (?consumer om:uses ?source)
                         -> (?consumer om:hasImpact "source-deprecated")]

      # Domain membership inheritance
      [domainInheritance: (?parent om:inDomain ?domain) (?child om:belongsTo ?parent)
                          -> (?child om:inDomain ?domain)]

      # Team ownership inheritance
      [ownershipInheritance: (?parent om:ownedBy ?team) (?child om:belongsTo ?parent)
                             noValue(?child om:ownedBy)
                             -> (?child om:ownedBy ?team)]

      # Data quality inheritance
      [qualityPropagation: (?source om:dataQualityScore ?score)
                           (?target om:upstream ?source)
                           lessThan(?score, 50.0)
                           -> (?target om:hasQualityIssue "low-quality-upstream")]

      # Glossary term inheritance
      [glossaryInheritance: (?table om:hasGlossaryTerm ?term)
                            (?column om:belongsTo ?table)
                            -> (?column om:hasGlossaryTerm ?term)]

      # Service type inference
      [serviceTypeInference: (?service om:hasDatabase ?db) -> (?service rdf:type om:DatabaseService)]
      [serviceTypeInference2: (?service om:hasPipeline ?pipeline) -> (?service rdf:type om:PipelineService)]

      # Completeness checking
      [missingDescription: (?entity rdf:type om:DataAsset)
                           noValue(?entity om:description)
                           -> (?entity om:hasIssue "missing-description")]
      """;

    return Rule.parseRules(rules);
  }

  /**
   * Run inference and return new triples
   */
  public Model getInferredTriples(Model baseModel, Model ontologyModel) {
    InfModel infModel = createInferenceModel(baseModel, ontologyModel);

    // Get only the inferred triples (not the base ones)
    Model inferredModel = ModelFactory.createDefaultModel();

    StmtIterator iter = infModel.listStatements();
    while (iter.hasNext()) {
      Statement stmt = iter.next();
      if (!baseModel.contains(stmt)) {
        inferredModel.add(stmt);
      }
    }

    return inferredModel;
  }

  /**
   * Validate model consistency
   */
  public ValidityReport validateModel(Model model, Model ontologyModel) {
    InfModel infModel = createInferenceModel(model, ontologyModel);
    return infModel.validate();
  }

  /**
   * Check for specific inferences
   */
  public boolean hasInference(
      Model baseModel, Model ontologyModel, Resource subject, Property predicate, RDFNode object) {
    InfModel infModel = createInferenceModel(baseModel, ontologyModel);
    return infModel.contains(subject, predicate, object);
  }

  /**
   * Get explanation for an inference
   */
  public List<Derivation> explainInference(
      Model baseModel, Model ontologyModel, Statement inferredStatement) {
    InfModel infModel = createInferenceModel(baseModel, ontologyModel);

    if (infModel instanceof InfModel) {
      Iterator<Derivation> derivations = infModel.getDerivation(inferredStatement);
      List<Derivation> explanations = new java.util.ArrayList<>();

      while (derivations != null && derivations.hasNext()) {
        explanations.add(derivations.next());
      }

      return explanations;
    }

    return List.of();
  }
}
