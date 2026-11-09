package org.openmetadata.service.rdf;

import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Pattern;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.vocabulary.DCTerms;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.apache.jena.vocabulary.XSD;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.NativeOntologyImportSkipReason;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.ontology.OntologyPropertyRules;
import org.openmetadata.service.ontology.OwlDatatypeSupport;
import org.openmetadata.service.rdf.OntologyExpressionRdfReader.UnsupportedExpressionException;

/**
 * Reads the native definitions out of one RDF model. A native export reads back whole. A
 * real-world OWL, RDFS, or SKOS file is narrowed to what the native model holds: statements it
 * cannot hold are skipped and counted in the document's report, while a malformed expression
 * still fails the read.
 */
final class NativeOntologyRdfReader {
  private static final String NATIVE_ENUMERATION_PATTERN = ":PROPERTY:[0-9a-fA-F-]{36}:values";
  private static final int MAX_LIST_CELLS = 10_000;
  private static final List<OntologyPropertyKind> PROPERTY_PRECEDENCE =
      List.of(
          OntologyPropertyKind.OBJECT, OntologyPropertyKind.DATA, OntologyPropertyKind.ANNOTATION);
  private static final Set<Resource> DEFINITION_TYPES =
      Set.of(
          OWL2.Class,
          RDFS.Class,
          SKOS.Concept,
          OWL2.ObjectProperty,
          OWL2.DatatypeProperty,
          OWL2.AnnotationProperty,
          RDF.Property,
          RDFS.Datatype);
  private static final Set<String> ANNOTATION_VOCABULARY =
      Set.of(
          RDFS.label.getURI(),
          RDFS.comment.getURI(),
          RDFS.seeAlso.getURI(),
          RDFS.isDefinedBy.getURI(),
          OWL2.versionInfo.getURI(),
          OWL2.priorVersion.getURI(),
          OWL2.backwardCompatibleWith.getURI(),
          OWL2.incompatibleWith.getURI(),
          OWL2.deprecated.getURI());
  private static final List<String> STRUCTURAL_NAMESPACES =
      List.of(RDF.getURI(), RDFS.getURI(), OWL2.getURI(), "http://www.w3.org/ns/shacl#");
  private static final Pattern SCHEMA_ORG_INCLUDES =
      Pattern.compile("https?://schema\\.org/(domain|range)Includes");

  private final Model model;
  private final Set<Statement> remaining;
  private final OntologyExpressionRdfReader expressions;
  private final Map<Statement, List<String>> sources = new HashMap<>();
  private final RdfSkipLedger ledger = new RdfSkipLedger();
  private boolean nativeExport;
  private String versionIri;
  private NativeOntologyDocument.Header header;

  NativeOntologyRdfReader(final Model source) {
    model = ModelFactory.createDefaultModel().add(source);
    RdfSourceNormalizer.normalize(model, ledger);
    remaining = new LinkedHashSet<>(model.listStatements().toList());
    expressions = new OntologyExpressionRdfReader(model, remaining);
  }

  NativeOntologyDocument read() {
    try {
      headers();
      annotations();
      individuals();
      final List<OntologyConcept> concepts = concepts();
      final List<OntologyProperty> properties = properties();
      final List<OntologyAxiom> axioms = axioms(properties);
      references();
      skipRemaining();
      return new NativeOntologyDocument(header, concepts, properties, axioms, ledger.report());
    } finally {
      model.close();
    }
  }

  private void headers() {
    final List<Resource> declared =
        model.listSubjectsWithProperty(RDF.type, OWL2.Ontology).toList();
    final NativeOntologyDocument.Header scheme = conceptScheme();
    header = declared.isEmpty() ? scheme : null;
    for (final Resource subject : declared) {
      expressions.takeType(subject, OWL2.Ontology);
      final NativeOntologyDocument.Header parsed =
          new NativeOntologyDocument.Header(
              subject.isURIResource() ? URI.create(subject.getURI()) : null,
              text(subject, RDFS.label),
              text(subject, RDFS.comment));
      header = declared.size() == 1 ? parsed : null;
      final RDFNode version = expressions.one(subject, OWL2.versionIRI);
      if (version != null) {
        versionIri = OntologyExpressionRdfReader.iri(version).toString();
      }
    }
  }

