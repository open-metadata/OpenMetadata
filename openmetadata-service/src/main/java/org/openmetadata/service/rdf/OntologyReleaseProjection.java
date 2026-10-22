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
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.vocabulary.DCTerms;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.apache.jena.vocabulary.XSD;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.rdf.OwlEntityDeclarations.EntityKind;

/** The ontology-release-v1 RDF projection reads sealed SQL members without any live lookup. */
public final class OntologyReleaseProjection {
  public Model build(final OntologyRelease release, final List<OntologyReleaseMember> members) {
    OntologyReleaseManifest.verify(release, members);
    final List<Definition> definitions =
        members.stream()
            .map(
                member -> new Definition(member, OntologyReleaseReader.definition(release, member)))
            .toList();
    final Ontology ontology = root(definitions);
    final Set<String> dataProperties =
        definitions.stream()
            .map(Definition::value)
            .filter(OntologyProperty.class::isInstance)
            .map(OntologyProperty.class::cast)
            .filter(property -> property.getKind() == OntologyPropertyKind.DATA)
            .map(property -> property.getIri().toString())
            .collect(Collectors.toUnmodifiableSet());
    final OntologyExpressionRdfWriter expressions =
        new OntologyExpressionRdfWriter(
            iri ->
                dataProperties.contains(iri)
                    || OwlEntityDeclarations.vocabularyKind(iri) == EntityKind.DATA_PROPERTY);
    final Model model = model(ontology);
    try {
      definitions.forEach(definition -> write(model, release, definition, expressions));
      return model;
    } catch (RuntimeException exception) {
      model.close();
      throw exception;
    }
  }

  private static Ontology root(final List<Definition> definitions) {
    final List<Ontology> roots =
        definitions.stream()
            .map(Definition::value)
            .filter(Ontology.class::isInstance)
            .map(Ontology.class::cast)
            .toList();
    if (roots.size() != 1) {
      throw new BadRequestException("An ontology release requires exactly one ontology root");
    }
    return roots.getFirst();
  }

  private static Model model(final Ontology ontology) {
    final Model model = ModelFactory.createDefaultModel();
    model.setNsPrefixes(
        Map.of(
            "owl",
            OWL2.NS,
            "rdf",
            RDF.uri,
            "rdfs",
            RDFS.uri,
            "skos",
            SKOS.uri,
            "xsd",
            XSD.NS,
            "dct",
            DCTerms.NS,
            "om",
            OntologyRdfVocabulary.NAMESPACE));
    listOrEmpty(ontology.getPrefixes())
        .forEach(prefix -> model.setNsPrefix(prefix.getPrefix(), prefix.getNamespace().toString()));
    OwlEntityDeclarations.declare(model, DCTerms.source, EntityKind.ANNOTATION_PROPERTY);
    return model;
  }

  private static void write(
      final Model target,
      final OntologyRelease release,
      final Definition definition,
      final OntologyExpressionRdfWriter expressions) {
    final Model fragment = ModelFactory.createDefaultModel();
    try {
      final String memberIri =
          release.getVersionIri()
              + ":"
              + definition.member().getMemberKind()
              + ":"
              + definition.member().getMemberId();
      final Resource subject =
          switch (definition.value()) {
            case Ontology ontology -> fragment
                .createResource(ontology.getIri().toString())
                .addProperty(RDF.type, OWL2.Ontology)
                .addProperty(
                    OWL2.versionIRI, fragment.createResource(release.getVersionIri().toString()));
            case OntologyConcept concept -> concept(fragment, concept);
            case OntologyProperty property -> OntologyPropertyRdfWriter.write(
                fragment, property, memberIri + ":values");
            case OntologyAxiom axiom -> {
              expressions.write(fragment, axiom);
              yield fragment.createResource(axiom.getSubjectIri().toString());
            }
            default -> throw new BadRequestException("Unsupported ontology definition");
          };
      if (!(definition.value() instanceof OntologyAxiom)) {
        labels(subject, definition.value());
        deprecation(fragment, subject, definition.value());
      }
      target.add(fragment);
      if (!(definition.value() instanceof Ontology)) {
        final Resource source = target.createResource(memberIri);
        fragment
            .listStatements(subject, null, (RDFNode) null)
            .toList()
            .forEach(statement -> annotate(target, statement, source));
      }
    } finally {
      fragment.close();
    }
  }

