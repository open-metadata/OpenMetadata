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
        this.reasonerFactory = null;
        this.reasoner = ReasonerRegistry.getRDFSReasoner();
        break;
      case OWL_LITE:
        this.reasonerFactory = null;
        this.reasoner = ReasonerRegistry.getOWLMiniReasoner();
        break;
      case OWL_DL:
        this.reasonerFactory = null;
        this.reasoner = ReasonerRegistry.getOWLReasoner();
        break;
      case CUSTOM:
        this.reasonerFactory = null;
        this.reasoner = null;
        break;
      default:
        this.reasonerFactory = null;
        this.reasoner = null;
    }
  }

  public InfModel createInferenceModel(Model baseModel, Model ontologyModel) {
    if (reasoner != null) {
      reasoner = reasoner.bindSchema(ontologyModel);
      return ModelFactory.createInfModel(reasoner, baseModel);
    } else if (reasonerFactory != null) {
      reasoner = reasonerFactory.create(null);
      reasoner = reasoner.bindSchema(ontologyModel);
      return ModelFactory.createInfModel(reasoner, baseModel);
    } else {
      List<Rule> rules = createCustomRules();
      reasoner = new GenericRuleReasoner(rules);
      reasoner = reasoner.bindSchema(ontologyModel);
      return ModelFactory.createInfModel(reasoner, baseModel);
    }
  }

  /**
   * Define custom inference rules for OpenMetadata. Note: Jena rules require full URIs, not
   * prefixed names.
   */
  private List<Rule> createCustomRules() {
    String om = "https://open-metadata.org/ontology/";
    String rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

    // Build rules with full URIs
    StringBuilder rulesBuilder = new StringBuilder();

    // Transitive upstream/downstream relationships
    rulesBuilder.append(
        String.format(
            "[transitiveUpstream: (?a <%supstream> ?b) (?b <%supstream> ?c) -> (?a <%supstream> ?c)]%n",
            om, om, om));
    rulesBuilder.append(
        String.format(
            "[transitiveDownstream: (?a <%sdownstream> ?b) (?b <%sdownstream> ?c) -> (?a <%sdownstream> ?c)]%n",
            om, om, om));

    // Inverse relationships
    rulesBuilder.append(
        String.format(
            "[inverseUpstream: (?a <%supstream> ?b) -> (?b <%sdownstream> ?a)]%n", om, om));
    rulesBuilder.append(
        String.format(
            "[inverseDownstream: (?a <%sdownstream> ?b) -> (?b <%supstream> ?a)]%n", om, om));
    rulesBuilder.append(
        String.format("[inverseUses: (?a <%suses> ?b) -> (?b <%susedBy> ?a)]%n", om, om));
    rulesBuilder.append(
        String.format("[inverseOwns: (?a <%sowns> ?b) -> (?b <%sownedBy> ?a)]%n", om, om));

    // Domain membership inheritance
    rulesBuilder.append(
        String.format(
            "[domainInheritance: (?parent <%sinDomain> ?domain) (?child <%sbelongsTo> ?parent) -> (?child <%sinDomain> ?domain)]%n",
            om, om, om));

    // Glossary term inheritance
    rulesBuilder.append(
        String.format(
            "[glossaryInheritance: (?table <%shasGlossaryTerm> ?term) (?column <%sbelongsTo> ?table) -> (?column <%shasGlossaryTerm> ?term)]%n",
            om, om, om));

    // Service type inference
    rulesBuilder.append(
        String.format(
            "[serviceTypeInference: (?service <%shasDatabase> ?db) -> (?service <%stype> <%sDatabaseService>)]%n",
            om, rdf, om));
    rulesBuilder.append(
        String.format(
            "[serviceTypeInference2: (?service <%shasPipeline> ?pipeline) -> (?service <%stype> <%sPipelineService>)]%n",
            om, rdf, om));

    return Rule.parseRules(rulesBuilder.toString());
  }

  public Model getInferredTriples(Model baseModel, Model ontologyModel) {
    InfModel infModel = createInferenceModel(baseModel, ontologyModel);

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

  public ValidityReport validateModel(Model model, Model ontologyModel) {
    InfModel infModel = createInferenceModel(model, ontologyModel);
    return infModel.validate();
  }

  public boolean hasInference(
      Model baseModel, Model ontologyModel, Resource subject, Property predicate, RDFNode object) {
    InfModel infModel = createInferenceModel(baseModel, ontologyModel);
    return infModel.contains(subject, predicate, object);
  }

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