  /**
   * A SKOS export states its title on a concept scheme. The scheme names the source the way an
   * ontology header does, and each concept's {@code skos:inScheme} only repeats that membership.
   */
  private NativeOntologyDocument.Header conceptScheme() {
    final List<Resource> schemes =
        model.listSubjectsWithProperty(RDF.type, SKOS.ConceptScheme).toList();
    NativeOntologyDocument.Header parsed = null;
    for (final Resource scheme : schemes) {
      expressions.takeType(scheme, SKOS.ConceptScheme);
      final String label = firstText(scheme, SKOS.prefLabel, RDFS.label);
      final String description = firstText(scheme, SKOS.definition, RDFS.comment);
      parsed =
          new NativeOntologyDocument.Header(
              scheme.isURIResource() ? URI.create(scheme.getURI()) : null, label, description);
      takeAll(scheme, SKOS.hasTopConcept);
      model.listStatements(null, SKOS.inScheme, scheme).toList().forEach(remaining::remove);
    }
    return schemes.size() == 1 ? parsed : null;
  }

  private String firstText(
      final Resource subject, final Property preferred, final Property fallback) {
    final String value = text(subject, preferred);
    final String other = text(subject, fallback);
    return value == null ? other : value;
  }

  private void annotations() {
    for (final Resource annotation :
        model.listSubjectsWithProperty(RDF.type, OWL2.Axiom).toList()) {
      expressions.takeType(annotation, OWL2.Axiom);
      final Resource source =
          resource(
              expressions.require(annotation, OWL2.annotatedSource),
              "RDF axiom source must be a resource");
      final URI predicate =
          OntologyExpressionRdfReader.iri(expressions.require(annotation, OWL2.annotatedProperty));
      final RDFNode target = expressions.require(annotation, OWL2.annotatedTarget);
      final Statement base =
          model.createStatement(source, model.createProperty(predicate.toString()), target);
      if (model.contains(base)) {
        recordAxiomSource(annotation, base);
      } else {
        skipAnnotationOfUnassertedTriple(annotation);
      }
    }
  }

  private void recordAxiomSource(final Resource annotation, final Statement base) {
    final RDFNode hint = expressions.one(annotation, DCTerms.source);
    if (hint != null) {
      final String hintIri = OntologyExpressionRdfReader.iri(hint).toString();
      sources.computeIfAbsent(base, ignored -> new ArrayList<>()).add(hintIri);
      nativeExport |= versionIri != null && hintIri.startsWith(versionIri + ":");
    }
  }

  /**
   * OWL reification may annotate a triple the file only implies. The annotation then describes
   * nothing the native model holds, so it is skipped with the rest of its node.
   */
  private void skipAnnotationOfUnassertedTriple(final Resource annotation) {
    ledger.skip(
        NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE,
        model.createStatement(annotation, RDF.type, OWL2.Axiom));
    consumeBlank(annotation);
  }

  /** A native model has no individuals, so a source's named individuals are left out. */
  private void individuals() {
    if (nativeExport) {
      return;
    }
    for (final Resource subject :
        model.listSubjectsWithProperty(RDF.type, OWL2.NamedIndividual).toList()) {
      if (subject.isURIResource() && !declaresDefinition(subject)) {
        for (final Statement statement :
            model.listStatements(subject, null, (RDFNode) null).toList()) {
          if (remaining.remove(statement)) {
            ledger.skipIndividual(statement);
            consumeBlank(statement.getObject());
          }
        }
      }
    }
  }

  private boolean declaresDefinition(final Resource subject) {
    return DEFINITION_TYPES.stream().anyMatch(type -> model.contains(subject, RDF.type, type));
  }

  private List<OntologyConcept> concepts() {
    final Set<Resource> subjects = new LinkedHashSet<>();
    for (final Resource type : List.of(OWL2.Class, RDFS.Class, SKOS.Concept)) {
      subjects.addAll(model.listSubjectsWithProperty(RDF.type, type).toList());
    }
    final List<OntologyConcept> parsed = new ArrayList<>();
    for (final Resource subject : subjects) {
      if (isDefinable(subject)) {
        parsed.add(concept(subject));
      }
    }
    return parsed;
  }

  private boolean isDefinable(final Resource subject) {
    return subject.isURIResource()
        && !OwlEntityDeclarations.isReservedVocabulary(subject.getURI())
        && !(nativeExport && !model.contains(subject, RDFS.label) && referenced(subject));
  }

  private OntologyConcept concept(final Resource subject) {
    final boolean owl = takeClassTypes(subject);
    final boolean skos = expressions.takeType(subject, SKOS.Concept);
    expressions.takeType(subject, OWL2.NamedIndividual);
    final OntologyConcept concept =
        new OntologyConcept()
            .withIri(URI.create(subject.getURI()))
            .withConceptType(
                owl && skos
                    ? OntologyConceptType.BOTH
                    : owl ? OntologyConceptType.OWL_CLASS : OntologyConceptType.SKOS_CONCEPT)
            .withDisplayName(conceptText(subject, SKOS.prefLabel, RDFS.label))
            .withDescription(conceptText(subject, SKOS.definition, RDFS.comment))
            .withAbstract(flag(subject, OntologyRdfVocabulary.ABSTRACT))
            .withDefinitionSource(annotationIri(subject, DCTerms.source))
            .withDeprecated(flag(subject, OWL2.deprecated))
            .withReplacedBy(annotationIri(subject, DCTerms.isReplacedBy));
    final Set<String> synonyms = new LinkedHashSet<>();
    for (final RDFNode synonym : takeAll(subject, SKOS.altLabel)) {
      synonyms.add(string(synonym));
    }
    return concept.withSynonyms(synonyms).withConceptMappings(mappings(subject));
  }

