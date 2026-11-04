package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import org.apache.jena.vocabulary.OWL2;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyProfileViolation;
import org.openmetadata.schema.type.OntologyProfileViolationCode;
import org.openmetadata.schema.type.OntologyProfileViolationSeverity;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.service.rdf.OwlEntityDeclarations;

/** Class roles and named subclass edges over one bounded working model or pinned release closure. */
public final class OntologyClassHierarchy {
  private static final int MAX_EXPRESSION_STEPS = 10_000;
  private static final Set<String> BUILTIN_CLASSES =
      Set.of(OWL2.Thing.getURI(), OWL2.Nothing.getURI());
  private final Map<String, List<OntologyConcept>> concepts;
  private final Map<String, OntologyProperty> properties;
  private final Set<String> cyclicSubjects;

  public OntologyClassHierarchy(final List<? extends OntologyDefinition> definitions) {
    concepts =
        definitions.stream()
            .filter(OntologyConcept.class::isInstance)
            .map(OntologyConcept.class::cast)
            .collect(Collectors.groupingBy(concept -> concept.getIri().toString()));
    properties =
        definitions.stream()
            .filter(OntologyProperty.class::isInstance)
            .map(OntologyProperty.class::cast)
            .collect(
                Collectors.toMap(
                    property -> property.getIri().toString(),
                    property -> property,
                    (first, second) -> first));
    cyclicSubjects = cycleSources(namedEdges(definitions));
  }

  public void validate(
      final OntologyDefinition definition, final Consumer<OntologyProfileViolation> findings) {
    switch (definition) {
      case OntologyConcept concept -> validateConcept(concept, findings);
      case OntologyProperty property -> validateProperty(property, findings);
      case OntologyAxiom axiom -> validateAxiom(axiom, findings);
      default -> {}
    }
  }

  private void validateConcept(
      final OntologyConcept concept, final Consumer<OntologyProfileViolation> findings) {
    if (OwlEntityDeclarations.isBuiltIn(concept.getIri().toString())) {
      add(
          findings,
          OntologyProfileViolationCode.RESERVED_SUBJECT_IRI,
          "/iri",
          "Concept declarations cannot redefine reserved RDF, RDFS, OWL, or XSD vocabulary");
    }
    for (final var mapping : listOrEmpty(concept.getConceptMappings())) {
      if (mapping.getMappingType() == ConceptMapping.ConceptMappingType.SAME_AS
          && (isClass(concept.getIri()) || isClass(mapping.getConceptIri()))) {
        add(
            findings,
            OntologyProfileViolationCode.ILLEGAL_PUNNING,
            "/conceptMappings",
            "Class concepts cannot use individual sameAs mappings; use an equivalence axiom");
      }
    }
  }

  private void validateProperty(
      final OntologyProperty property, final Consumer<OntologyProfileViolation> findings) {
    if (property.getKind() != OntologyPropertyKind.ANNOTATION) {
      listOrEmpty(property.getDomain()).forEach(iri -> requireClass(iri, "/domain", findings));
    }
    if (property.getKind() == OntologyPropertyKind.OBJECT) {
      listOrEmpty(property.getRange()).forEach(iri -> requireClass(iri, "/range", findings));
    } else if (property.getKind() == OntologyPropertyKind.DATA) {
      listOrEmpty(property.getRange()).stream()
          .filter(iri -> !OwlDatatypeSupport.isSupported(iri))
          .forEach(
              iri ->
                  add(
                      findings,
                      OntologyProfileViolationCode.INVALID_EXPRESSION_SHAPE,
                      "/range",
                      "Data property ranges require supported OWL 2 datatypes: " + iri));
      if (listOrEmpty(property.getEnumValues()).stream()
          .anyMatch(value -> !OwlDatatypeSupport.isValidLiteral(value))) {
        add(
            findings,
            OntologyProfileViolationCode.INVALID_EXPRESSION_SHAPE,
            "/enumValues",
            "Enum literals require supported OWL 2 datatypes and valid lexical values");
      }
    }
  }

