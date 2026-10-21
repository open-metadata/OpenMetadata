package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.jena.vocabulary.OWL2;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.api.data.OntologyReleaseStructureReport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyProfileViolation;
import org.openmetadata.schema.type.OntologyProfileViolationCode;
import org.openmetadata.schema.type.OntologyProfileViolationSeverity;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReferenceRole;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyReleaseStructureIssue;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.service.exception.OntologyValidationException;
import org.openmetadata.service.rdf.OwlEntityDeclarations;

/** Structural and OWL 2 DL checks for the supported authoring model; no logical reasoning. */
public final class OntologyStructureValidator {
  private static final int MAX_FINDINGS = 1000;
  private static final Set<String> INDIVIDUAL_IDENTITY =
      Set.of(OWL2.sameAs.getURI(), OWL2.differentFrom.getURI());
  private static final Set<RelationshipCharacteristic> SIMPLE_ONLY =
      Set.of(
          RelationshipCharacteristic.FUNCTIONAL,
          RelationshipCharacteristic.INVERSE_FUNCTIONAL,
          RelationshipCharacteristic.ASYMMETRIC,
          RelationshipCharacteristic.IRREFLEXIVE);

  private final Map<String, List<OntologyProperty>> properties;
  private final OntologyPropertyHierarchy propertyHierarchy;
  private final OntologyClassHierarchy hierarchy;
  private final List<OntologyReleaseStructureIssue> findings = new ArrayList<>();
  private int violationCount;

  private OntologyStructureValidator(final List<Definition> definitions) {
    hierarchy = new OntologyClassHierarchy(definitions.stream().map(Definition::value).toList());
    properties =
        definitions.stream()
            .map(Definition::value)
            .filter(OntologyProperty.class::isInstance)
            .map(OntologyProperty.class::cast)
            .collect(Collectors.groupingBy(property -> property.getIri().toString()));
    propertyHierarchy =
        new OntologyPropertyHierarchy(properties.values().stream().flatMap(List::stream).toList());
  }

  public static OntologyReleaseStructureReport validate(
      final OntologyRelease release, final List<OntologyReleaseMember> members) {
    OntologyReleaseReader.requireBounds(
        members.size(), members.stream().mapToLong(OntologyReleaseMember::getPayloadBytes).sum());
    final var definitions =
        members.stream()
            .sorted(
                Comparator.comparing(
                        (OntologyReleaseMember member) -> member.getReleaseId().toString())
                    .thenComparing(member -> member.getMemberKind().value())
                    .thenComparing(member -> member.getMemberId().toString()))
            .map(member -> new Definition(member, OntologyReleaseReader.definition(member)))
            .toList();
    final var validator = new OntologyStructureValidator(definitions);
    definitions.forEach(validator::validate);
    return new OntologyReleaseStructureReport()
        .withReleaseId(release.getId())
        .withContentDigest(release.getContentDigest())
        .withValid(validator.violationCount == 0)
        .withViolationCount(validator.violationCount)
        .withViolations(List.copyOf(validator.findings));
  }

  public static void requireValid(
      final OntologyRelease release, final List<OntologyReleaseMember> members) {
    final var report = validate(release, members);
    if (!report.getValid()) {
      throw new OntologyValidationException(report.getViolationCount(), report.getViolations());
    }
  }

  public static void requireValidWorking(final List<OntologyDefinition> values) {
    requireValidWorking(
        values, values.stream().map(OntologyDefinition::getId).collect(Collectors.toSet()));
  }

  public static void requireValidWorking(
      final List<OntologyDefinition> values, final Set<UUID> affected) {
    final var validator = validateWorkingDefinitions(values, affected);
    if (validator.violationCount != 0) {
      throw new OntologyValidationException(validator.violationCount, validator.findings);
    }
  }

  public static OntologyProfileReport validateWorking(final List<OntologyDefinition> values) {
    return validateWorking(
        values, values.stream().map(OntologyDefinition::getId).collect(Collectors.toSet()));
  }