  private boolean takeClassTypes(final Resource subject) {
    final boolean owl = expressions.takeType(subject, OWL2.Class);
    final boolean rdfs = expressions.takeType(subject, RDFS.Class);
    return owl || rdfs;
  }

  private List<ConceptMapping> mappings(final Resource subject) {
    final List<ConceptMapping> mappings = new ArrayList<>();
    for (final var kind : ConceptMapping.ConceptMappingType.values()) {
      for (final Statement statement :
          takeAllStatements(subject, OntologyRdfVocabulary.mapping(kind))) {
        final URI target = annotationTarget(statement);
        if (target != null) {
          mappings.add(new ConceptMapping().withMappingType(kind).withConceptIri(target));
        }
      }
    }
    return mappings;
  }

  private List<OntologyProperty> properties() {
    final List<OntologyProperty> parsed = new ArrayList<>();
    final Set<Resource> declared = new HashSet<>();
    for (final OntologyPropertyKind kind : PROPERTY_PRECEDENCE) {
      for (final Resource subject :
          model.listSubjectsWithProperty(RDF.type, declarationType(kind)).toList()) {
        if (declared.add(subject)) {
          addIfDefinable(parsed, subject, kind);
        }
      }
    }
    for (final Resource subject : model.listSubjectsWithProperty(RDF.type, RDF.Property).toList()) {
      if (declared.add(subject)) {
        addIfDefinable(parsed, subject, kindByRange(subject));
      }
    }
    NativeOntologyDocument.linkInverses(parsed);
    return parsed;
  }

  private static Resource declarationType(final OntologyPropertyKind kind) {
    return switch (kind) {
      case OBJECT -> OWL2.ObjectProperty;
      case DATA -> OWL2.DatatypeProperty;
      case ANNOTATION -> OWL2.AnnotationProperty;
    };
  }

  /** A property declared as several kinds is one definition, with the most specific kind winning. */
  private void addIfDefinable(
      final List<OntologyProperty> parsed,
      final Resource subject,
      final OntologyPropertyKind kind) {
    if (isDefinable(subject) && !OntologyRdfVocabulary.ANNOTATIONS.contains(subject)) {
      for (final OntologyPropertyKind declaredKind : PROPERTY_PRECEDENCE) {
        expressions.takeType(subject, declarationType(declaredKind));
      }
      expressions.takeType(subject, RDF.Property);
      parsed.add(property(subject, kind));
    }
  }

  /** A plain {@code rdf:Property} is a data property when its range is a datatype, else an object property. */
  private OntologyPropertyKind kindByRange(final Resource subject) {
    final boolean datatype =
        model.listObjectsOfProperty(subject, RDFS.range).toList().stream()
            .anyMatch(this::isDatatype);
    return datatype ? OntologyPropertyKind.DATA : OntologyPropertyKind.OBJECT;
  }

  private boolean isDatatype(final RDFNode range) {
    final boolean named =
        range.isURIResource()
            && (range.asResource().getURI().startsWith(XSD.NS)
                || RDFS.Literal.equals(range)
                || RDFS.Datatype.equals(range));
    return named
        || (range.isResource() && model.contains(range.asResource(), RDF.type, RDFS.Datatype));
  }

  private OntologyProperty property(final Resource subject, final OntologyPropertyKind kind) {
    final OntologyProperty property =
        new OntologyProperty()
            .withIri(URI.create(subject.getURI()))
            .withKind(kind)
            .withDisplayName(conceptText(subject, SKOS.prefLabel, RDFS.label))
            .withDescription(conceptText(subject, SKOS.definition, RDFS.comment))
            .withDomain(domain(subject))
            .withInverse(
                kind == OntologyPropertyKind.OBJECT ? structuralIri(subject, OWL2.inverseOf) : null)
            .withDisjointWith(
                kind == OntologyPropertyKind.ANNOTATION
                    ? List.of()
                    : iris(subject, OWL2.propertyDisjointWith))
            .withSuperProperties(superProperties(subject))
            .withUnit(text(subject, OntologyRdfVocabulary.UNIT))
            .withDeprecated(flag(subject, OWL2.deprecated))
            .withReplacedBy(annotationIri(subject, DCTerms.isReplacedBy));
    final RDFNode identifier = expressions.one(subject, OntologyRdfVocabulary.IDENTIFIER_INTENT);
    property.withIsIdentifier(identifier != null && booleanValue(identifier));
    property.withCharacteristics(characteristics(subject, kind));
    property.withPropertyChain(
        kind == OntologyPropertyKind.OBJECT ? propertyChain(subject) : List.of());
    final Ranges ranges = ranges(subject, kind);
    return property.withRange(ranges.iris()).withEnumValues(ranges.enumeration());
  }

