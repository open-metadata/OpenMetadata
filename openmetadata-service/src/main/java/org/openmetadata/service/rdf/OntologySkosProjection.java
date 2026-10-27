package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.vocabulary.DCTerms;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.SKOS;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.ontology.OntologyReleaseReader;

/**
 * Projects the concepts of a sealed release as SKOS. Every concept becomes a {@code skos:Concept}
 * in the release's concept scheme, named parents become {@code skos:broader}, and mappings keep
 * their match predicates. Properties and axioms other than named subclass parents have no SKOS
 * form and are left out. With extended labels each label also becomes its own {@code
 * skosxl:Label} resource that carries the text.
 */
public final class OntologySkosProjection {
  public static final String SKOSXL_NAMESPACE = "http://www.w3.org/2008/05/skos-xl#";
  private static final Resource LABEL_CLASS =
      ResourceFactory.createResource(SKOSXL_NAMESPACE + "Label");
  private static final Property LITERAL_FORM =
      ResourceFactory.createProperty(SKOSXL_NAMESPACE + "literalForm");
  private static final Property XL_PREF_LABEL =
      ResourceFactory.createProperty(SKOSXL_NAMESPACE + "prefLabel");
  private static final Property XL_ALT_LABEL =
      ResourceFactory.createProperty(SKOSXL_NAMESPACE + "altLabel");

  private final boolean extendedLabels;

  public OntologySkosProjection(final boolean extendedLabels) {
    this.extendedLabels = extendedLabels;
  }

  public Model build(final OntologyRelease release, final List<OntologyReleaseMember> members) {
    OntologyReleaseManifest.verify(release, members);
    final List<OntologyDefinition> definitions =
        members.stream().map(member -> OntologyReleaseReader.definition(release, member)).toList();
    final Ontology ontology = root(definitions);
    final List<OntologyConcept> concepts = ofType(definitions, OntologyConcept.class);
    final Set<String> conceptIris =
        concepts.stream().map(concept -> concept.getIri().toString()).collect(Collectors.toSet());
    final Model model = model(ontology);
    try {
      final Resource scheme = scheme(model, ontology);
      concepts.forEach(concept -> concept(model, release, scheme, concept));
      ofType(definitions, OntologyAxiom.class).forEach(axiom -> broader(model, conceptIris, axiom));
      return model;
    } catch (RuntimeException exception) {
      model.close();
      throw exception;
    }
  }

  private static <T extends OntologyDefinition> List<T> ofType(
      final List<OntologyDefinition> definitions, final Class<T> type) {
    return definitions.stream().filter(type::isInstance).map(type::cast).toList();
  }

  private static Ontology root(final List<OntologyDefinition> definitions) {
    final List<Ontology> roots = ofType(definitions, Ontology.class);
    if (roots.size() != 1) {
      throw new BadRequestException("An ontology release requires exactly one ontology root");
    }
    return roots.getFirst();
  }

  private Model model(final Ontology ontology) {
    final Model model = ModelFactory.createDefaultModel();
    model.setNsPrefixes(
        Map.of(
            "skos",
            SKOS.uri,
            "owl",
            OWL2.NS,
            "dct",
            DCTerms.NS,
            "om",
            OntologyRdfVocabulary.NAMESPACE));
    if (extendedLabels) {
      model.setNsPrefix("skosxl", SKOSXL_NAMESPACE);
    }
    listOrEmpty(ontology.getPrefixes())
        .forEach(prefix -> model.setNsPrefix(prefix.getPrefix(), prefix.getNamespace().toString()));
    return model;
  }

  private static Resource scheme(final Model model, final Ontology ontology) {
    final Resource scheme =
        model
            .createResource(ontology.getIri().toString())
            .addProperty(RDF.type, SKOS.ConceptScheme)
            .addProperty(SKOS.prefLabel, label(ontology));
    if (!nullOrEmpty(ontology.getDescription())) {
      scheme.addProperty(SKOS.definition, ontology.getDescription());
    }
    return scheme;
  }

  private void concept(
      final Model model,
      final OntologyRelease release,
      final Resource scheme,
      final OntologyConcept concept) {
    final Resource subject =
        model
            .createResource(concept.getIri().toString())
            .addProperty(RDF.type, SKOS.Concept)
            .addProperty(SKOS.inScheme, scheme);
    if (!nullOrEmpty(concept.getDescription())) {
      subject.addProperty(SKOS.definition, concept.getDescription());
    }
    final String labelBase = release.getVersionIri() + ":CONCEPT:" + concept.getId();
    label(subject, SKOS.prefLabel, XL_PREF_LABEL, labelBase + ":prefLabel", label(concept));
    final List<String> synonyms =
        nullOrEmpty(concept.getSynonyms())
            ? List.of()
            : concept.getSynonyms().stream().sorted().toList();
    for (int index = 0; index < synonyms.size(); index++) {
      label(
          subject,
          SKOS.altLabel,
          XL_ALT_LABEL,
          labelBase + ":altLabel:" + index,
          synonyms.get(index));
    }
    listOrEmpty(concept.getConceptMappings())
        .forEach(
            mapping ->
                subject.addProperty(
                    OntologyRdfVocabulary.mapping(mapping.getMappingType()),
                    model.createResource(mapping.getConceptIri().toString())));
    deprecation(subject, concept);
  }

  private void label(
      final Resource subject,
      final Property plain,
      final Property extended,
      final String labelIri,
      final String text) {
    subject.addProperty(plain, text);
    if (extendedLabels) {
      final Resource label =
          subject
              .getModel()
              .createResource(labelIri)
              .addProperty(RDF.type, LABEL_CLASS)
              .addProperty(LITERAL_FORM, text);
      subject.addProperty(extended, label);
    }
  }

  private static void deprecation(final Resource subject, final OntologyConcept concept) {
    if (Boolean.TRUE.equals(concept.getDeprecated())) {
      subject.addLiteral(OWL2.deprecated, true);
    }
    if (concept.getReplacedBy() != null) {
      subject.addProperty(
          DCTerms.isReplacedBy,
          subject.getModel().createResource(concept.getReplacedBy().toString()));
    }
  }

  private static void broader(
      final Model model, final Set<String> conceptIris, final OntologyAxiom axiom) {
    final URI parent = namedParent(axiom);
    if (parent != null && conceptIris.contains(axiom.getSubjectIri().toString())) {
      model
          .createResource(axiom.getSubjectIri().toString())
          .addProperty(SKOS.broader, model.createResource(parent.toString()));
    }
  }

  private static URI namedParent(final OntologyAxiom axiom) {
    final List<OntologyExpression> expressions = listOrEmpty(axiom.getExpressions());
    final boolean plainSubclass =
        axiom.getAxiomType() == OntologyAxiomType.SUBCLASS_OF
            && axiom.getPropertyIri() == null
            && axiom.getTargetIri() == null
            && axiom.getLiteral() == null
            && expressions.size() == 1
            && expressions.getFirst().getKind() == OntologyExpressionKind.NAMED_CLASS;
    return plainSubclass ? expressions.getFirst().getClassIri() : null;
  }

  private static String label(final OntologyDefinition definition) {
    return nullOrEmpty(definition.getDisplayName())
        ? definition.getName()
        : definition.getDisplayName();
  }
}