  private void validateAxiom(
      final OntologyAxiom axiom, final Consumer<OntologyProfileViolation> findings) {
    validateIndividualIdentity(axiom, findings);
    if (isClassAxiom(axiom)) {
      requireClass(axiom.getSubjectIri(), "/subjectIri", findings);
    }
    if (axiom.getAxiomType() == OntologyAxiomType.SUBCLASS_OF
        && axiom.getSubjectIri() != null
        && cyclicSubjects.contains(axiom.getSubjectIri().toString())) {
      add(
          findings,
          OntologyProfileViolationCode.SUBCLASS_CYCLE,
          "/expressions",
          "Named subclass edges contain a cycle at " + axiom.getSubjectIri());
    }
    validateExpressions(axiom.getExpressions(), findings);
  }

  private void validateIndividualIdentity(
      final OntologyAxiom axiom, final Consumer<OntologyProfileViolation> findings) {
    if (axiom.getAxiomType() == OntologyAxiomType.OBJECT_PROPERTY_ASSERTION
        && URI.create(OWL2.sameAs.getURI()).equals(axiom.getPropertyIri())
        && (isClass(axiom.getSubjectIri()) || isClass(axiom.getTargetIri()))) {
      add(
          findings,
          OntologyProfileViolationCode.ILLEGAL_PUNNING,
          isClass(axiom.getSubjectIri()) ? "/subjectIri" : "/targetIri",
          "Class concepts cannot use individual sameAs assertions; use an equivalence axiom");
    }
  }

  private void validateExpressions(
      final List<OntologyExpression> expressions,
      final Consumer<OntologyProfileViolation> findings) {
    final var pending = new ArrayDeque<Expression>();
    listOrEmpty(expressions).forEach(value -> pending.add(new Expression(value, false)));
    int visited = 0;
    while (!pending.isEmpty()) {
      if (++visited > MAX_EXPRESSION_STEPS || pending.size() > MAX_EXPRESSION_STEPS) {
        add(
            findings,
            OntologyProfileViolationCode.INVALID_EXPRESSION_SHAPE,
            "/expressions",
            "Class expression traversal exceeds 10000 steps");
        break;
      }
      validateExpression(pending.removeLast(), pending, findings);
    }
  }

  private void validateExpression(
      final Expression current,
      final ArrayDeque<Expression> pending,
      final Consumer<OntologyProfileViolation> findings) {
    final OntologyExpression value = current.value();
    if (value == null) {
      return;
    }
    if (value.getKind() == OntologyExpressionKind.NAMED_CLASS && !current.datatype()) {
      requireClass(value.getClassIri(), "/expressions/classIri", findings);
    }
    listOrEmpty(value.getOperands())
        .forEach(operand -> pending.add(new Expression(operand, current.datatype())));
    if (value.getFiller() != null) {
      pending.add(new Expression(value.getFiller(), isDataProperty(value.getPropertyIri())));
    }
  }

  private boolean isDataProperty(final URI iri) {
    final OntologyProperty property = iri == null ? null : properties.get(iri.toString());
    return property != null
        ? property.getKind() == OntologyPropertyKind.DATA
        : iri != null
            && OwlEntityDeclarations.vocabularyKind(iri.toString())
                == OwlEntityDeclarations.EntityKind.DATA_PROPERTY;
  }

  private void requireClass(
      final URI iri, final String path, final Consumer<OntologyProfileViolation> findings) {
    if (iri != null && !isClass(iri)) {
      final boolean declared = concepts.containsKey(iri.toString());
      add(
          findings,
          declared
              ? OntologyProfileViolationCode.INVALID_CLASS_KIND
              : OntologyProfileViolationCode.UNDECLARED_CLASS,
          path,
          declared
              ? "Class references require OWL_CLASS or BOTH: " + iri
              : "Declare or import the referenced class: " + iri);
    }
  }

  private boolean isClass(final URI iri) {
    return iri != null
        && (BUILTIN_CLASSES.contains(iri.toString())
            || OwlEntityDeclarations.vocabularyKind(iri.toString())
                == OwlEntityDeclarations.EntityKind.CLASS
            || concepts.getOrDefault(iri.toString(), List.of()).stream()
                .anyMatch(
                    concept ->
                        concept.getConceptType() == OntologyConceptType.OWL_CLASS
                            || concept.getConceptType() == OntologyConceptType.BOTH));
  }