  /** A characteristic the kind cannot carry stays unread, so it is reported instead of refused. */
  private Set<RelationshipCharacteristic> characteristics(
      final Resource subject, final OntologyPropertyKind kind) {
    final Set<RelationshipCharacteristic> characteristics = new LinkedHashSet<>();
    for (final RelationshipCharacteristic characteristic :
        OntologyPropertyRules.allowedCharacteristics(kind)) {
      if (expressions.takeType(subject, OntologyRdfVocabulary.characteristic(characteristic))) {
        characteristics.add(characteristic);
      }
    }
    return characteristics;
  }

  /** Several {@code rdfs:domain} statements are an intersection, which is also how the list reads back. */
  private List<URI> domain(final Resource subject) {
    return iris(subject, RDFS.domain);
  }

  /**
   * Named superproperties are kept whether or not the source declares them; the importer drops a
   * link to a property its target cannot resolve. A property is trivially its own subproperty, so
   * that statement is skipped rather than stored.
   */
  private List<URI> superProperties(final Resource subject) {
    final List<URI> supers = new ArrayList<>(iris(subject, RDFS.subPropertyOf));
    if (supers.remove(URI.create(subject.getURI()))) {
      ledger.skip(
          NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE,
          model.createStatement(subject, RDFS.subPropertyOf, subject));
    }
    return List.copyOf(supers);
  }

  /** Several chains are separate axioms; the lexicographically first usable one is kept. */
  private List<URI> propertyChain(final Resource subject) {
    final Map<String, List<URI>> usable = new TreeMap<>();
    for (final Statement statement : takeAllStatements(subject, OWL2.propertyChainAxiom)) {
      final List<RDFNode> items = expressions.list(statement.getObject(), 0);
      if (items.size() > 1 && items.stream().allMatch(NativeOntologyRdfReader::isAbsoluteIri)) {
        final List<URI> chain = items.stream().map(OntologyExpressionRdfReader::iri).toList();
        usable.putIfAbsent(chain.toString(), chain);
        consumeBlank(statement.getObject());
      } else {
        skipStatement(NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE, statement);
      }
    }
    return keepFirstChain(subject, usable);
  }

  private List<URI> keepFirstChain(final Resource subject, final Map<String, List<URI>> usable) {
    usable.values().stream()
        .skip(1)
        .forEach(
            extra ->
                ledger.skip(
                    NativeOntologyImportSkipReason.EXTRA_VALUE,
                    model.createStatement(subject, OWL2.propertyChainAxiom, RDF.nil)));
    return usable.isEmpty() ? List.of() : usable.values().iterator().next();
  }

  private record Ranges(List<URI> iris, List<OntologyLiteral> enumeration) {}

  private Ranges ranges(final Resource subject, final OntologyPropertyKind kind) {
    final Set<URI> iris = new LinkedHashSet<>();
    final List<OntologyLiteral> enums = new ArrayList<>();
    for (final Statement statement : takeAllStatements(subject, RDFS.range)) {
      final Resource enumeration = enumerationOf(statement.getObject());
      if (enumeration != null && hasLiteralItems(enumeration)) {
        readEnumeration(statement, enumeration, enums, kind);
      } else if (isUsableRange(statement.getObject(), kind)) {
        iris.add(URI.create(statement.getResource().getURI()));
      } else {
        skipStatement(NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE, statement);
      }
    }
    return new Ranges(List.copyOf(iris), enums);
  }

  private static boolean isUsableRange(final RDFNode range, final OntologyPropertyKind kind) {
    return isAbsoluteIri(range)
        && (kind != OntologyPropertyKind.DATA
            || OwlDatatypeSupport.isSupported(URI.create(range.asResource().getURI())));
  }

  /** The node that carries {@code owl:oneOf} for a range, directly or through {@code owl:equivalentClass}. */
  private Resource enumerationOf(final RDFNode range) {
    Resource enumeration = null;
    if (range.isResource()) {
      final Resource value = range.asResource();
      if (model.contains(value, OWL2.oneOf)) {
        enumeration = value;
      } else {
        enumeration =
            model.listObjectsOfProperty(value, OWL2.equivalentClass).toList().stream()
                .filter(RDFNode::isResource)
                .map(RDFNode::asResource)
                .filter(candidate -> model.contains(candidate, OWL2.oneOf))
                .findFirst()
                .orElse(null);
      }
    }
    return enumeration;
  }