  public static OntologyProfileReport validateWorking(
      final List<OntologyDefinition> values, final Set<UUID> affected) {
    final var validator = validateWorkingDefinitions(values, affected);
    return new OntologyProfileReport()
        .withValid(validator.violationCount == 0)
        .withViolations(
            validator.findings.stream().map(OntologyReleaseStructureIssue::getViolation).toList());
  }

  private static OntologyStructureValidator validateWorkingDefinitions(
      final List<OntologyDefinition> values, final Set<UUID> affected) {
    final var definitions =
        values.stream()
            .map(
                value ->
                    new Definition(
                        new OntologyReleaseMember()
                            .withMemberId(value.getId())
                            .withMemberKind(
                                switch (value) {
                                  case Ontology ontology -> MemberKind.ONTOLOGY;
                                  case OntologyConcept concept -> MemberKind.CONCEPT;
                                  case OntologyProperty property -> MemberKind.PROPERTY;
                                  case OntologyAxiom axiom -> MemberKind.AXIOM;
                                  default -> throw new IllegalArgumentException(
                                      "Unsupported ontology definition");
                                }),
                        value))
            .toList();
    final var validator = new OntologyStructureValidator(definitions);
    definitions.stream()
        .filter(definition -> affected.contains(definition.value().getId()))
        .forEach(validator::validate);
    return validator;
  }

  private void validate(final Definition definition) {
    hierarchy.validate(definition.value(), violation -> add(definition.member(), violation));
    switch (definition.value()) {
      case OntologyProperty property -> validateProperty(definition.member(), property);
      case OntologyAxiom axiom -> validateAxiom(definition.member(), axiom);
      default -> {}
    }
  }

  private void validateAxiom(final OntologyReleaseMember member, final OntologyAxiom axiom) {
    final var guard = new OwlProfileGuard(this::property, propertyHierarchy::isNonSimple);
    final var report = guard.validate(axiom);
    report.getViolations().forEach(violation -> add(member, violation));
    if (report.getValid()) {
      OntologyReferences.collect(axiom).stream()
          .filter(reference -> reference.getRole() == OntologyReferenceRole.PROPERTY)
          .filter(reference -> !isIdentityAssertion(axiom))
          .forEach(reference -> requireProperty(member, reference.getIri(), null, "/propertyIri"));
    }
  }

  private static boolean isIdentityAssertion(final OntologyAxiom axiom) {
    return axiom.getAxiomType() == OntologyAxiomType.OBJECT_PROPERTY_ASSERTION
        && axiom.getPropertyIri() != null
        && INDIVIDUAL_IDENTITY.contains(axiom.getPropertyIri().toString());
  }

  private void validateProperty(
      final OntologyReleaseMember member, final OntologyProperty property) {
    final OntologyProperty vocabulary = vocabularyProperty(property.getIri());
    if ((vocabulary != null && vocabulary.getKind() != property.getKind())
        || INDIVIDUAL_IDENTITY.contains(property.getIri().toString())
        || OWL2.topDataProperty.getURI().equals(property.getIri().toString())
        || (vocabulary == null && OwlEntityDeclarations.isBuiltIn(property.getIri().toString()))) {
      add(
          member,
          OntologyProfileViolationCode.ILLEGAL_PUNNING,
          "/kind",
          "The declaration conflicts with the fixed vocabulary meaning: " + property.getIri());
    }
    if (properties.get(property.getIri().toString()).stream()
            .map(OntologyProperty::getKind)
            .distinct()
            .count()
        > 1) {
      add(
          member,
          OntologyProfileViolationCode.ILLEGAL_PUNNING,
          "/kind",
          "The closure declares incompatible property kinds for " + property.getIri());
    }
    if (property.getInverse() != null) {
      requireProperty(member, property.getInverse(), OntologyPropertyKind.OBJECT, "/inverse");
    }
    listOrEmpty(property.getPropertyChain())
        .forEach(
            iri -> requireProperty(member, iri, OntologyPropertyKind.OBJECT, "/propertyChain"));
    listOrEmpty(property.getDisjointWith())
        .forEach(iri -> requireProperty(member, iri, property.getKind(), "/disjointWith"));
    validateSimplePropertyUse(member, property);
    if (propertyHierarchy.isIrregular(property.getIri())) {
      add(
          member,
          OntologyProfileViolationCode.PROPERTY_CHAIN_REGULARITY,
          "/propertyChain",
          "Property chains and inverses do not admit a regular property order");
    }
  }