  private static Resource concept(final Model model, final OntologyConcept concept) {
    final Resource subject = model.createResource(concept.getIri().toString());
    if (concept.getConceptType() != OntologyConceptType.SKOS_CONCEPT) {
      subject.addProperty(RDF.type, OWL2.Class);
    }
    if (concept.getConceptType() != OntologyConceptType.OWL_CLASS) {
      OwlEntityDeclarations.declare(model, subject, EntityKind.NAMED_INDIVIDUAL);
      OwlEntityDeclarations.declare(model, SKOS.Concept, EntityKind.CLASS);
      subject.addProperty(RDF.type, SKOS.Concept);
    }
    if (!nullOrEmpty(concept.getSynonyms())) {
      OwlEntityDeclarations.declare(model, SKOS.altLabel, EntityKind.ANNOTATION_PROPERTY);
      concept.getSynonyms().forEach(synonym -> subject.addProperty(SKOS.altLabel, synonym));
    }
    listOrEmpty(concept.getConceptMappings())
        .forEach(
            mapping -> {
              final var predicate = OntologyRdfVocabulary.mapping(mapping.getMappingType());
              OwlEntityDeclarations.declare(model, predicate, EntityKind.OBJECT_PROPERTY);
              OwlEntityDeclarations.declare(model, subject, EntityKind.NAMED_INDIVIDUAL);
              final Resource mapped = model.createResource(mapping.getConceptIri().toString());
              OwlEntityDeclarations.declare(model, mapped, EntityKind.NAMED_INDIVIDUAL);
              subject.addProperty(predicate, mapped);
            });
    if (Boolean.TRUE.equals(concept.getAbstract())) {
      OwlEntityDeclarations.declare(
          model, OntologyRdfVocabulary.ABSTRACT, EntityKind.ANNOTATION_PROPERTY);
      subject.addLiteral(OntologyRdfVocabulary.ABSTRACT, true);
    }
    if (concept.getDefinitionSource() != null) {
      subject.addProperty(
          DCTerms.source, model.createResource(concept.getDefinitionSource().toString()));
    }
    return subject;
  }

  private static void deprecation(
      final Model model, final Resource subject, final OntologyDefinition definition) {
    switch (definition) {
      case OntologyConcept concept -> deprecation(
          model, subject, concept.getDeprecated(), concept.getReplacedBy());
      case OntologyProperty property -> deprecation(
          model, subject, property.getDeprecated(), property.getReplacedBy());
      default -> {}
    }
  }

  private static void deprecation(
      final Model model, final Resource subject, final Boolean deprecated, final URI replacement) {
    if (Boolean.TRUE.equals(deprecated)) {
      subject.addLiteral(OWL2.deprecated, true);
    }
    if (replacement != null) {
      OwlEntityDeclarations.declare(model, DCTerms.isReplacedBy, EntityKind.ANNOTATION_PROPERTY);
      subject.addProperty(DCTerms.isReplacedBy, model.createResource(replacement.toString()));
    }
  }

  private static void labels(final Resource subject, final OntologyDefinition definition) {
    subject.addProperty(
        RDFS.label,
        nullOrEmpty(definition.getDisplayName())
            ? definition.getName()
            : definition.getDisplayName());
    if (!nullOrEmpty(definition.getDescription())) {
      subject.addProperty(RDFS.comment, definition.getDescription());
    }
  }

  private static void annotate(
      final Model model, final Statement statement, final Resource source) {
    model
        .createResource()
        .addProperty(RDF.type, OWL2.Axiom)
        .addProperty(OWL2.annotatedSource, statement.getSubject())
        .addProperty(OWL2.annotatedProperty, statement.getPredicate())
        .addProperty(OWL2.annotatedTarget, statement.getObject())
        .addProperty(DCTerms.source, source);
  }

  private record Definition(OntologyReleaseMember member, OntologyDefinition value) {}
}