  private boolean hasLiteralItems(final Resource enumeration) {
    boolean literals = true;
    int cells = 0;
    final List<RDFNode> heads = model.listObjectsOfProperty(enumeration, OWL2.oneOf).toList();
    Resource cursor =
        heads.size() == 1 && heads.getFirst().isResource() ? heads.getFirst().asResource() : null;
    while (cursor != null && !RDF.nil.equals(cursor) && cells++ < MAX_LIST_CELLS) {
      final RDFNode item =
          model.getProperty(cursor, RDF.first) == null
              ? null
              : model.getProperty(cursor, RDF.first).getObject();
      literals &= item != null && item.isLiteral();
      final Statement rest = model.getProperty(cursor, RDF.rest);
      cursor = rest != null && rest.getObject().isResource() ? rest.getResource() : null;
    }
    return literals && cells > 0 && cells < MAX_LIST_CELLS;
  }

  /**
   * A data enumeration stands in for an anonymous or generated datatype. A source's own named
   * datatype cannot keep its IRI, so the range statement is skipped instead of renamed.
   */
  private void readEnumeration(
      final Statement range,
      final Resource enumeration,
      final List<OntologyLiteral> enums,
      final OntologyPropertyKind kind) {
    final Resource value = range.getResource();
    if (kind != OntologyPropertyKind.DATA
        || (value.isURIResource() && !isNativeEnumerationName(value))) {
      skipStatement(NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE, range);
      return;
    }
    if (value.isURIResource()) {
      expressions.takeType(value, RDFS.Datatype);
    }
    if (!enumeration.equals(value)) {
      expressions.require(value, OWL2.equivalentClass);
    }
    expressions.takeType(enumeration, RDFS.Datatype);
    final List<OntologyLiteral> values = new ArrayList<>();
    for (final RDFNode item : expressions.list(expressions.require(enumeration, OWL2.oneOf), 0)) {
      values.add(OntologyExpressionRdfReader.literal(item.asLiteral()));
    }
    if (isStorableEnumeration(values)) {
      enums.addAll(values);
    } else {
      ledger.skip(NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE, range);
    }
  }

  /** The native rules for an enumeration: two to {@code MAX_ENUM_VALUES} distinct, valid literals. */
  private static boolean isStorableEnumeration(final List<OntologyLiteral> values) {
    return values.size() > 1
        && values.size() <= OntologyPropertyRules.MAX_ENUM_VALUES
        && values.stream().map(JsonUtils::pojoToJson).distinct().count() == values.size()
        && values.stream().allMatch(OwlDatatypeSupport::isValidLiteral);
  }

  private boolean isNativeEnumerationName(final Resource value) {
    return nativeExport
        && versionIri != null
        && value.getURI().matches(Pattern.quote(versionIri) + NATIVE_ENUMERATION_PATTERN);
  }

  private List<OntologyAxiom> axioms(final List<OntologyProperty> properties) {
    final Map<String, OntologyAxiom> grouped = new LinkedHashMap<>();
    final Map<String, OntologyPropertyKind> kinds = propertyKinds(properties);
    for (final Statement statement : List.copyOf(remaining)) {
      if (remaining.contains(statement) && statement.getSubject().isURIResource()) {
        final OntologyAxiomType type = axiomType(statement, kinds);
        final Operand operand = type == null ? null : operand(statement, type);
        if (operand != null) {
          remaining.remove(statement);
          addAxiom(grouped, statement, type, operand);
        }
      }
    }
    return List.copyOf(grouped.values());
  }

  private Map<String, OntologyPropertyKind> propertyKinds(final List<OntologyProperty> properties) {
    final Map<String, OntologyPropertyKind> kinds = new HashMap<>();
    model
        .listSubjectsWithProperty(RDF.type, OWL2.ObjectProperty)
        .forEachRemaining(property -> kinds.put(property.getURI(), OntologyPropertyKind.OBJECT));
    model
        .listSubjectsWithProperty(RDF.type, OWL2.DatatypeProperty)
        .forEachRemaining(property -> kinds.put(property.getURI(), OntologyPropertyKind.DATA));
    properties.forEach(property -> kinds.put(property.getIri().toString(), property.getKind()));
    return kinds;
  }