  private void validateSimplePropertyUse(
      final OntologyReleaseMember member, final OntologyProperty property) {
    if (propertyHierarchy.isNonSimple(property.getIri())
        && ((!nullOrEmpty(property.getCharacteristics())
                && property.getCharacteristics().stream().anyMatch(SIMPLE_ONLY::contains))
            || !listOrEmpty(property.getDisjointWith()).isEmpty())) {
      add(
          member,
          OntologyProfileViolationCode.NON_SIMPLE_PROPERTY,
          "/characteristics",
          "A non-simple object property cannot be functional, inverse-functional, asymmetric, irreflexive or disjoint");
    }
    listOrEmpty(property.getDisjointWith()).stream()
        .filter(propertyHierarchy::isNonSimple)
        .forEach(
            iri ->
                add(
                    member,
                    OntologyProfileViolationCode.NON_SIMPLE_PROPERTY,
                    "/disjointWith",
                    "Property disjointness requires a simple object property: " + iri));
  }

  private void requireProperty(
      final OntologyReleaseMember member,
      final URI iri,
      final OntologyPropertyKind expected,
      final String path) {
    final OntologyProperty target = property(iri);
    if (target == null) {
      add(
          member,
          OntologyProfileViolationCode.UNDECLARED_PROPERTY,
          path,
          "Declare or import the referenced property: " + iri);
    } else if (expected != null && target.getKind() != expected) {
      add(
          member,
          OntologyProfileViolationCode.ILLEGAL_PUNNING,
          path,
          "The referenced property must have kind " + expected + ": " + iri);
    }
  }

  private OntologyProperty property(final URI iri) {
    final var declarations = properties.get(iri.toString());
    return declarations == null ? vocabularyProperty(iri) : declarations.getFirst();
  }

  private static OntologyProperty vocabularyProperty(final URI iri) {
    final OntologyPropertyKind kind =
        switch (OwlEntityDeclarations.vocabularyKind(iri.toString())) {
          case OBJECT_PROPERTY -> OntologyPropertyKind.OBJECT;
          case DATA_PROPERTY -> OntologyPropertyKind.DATA;
          case ANNOTATION_PROPERTY -> OntologyPropertyKind.ANNOTATION;
          case CLASS, DATATYPE, NAMED_INDIVIDUAL -> null;
          case null -> null;
        };
    return kind == null ? null : new OntologyProperty().withIri(iri).withKind(kind);
  }

  private void add(
      final OntologyReleaseMember member,
      final OntologyProfileViolationCode code,
      final String path,
      final String message) {
    add(
        member,
        new OntologyProfileViolation()
            .withCode(code)
            .withPath(path)
            .withMessage(message)
            .withSeverity(OntologyProfileViolationSeverity.ERROR));
  }

  private void add(final OntologyReleaseMember member, final OntologyProfileViolation violation) {
    violationCount++;
    if (findings.size() < MAX_FINDINGS) {
      findings.add(
          new OntologyReleaseStructureIssue()
              .withReleaseId(member.getReleaseId())
              .withMemberId(member.getMemberId())
              .withMemberKind(member.getMemberKind())
              .withViolation(violation));
    }
  }

  private record Definition(OntologyReleaseMember member, OntologyDefinition value) {}
}