  private static boolean isClassAxiom(final OntologyAxiom axiom) {
    return axiom.getAxiomType() == OntologyAxiomType.SUBCLASS_OF
        || axiom.getAxiomType() == OntologyAxiomType.EQUIVALENT_CLASS
        || axiom.getAxiomType() == OntologyAxiomType.DISJOINT_WITH;
  }

  public static List<URI> namedParents(final OntologyAxiom axiom) {
    return axiom.getAxiomType() != OntologyAxiomType.SUBCLASS_OF
        ? List.of()
        : listOrEmpty(axiom.getExpressions()).stream()
            .filter(
                expression ->
                    expression != null
                        && expression.getKind() == OntologyExpressionKind.NAMED_CLASS
                        && expression.getClassIri() != null)
            .map(OntologyExpression::getClassIri)
            .toList();
  }

  private static Map<String, Set<String>> namedEdges(
      final List<? extends OntologyDefinition> definitions) {
    final Map<String, Set<String>> edges = new HashMap<>();
    definitions.stream()
        .filter(OntologyAxiom.class::isInstance)
        .map(OntologyAxiom.class::cast)
        .filter(axiom -> axiom.getSubjectIri() != null)
        .forEach(
            axiom ->
                namedParents(axiom)
                    .forEach(
                        parent ->
                            edges
                                .computeIfAbsent(
                                    axiom.getSubjectIri().toString(), ignored -> new HashSet<>())
                                .add(parent.toString())));
    return edges;
  }

  static Set<String> cycleSources(final Map<String, Set<String>> edges) {
    final Set<String> visited = new HashSet<>();
    final var finished = new ArrayDeque<String>();
    edges.keySet().forEach(root -> finishTraversal(root, edges, visited, finished));
    final Map<String, Set<String>> reverse = new HashMap<>();
    edges.forEach(
        (source, targets) ->
            targets.forEach(
                target -> reverse.computeIfAbsent(target, ignored -> new HashSet<>()).add(source)));
    visited.clear();
    final Set<String> cyclic = new HashSet<>();
    while (!finished.isEmpty()) {
      final String root = finished.removeLast();
      final Set<String> component = component(root, reverse, visited);
      if (component.size() > 1 || edges.getOrDefault(root, Set.of()).contains(root)) {
        cyclic.addAll(component);
      }
    }
    return Set.copyOf(cyclic);
  }

  private static void finishTraversal(
      final String root,
      final Map<String, Set<String>> edges,
      final Set<String> visited,
      final ArrayDeque<String> finished) {
    final var pending = new ArrayDeque<Traversal>();
    if (visited.add(root)) {
      pending.add(new Traversal(root, edges.getOrDefault(root, Set.of()).iterator()));
    }
    while (!pending.isEmpty()) {
      final Traversal current = pending.getLast();
      if (!current.targets().hasNext()) {
        finished.add(pending.removeLast().source());
      } else {
        final String target = current.targets().next();
        if (visited.add(target)) {
          pending.add(new Traversal(target, edges.getOrDefault(target, Set.of()).iterator()));
        }
      }
    }
  }

  private static Set<String> component(
      final String root, final Map<String, Set<String>> edges, final Set<String> visited) {
    final Set<String> component = new HashSet<>();
    final var pending = new ArrayDeque<String>();
    pending.add(root);
    while (!pending.isEmpty()) {
      final String current = pending.removeLast();
      if (visited.add(current)) {
        component.add(current);
        pending.addAll(edges.getOrDefault(current, Set.of()));
      }
    }
    return component;
  }

  private static void add(
      final Consumer<OntologyProfileViolation> findings,
      final OntologyProfileViolationCode code,
      final String path,
      final String message) {
    findings.accept(
        new OntologyProfileViolation()
            .withCode(code)
            .withPath(path)
            .withSeverity(OntologyProfileViolationSeverity.ERROR)
            .withMessage(message));
  }

  private record Expression(OntologyExpression value, boolean datatype) {}

  private record Traversal(String source, Iterator<String> targets) {}
}