  private OntologyAxiomType axiomType(
      final Statement statement, final Map<String, OntologyPropertyKind> kinds) {
    final Property predicate = statement.getPredicate();
    final OntologyPropertyKind propertyKind = assertionPropertyKind(predicate.getURI(), kinds);
    return predicate.equals(RDFS.subClassOf)
        ? OntologyAxiomType.SUBCLASS_OF
        : predicate.equals(OWL2.equivalentClass)
            ? OntologyAxiomType.EQUIVALENT_CLASS
            : predicate.equals(OWL2.disjointWith)
                ? OntologyAxiomType.DISJOINT_WITH
                : predicate.equals(RDF.type) && isClassExpression(statement.getObject())
                    ? OntologyAxiomType.CLASS_ASSERTION
                    : propertyKind == OntologyPropertyKind.OBJECT
                        ? OntologyAxiomType.OBJECT_PROPERTY_ASSERTION
                        : propertyKind == OntologyPropertyKind.DATA
                            ? OntologyAxiomType.DATA_PROPERTY_ASSERTION
                            : null;
  }

  /** What one asserted statement says about its subject, read once so a skipped statement leaves no axiom. */
  private record Operand(OntologyExpression expression, URI target, OntologyLiteral literal) {}

  private Operand operand(final Statement statement, final OntologyAxiomType type) {
    Operand operand = null;
    try {
      operand =
          switch (type) {
            case OBJECT_PROPERTY_ASSERTION -> objectOperand(statement);
            case DATA_PROPERTY_ASSERTION -> dataOperand(statement);
            default -> new Operand(expressions.read(statement.getObject()), null, null);
          };
    } catch (UnsupportedExpressionException unsupported) {
      skipStatement(NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE, statement);
    }
    return operand;
  }

  private Operand objectOperand(final Statement statement) {
    final boolean assertable = isAbsoluteIri(statement.getObject());
    if (!assertable) {
      skipStatement(NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE, statement);
    }
    return assertable
        ? new Operand(null, OntologyExpressionRdfReader.iri(statement.getObject()), null)
        : null;
  }

  private Operand dataOperand(final Statement statement) {
    final RDFNode object = statement.getObject();
    final OntologyLiteral literal =
        object.isLiteral() && object.asLiteral().getLanguage().isEmpty()
            ? OntologyExpressionRdfReader.literal(object.asLiteral())
            : null;
    // Applying an assertion refuses a datatype outside OWL 2, such as a vocabulary's own `gs1:AI`.
    if (literal == null || !OwlDatatypeSupport.isValidLiteral(literal)) {
      skipStatement(NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE, statement);
      return null;
    }
    return new Operand(null, null, literal);
  }

  private void addAxiom(
      final Map<String, OntologyAxiom> grouped,
      final Statement statement,
      final OntologyAxiomType type,
      final Operand operand) {
    final List<String> hints = sources.getOrDefault(statement, List.of(statement.toString()));
    for (final String hint : hints) {
      final String key =
          type
              + ":"
              + statement.getSubject().getURI()
              + ":"
              + hint
              + (isAssertion(type) ? ":" + statement : "");
      final OntologyAxiom axiom =
          grouped.computeIfAbsent(
              key,
              ignored ->
                  new OntologyAxiom()
                      .withAxiomType(type)
                      .withSubjectIri(URI.create(statement.getSubject().getURI()))
                      .withExpressions(new ArrayList<>()));
      fill(axiom, statement, operand);
    }
  }

  private static boolean isAssertion(final OntologyAxiomType type) {
    return type == OntologyAxiomType.OBJECT_PROPERTY_ASSERTION
        || type == OntologyAxiomType.DATA_PROPERTY_ASSERTION
        || type == OntologyAxiomType.CLASS_ASSERTION;
  }

  private static void fill(
      final OntologyAxiom axiom, final Statement statement, final Operand operand) {
    final URI predicate = URI.create(statement.getPredicate().getURI());
    switch (axiom.getAxiomType()) {
      case SUBCLASS_OF, EQUIVALENT_CLASS, DISJOINT_WITH, CLASS_ASSERTION -> axiom
          .getExpressions()
          .add(operand.expression());
      case OBJECT_PROPERTY_ASSERTION -> axiom
          .withPropertyIri(predicate)
          .withTargetIri(operand.target());
      case DATA_PROPERTY_ASSERTION -> axiom
          .withPropertyIri(predicate)
          .withLiteral(operand.literal());
    }
  }

  private static OntologyPropertyKind assertionPropertyKind(
      final String iri, final Map<String, OntologyPropertyKind> kinds) {
    return switch (OwlEntityDeclarations.vocabularyKind(iri)) {
      case OBJECT_PROPERTY -> OntologyPropertyKind.OBJECT;
      case DATA_PROPERTY -> OntologyPropertyKind.DATA;
      case null -> kinds.get(iri);
      default -> null;
    };
  }

  private boolean isClassExpression(final RDFNode node) {
    return node.isAnon()
        || (node.isURIResource()
            && (model.contains(node.asResource(), RDF.type, OWL2.Class)
                || model.contains(node.asResource(), RDF.type, SKOS.Concept)
                || OwlEntityDeclarations.vocabularyKind(node.asResource().getURI())
                    == OwlEntityDeclarations.EntityKind.CLASS));
  }

  private void references() {
    for (final Statement statement : List.copyOf(remaining)) {
      if (!statement.getPredicate().equals(RDF.type)
          || !statement.getSubject().isURIResource()
          || !statement.getObject().isURIResource()) {
        continue;
      }
      final Resource type = statement.getResource();
      if ((OwlEntityDeclarations.isReservedVocabulary(statement.getSubject().getURI())
              || OntologyRdfVocabulary.ANNOTATIONS.contains(statement.getSubject())
              || referenced(statement.getSubject())
              || usedAsPredicate(statement.getSubject())
              || usedAsAssertionSubject(statement.getSubject()))
          && Set.of(
                  OWL2.Class,
                  OWL2.NamedIndividual,
                  OWL2.ObjectProperty,
                  OWL2.DatatypeProperty,
                  OWL2.AnnotationProperty,
                  RDFS.Datatype)
              .contains(type)) {
        remaining.remove(statement);
      }
    }
  }

  /**
   * Whatever no definition or axiom consumed is outside the native model. Statements about named
   * resources go first so that each takes the blank-node structure hanging off it. Blank nodes no
   * other leftover reaches follow, so that a list or restriction is counted from its head whatever
   * order the parser produced; only the nodes inside a blank-node cycle are left to statement order.
   */
  private void skipRemaining() {
    final List<Statement> leftovers = List.copyOf(remaining);
    for (final Statement statement : leftovers) {
      if (statement.getSubject().isURIResource() && remaining.contains(statement)) {
        skipStatement(reasonFor(statement), statement);
      }
    }
    final Set<Resource> reached = new HashSet<>();
    for (final Statement statement : leftovers) {
      if (statement.getObject().isAnon()) {
        reached.add(statement.getObject().asResource());
      }
    }
    for (final Statement statement : leftovers) {
      if (!reached.contains(statement.getSubject()) && remaining.contains(statement)) {
        skipStatement(reasonFor(statement), statement);
      }
    }
    for (final Statement statement : leftovers) {
      if (remaining.contains(statement)) {
        skipStatement(reasonFor(statement), statement);
      }
    }
  }

  private static NativeOntologyImportSkipReason reasonFor(final Statement statement) {
    final String predicate = statement.getPredicate().getURI();
    final boolean structural =
        statement.getObject().isAnon()
            || statement.getPredicate().equals(RDF.type)
            || SCHEMA_ORG_INCLUDES.matcher(predicate).matches()
            || (!ANNOTATION_VOCABULARY.contains(predicate)
                && STRUCTURAL_NAMESPACES.stream().anyMatch(predicate::startsWith));
    return structural
        ? NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE
        : NativeOntologyImportSkipReason.UNSUPPORTED_ANNOTATION;
  }

  private void skipStatement(
      final NativeOntologyImportSkipReason reason, final Statement statement) {
    ledger.skip(reason, statement);
    remaining.remove(statement);
    consumeBlank(statement.getObject());
  }

  /** Drops the statements of a blank node and of every blank node it reaches, without counting them. */
  private void consumeBlank(final RDFNode start) {
    final Deque<Resource> pending = new ArrayDeque<>();
    final Set<Resource> seen = new HashSet<>();
    if (start.isAnon()) {
      pending.push(start.asResource());
    }
    while (!pending.isEmpty()) {
      final Resource node = pending.pop();
      if (seen.add(node)) {
        for (final Statement inner : model.listStatements(node, null, (RDFNode) null).toList()) {
          remaining.remove(inner);
          if (inner.getObject().isAnon()) {
            pending.push(inner.getObject().asResource());
          }
        }
      }
    }
  }

  private boolean referenced(final Resource subject) {
    return model.listStatements(null, null, subject).hasNext();
  }

  private boolean usedAsPredicate(final Resource subject) {
    return subject.isURIResource()
        && model
            .listStatements(null, model.createProperty(subject.getURI()), (RDFNode) null)
            .toList()
            .stream()
            .anyMatch(statement -> !remaining.contains(statement));
  }

  private boolean usedAsAssertionSubject(final Resource subject) {
    return model.listStatements(subject, null, (RDFNode) null).toList().stream()
        .anyMatch(
            statement ->
                !statement.getPredicate().equals(RDF.type) && !remaining.contains(statement));
  }

  private List<Statement> takeAllStatements(final Resource subject, final Property predicate) {
    final List<Statement> statements =
        new ArrayList<>(model.listStatements(subject, predicate, (RDFNode) null).toList());
    statements.sort(Comparator.comparing(statement -> statement.getObject().toString()));
    statements.forEach(remaining::remove);
    return statements;
  }

  private List<RDFNode> takeAll(final Resource subject, final Property predicate) {
    return takeAllStatements(subject, predicate).stream().map(Statement::getObject).toList();
  }

  private Statement single(final Resource subject, final Property predicate) {
    final List<Statement> statements = takeAllStatements(subject, predicate);
    if (statements.size() > 1) {
      throw new BadRequestException("Conflicting RDF values for " + predicate.getURI());
    }
    return statements.isEmpty() ? null : statements.getFirst();
  }

  private List<URI> iris(final Resource subject, final Property predicate) {
    final Set<URI> iris = new LinkedHashSet<>();
    for (final Statement statement : takeAllStatements(subject, predicate)) {
      final URI iri = structuralTarget(statement);
      if (iri != null) {
        iris.add(iri);
      }
    }
    return List.copyOf(iris);
  }

  /** An annotation whose value is not an IRI is the author's note, not a reference; it is skipped. */
  private URI annotationIri(final Resource subject, final Property predicate) {
    final Statement statement = single(subject, predicate);
    return statement == null ? null : annotationTarget(statement);
  }

  private URI annotationTarget(final Statement statement) {
    return absoluteIriOrSkip(statement, NativeOntologyImportSkipReason.UNSUPPORTED_ANNOTATION);
  }

  private URI structuralIri(final Resource subject, final Property predicate) {
    final Statement statement = single(subject, predicate);
    return statement == null ? null : structuralTarget(statement);
  }

  /**
   * A blank node here is a class expression such as a union, which the native model cannot state
   * as one IRI. A literal is a mistake in the source. Either way the statement is skipped and
   * reported rather than guessed at.
   */
  private URI structuralTarget(final Statement statement) {
    return absoluteIriOrSkip(statement, NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE);
  }

  private URI absoluteIriOrSkip(
      final Statement statement, final NativeOntologyImportSkipReason reason) {
    URI iri = null;
    if (isAbsoluteIri(statement.getObject())) {
      iri = URI.create(statement.getResource().getURI());
    } else {
      skipStatement(reason, statement);
    }
    return iri;
  }

  private static boolean isAbsoluteIri(final RDFNode node) {
    boolean absolute = false;
    if (node.isURIResource()) {
      try {
        absolute = URI.create(node.asResource().getURI()).isAbsolute();
      } catch (IllegalArgumentException invalid) {
        absolute = false;
      }
    }
    return absolute;
  }

  private String text(final Resource subject, final Property predicate) {
    final RDFNode value = expressions.one(subject, predicate);
    return value == null ? null : string(value);
  }

  /**
   * The SKOS value names a concept first. An RDFS value that states the same text is consumed
   * with it; one that states different text is an extra value and is skipped.
   */
  private String conceptText(
      final Resource subject, final Property skosPredicate, final Property rdfsPredicate) {
    final String skosText = text(subject, skosPredicate);
    final Statement rdfs = single(subject, rdfsPredicate);
    final String rdfsText = rdfs == null ? null : string(rdfs.getObject());
    if (skosText != null && rdfsText != null && !skosText.equals(rdfsText)) {
      ledger.skip(NativeOntologyImportSkipReason.EXTRA_VALUE, rdfs);
    }
    return skosText == null ? rdfsText : skosText;
  }

  private static String string(final RDFNode value) {
    if (!value.isLiteral()
        || !value.asLiteral().getLanguage().isEmpty()
        || (value.asLiteral().getDatatypeURI() != null
            && !XSD.xstring.getURI().equals(value.asLiteral().getDatatypeURI()))) {
      throw new BadRequestException("Expected a plain RDF literal");
    }
    return value.asLiteral().getLexicalForm();
  }

  private boolean flag(final Resource subject, final Property predicate) {
    final RDFNode value = expressions.one(subject, predicate);
    if (value == null) {
      return false;
    }
    final String lexical =
        value.isLiteral() && XSD.xboolean.getURI().equals(value.asLiteral().getDatatypeURI())
            ? value.asLiteral().getLexicalForm()
            : "";
    return switch (lexical) {
      case "true", "1" -> true;
      case "false", "0" -> false;
      default -> throw new BadRequestException(
          predicate.getURI() + " requires an xsd:boolean value");
    };
  }

  private static boolean booleanValue(final RDFNode value) {
    if (!value.isLiteral()
        || !value.asLiteral().getLanguage().isEmpty()
        || !XSD.xboolean.getURI().equals(value.asLiteral().getDatatypeURI())
        || !"true".equals(value.asLiteral().getLexicalForm())) {
      throw new BadRequestException("Identifier intent must be true");
    }
    return true;
  }

  private static Resource resource(final RDFNode value, final String message) {
    if (!value.isResource()) {
      throw new BadRequestException(message);
    }
    return value.asResource();
  }
}
