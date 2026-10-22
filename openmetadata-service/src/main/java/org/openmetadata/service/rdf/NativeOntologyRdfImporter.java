package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.jena.rdf.model.Model;
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
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;
import org.openmetadata.service.util.FullyQualifiedName;

/** Converts representable RDF assertions into a regular native change-set request. */
public final class NativeOntologyRdfImporter {
  public Model parse(final String data, final RdfSerializationFormat format) {
    return new SafeRdfModelParser().parse(data, format);
  }

  public CreateOntologyChangeSet reconcile(
      final Model model, final OntologyWorkingSnapshot.Snapshot working) {
    final Parsed parsed = new Reader(model).read();
    final Map<String, OntologyConcept> concepts = new HashMap<>();
    final Map<String, OntologyProperty> properties = new HashMap<>();
    final Map<String, List<OntologyAxiom>> axioms = new HashMap<>();
    final Set<String> conceptNames = new HashSet<>();
    final Set<String> propertyNames = new HashSet<>();
    final Set<String> axiomNames = new HashSet<>();
    for (final var entry : working.entries()) {
      switch (entry.definition()) {
        case OntologyConcept concept -> {
          unique(concepts, concept.getIri().toString(), concept);
          conceptNames.add(concept.getName());
        }
        case OntologyProperty property -> {
          unique(properties, property.getIri().toString(), property);
          propertyNames.add(property.getName());
        }
        case OntologyAxiom axiom -> {
          axioms.computeIfAbsent(signature(axiom), ignored -> new ArrayList<>()).add(axiom);
          axiomNames.add(axiom.getName());
        }
        default -> {}
      }
    }
    final List<OntologyChangeOperation> operations = new ArrayList<>();
    for (final OntologyConcept parsedConcept : parsed.concepts()) {
      final OntologyConcept current = concepts.get(parsedConcept.getIri().toString());
      final String newName = importedName(parsedConcept.getIri().toString());
      final OntologyConcept proposed =
          current == null
              ? parsedConcept
                  .withId(UUID.randomUUID())
                  .withName(availableName(newName, conceptNames))
                  .withFullyQualifiedName(
                      FullyQualifiedName.add(working.root().getFullyQualifiedName(), newName))
                  .withOntology(working.root().getEntityReference())
                  .withVersion(0.1)
              : JsonUtils.deepCopy(current, OntologyConcept.class)
                  .withConceptType(parsedConcept.getConceptType())
                  .withSynonyms(parsedConcept.getSynonyms())
                  .withAbstract(parsedConcept.getAbstract())
                  .withDefinitionSource(parsedConcept.getDefinitionSource())
                  .withDeprecated(parsedConcept.getDeprecated())
                  .withReplacedBy(parsedConcept.getReplacedBy());
      if (current != null) {
        proposed.withConceptMappings(
            reconcileMappings(proposed.getConceptMappings(), parsedConcept.getConceptMappings()));
      }
      overlayLabel(proposed, parsedConcept.getDisplayName(), parsedConcept.getDescription());
      if (current == null || !sameConcept(current, proposed)) {
        operations.add(
            operation(OntologyChangeOperationType.UPSERT_CONCEPT, current).withConcept(proposed));
      }
    }
    for (final OntologyProperty parsedProperty : parsed.properties()) {
      final OntologyProperty current = properties.get(parsedProperty.getIri().toString());
      final String newName = importedName(parsedProperty.getIri().toString());
      final OntologyProperty proposed =
          current == null
              ? parsedProperty
                  .withId(UUID.randomUUID())
                  .withName(availableName(newName, propertyNames))
                  .withFullyQualifiedName(
                      FullyQualifiedName.add(working.root().getFullyQualifiedName(), newName))
                  .withOntology(working.root().getEntityReference())
                  .withVersion(0.1)
              : JsonUtils.deepCopy(current, OntologyProperty.class)
                  .withKind(parsedProperty.getKind())
                  .withDomain(parsedProperty.getDomain())
                  .withRange(parsedProperty.getRange())
                  .withEnumValues(parsedProperty.getEnumValues())
                  .withUnit(parsedProperty.getUnit())
                  .withIsIdentifier(parsedProperty.getIsIdentifier())
                  .withInverse(parsedProperty.getInverse())
                  .withCharacteristics(parsedProperty.getCharacteristics())
                  .withPropertyChain(parsedProperty.getPropertyChain())
                  .withDisjointWith(parsedProperty.getDisjointWith())
                  .withDeprecated(parsedProperty.getDeprecated())
                  .withReplacedBy(parsedProperty.getReplacedBy());
      overlayLabel(proposed, parsedProperty.getDisplayName(), parsedProperty.getDescription());
      if (current == null || !sameProperty(current, proposed)) {
        operations.add(
            operation(OntologyChangeOperationType.UPSERT_PROPERTY, current).withProperty(proposed));
      }
    }
    final Map<String, Integer> used = new HashMap<>();
    for (final OntologyAxiom parsedAxiom : parsed.axioms()) {
      final String signature = signature(parsedAxiom);
      final List<OntologyAxiom> matches = axioms.getOrDefault(signature, List.of());
      final int index = used.merge(signature, 1, Integer::sum) - 1;
      if (index < matches.size()) {
        continue;
      }
      final String name = availableName(importedName(signature + ":" + index), axiomNames);
      final OntologyAxiom proposed =
          parsedAxiom
              .withId(UUID.randomUUID())
              .withName(name)
              .withFullyQualifiedName(
                  FullyQualifiedName.add(working.root().getFullyQualifiedName(), name))
              .withOntology(working.root().getEntityReference())
              .withVersion(0.1)
              .withDisplayName(
                  "Imported "
                      + parsedAxiom
                          .getAxiomType()
                          .value()
                          .replace('_', ' ')
                          .toLowerCase(Locale.ROOT))
              .withDescription("Imported from native RDF")
              .withProvenance(RelationProvenance.IMPORTED);
      operations.add(operation(OntologyChangeOperationType.UPSERT_AXIOM, null).withAxiom(proposed));
    }
    if (operations.size() > 1000) {
      throw new BadRequestException("A native import accepts at most 1000 changed definitions");
    }
    return new CreateOntologyChangeSet()
        .withName("native-import-" + UUID.randomUUID())
        .withDisplayName("Native RDF import")
        .withDescription("Native RDF import preview")
        .withOntology(working.root().getFullyQualifiedName())
        .withBaseWorkingRevision(working.state().getWorkingRevision())
        .withOperations(operations)
        .withUndoCursor(operations.size());
  }

  private static <T> void unique(final Map<String, T> index, final String iri, final T value) {
    if (index.putIfAbsent(iri, value) != null) {
      throw new BadRequestException("Ontology has a duplicate definition IRI");
    }
  }

  private static String availableName(final String name, final Set<String> used) {
    if (!used.add(name)) {
      throw new BadRequestException("An imported definition name conflicts with an existing name");
    }
    return name;
  }

  private static OntologyChangeOperation operation(
      final OntologyChangeOperationType type, final OntologyDefinition current) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(type)
        .withState(OntologyChangeOperationState.ACTIVE)
        .withTargetId(current == null ? null : current.getId())
        .withBaseVersion(current == null ? null : current.getVersion());
  }

  private static String importedName(final String value) {
    final int separator = Math.max(value.lastIndexOf('/'), value.lastIndexOf('#'));
    final String local = value.substring(separator + 1).replaceAll("[^A-Za-z0-9_-]", "-");
    final String stem =
        local.isBlank() ? "definition" : local.substring(0, Math.min(40, local.length()));
    return "imported-" + stem + "-" + DigestUtils.sha256Hex(value);
  }

  private static void overlayLabel(
      final OntologyDefinition proposed, final String label, final String description) {
    proposed.setDisplayName(
        label != null && label.equals(proposed.getName()) && proposed.getDisplayName() == null
            ? null
            : label);
    proposed.setDescription(description);
  }

  private static boolean sameConcept(final OntologyConcept a, final OntologyConcept b) {
    return a.getConceptType() == b.getConceptType()
        && Objects.equals(label(a), label(b))
        && Objects.equals(a.getDescription(), b.getDescription())
        && setOrEmpty(a.getSynonyms()).equals(setOrEmpty(b.getSynonyms()))
        && Boolean.TRUE.equals(a.getAbstract()) == Boolean.TRUE.equals(b.getAbstract())
        && Objects.equals(iriText(a.getDefinitionSource()), iriText(b.getDefinitionSource()))
        && sameDeprecation(
            a.getDeprecated(), a.getReplacedBy(), b.getDeprecated(), b.getReplacedBy())
        && listOrEmpty(a.getConceptMappings()).stream()
            .map(NativeOntologyRdfImporter::mappingKey)
            .collect(Collectors.toSet())
            .equals(
                listOrEmpty(b.getConceptMappings()).stream()
                    .map(NativeOntologyRdfImporter::mappingKey)
                    .collect(Collectors.toSet()));
  }

  private static boolean sameProperty(final OntologyProperty a, final OntologyProperty b) {
    return a.getKind() == b.getKind()
        && Objects.equals(label(a), label(b))
        && Objects.equals(a.getDescription(), b.getDescription())
        && iriSet(a.getDomain()).equals(iriSet(b.getDomain()))
        && iriSet(a.getRange()).equals(iriSet(b.getRange()))
        && listOrEmpty(a.getEnumValues()).stream()
            .map(NativeOntologyRdfImporter::literalKey)
            .toList()
            .equals(
                listOrEmpty(b.getEnumValues()).stream()
                    .map(NativeOntologyRdfImporter::literalKey)
                    .toList())
        && Objects.equals(a.getUnit(), b.getUnit())
        && Objects.equals(a.getIsIdentifier(), b.getIsIdentifier())
        && Objects.equals(iriText(a.getInverse()), iriText(b.getInverse()))
        && setOrEmpty(a.getCharacteristics()).equals(setOrEmpty(b.getCharacteristics()))
        && listOrEmpty(a.getPropertyChain()).stream()
            .map(URI::toString)
            .toList()
            .equals(listOrEmpty(b.getPropertyChain()).stream().map(URI::toString).toList())
        && iriSet(a.getDisjointWith()).equals(iriSet(b.getDisjointWith()))
        && sameDeprecation(
            a.getDeprecated(), a.getReplacedBy(), b.getDeprecated(), b.getReplacedBy());
  }

  private static boolean sameDeprecation(
      final Boolean deprecated,
      final URI replacedBy,
      final Boolean otherDeprecated,
      final URI otherReplacedBy) {
    return Boolean.TRUE.equals(deprecated) == Boolean.TRUE.equals(otherDeprecated)
        && Objects.equals(iriText(replacedBy), iriText(otherReplacedBy));
  }

  private static Set<String> iriSet(final List<URI> iris) {
    return listOrEmpty(iris).stream().map(URI::toString).collect(Collectors.toSet());
  }

  private static <T> Set<T> setOrEmpty(final Set<T> values) {
    return values == null ? Set.of() : values;
  }

  private static String iriText(final URI iri) {
    return iri == null ? null : iri.toString();
  }

  private static List<ConceptMapping> reconcileMappings(
      final List<ConceptMapping> saved, final List<ConceptMapping> parsed) {
    final Set<String> savedKeys =
        listOrEmpty(saved).stream()
            .map(NativeOntologyRdfImporter::mappingKey)
            .collect(Collectors.toSet());
    final Set<String> parsedKeys =
        parsed.stream().map(NativeOntologyRdfImporter::mappingKey).collect(Collectors.toSet());
    final List<ConceptMapping> mappings =
        listOrEmpty(saved).stream()
            .filter(mapping -> parsedKeys.contains(mappingKey(mapping)))
            .collect(Collectors.toCollection(ArrayList::new));
    parsed.stream()
        .filter(mapping -> !savedKeys.contains(mappingKey(mapping)))
        .forEach(mappings::add);
    return mappings;
  }

  private static String mappingKey(final ConceptMapping mapping) {
    return mapping.getMappingType() + ":" + mapping.getConceptIri();
  }

  private static String literalKey(final OntologyLiteral literal) {
    final String datatype = iriText(literal.getDatatypeIri());
    return literal.getValue() + "^^" + (XSD.xstring.getURI().equals(datatype) ? null : datatype);
  }

  private static String label(final OntologyDefinition value) {
    return value.getDisplayName() == null ? value.getName() : value.getDisplayName();
  }

  private static String signature(final OntologyAxiom axiom) {
    final ObjectNode node = JsonUtils.getObjectMapper().valueToTree(axiom);
    node.retain("axiomType", "subjectIri", "propertyIri", "targetIri", "literal", "expressions");
    normalizeLiteral(node.get("literal"));
    final ArrayNode expressions = JsonUtils.getObjectMapper().createArrayNode();
    listOrEmpty(axiom.getExpressions()).stream()
        .map(expression -> normalizeExpression(JsonUtils.getObjectMapper().valueToTree(expression)))
        .sorted(Comparator.comparing(JsonNode::toString))
        .forEach(expressions::add);
    node.set("expressions", expressions);
    return node.toString();
  }

  private static JsonNode normalizeExpression(final JsonNode expression) {
    if (!(expression instanceof ObjectNode object)) {
      return expression;
    }
    for (final String field : List.of("operands", "individualIris")) {
      if (object.get(field) instanceof ArrayNode values) {
        final ArrayNode normalized = JsonUtils.getObjectMapper().createArrayNode();
        final List<JsonNode> items = new ArrayList<>();
        values.forEach(value -> items.add(normalizeExpression(value)));
        items.stream().sorted(Comparator.comparing(JsonNode::toString)).forEach(normalized::add);
        object.set(field, normalized);
      }
    }
    if (object.get("filler") != null) {
      object.set("filler", normalizeExpression(object.get("filler")));
    }
    normalizeLiteral(object.get("literal"));
    return object;
  }

  private static void normalizeLiteral(final JsonNode literal) {
    if (literal instanceof ObjectNode object
        && XSD.xstring.getURI().equals(object.path("datatypeIri").asText())) {
      object.remove("datatypeIri");
    }
  }

  private record Parsed(
      List<OntologyConcept> concepts,
      List<OntologyProperty> properties,
      List<OntologyAxiom> axioms) {}

  private static final class Reader {
    private final Model model;
    private final Set<Statement> remaining;
    private final OntologyExpressionRdfReader expressions;
    private final Map<Statement, List<String>> sources = new HashMap<>();
    private boolean nativeExport;
    private String versionIri;

    private Reader(final Model model) {
      this.model = model;
      remaining = new LinkedHashSet<>(model.listStatements().toList());
      expressions = new OntologyExpressionRdfReader(model, remaining);
    }

    private Parsed read() {
      headers();
      annotations();
      final List<OntologyConcept> concepts = concepts();
      final List<OntologyProperty> properties = properties();
      final List<OntologyAxiom> axioms = axioms(properties);
      references();
      if (!remaining.isEmpty()) {
        final Statement unsupported = remaining.iterator().next();
        throw new BadRequestException(
            "Unsupported RDF statement: " + diagnostic(unsupported.toString()));
      }
      return new Parsed(concepts, properties, axioms);
    }

    private static String diagnostic(final String value) {
      return value.length() > 200 ? value.substring(0, 200) + "…" : value;
    }

    private void headers() {
      if (model.contains(null, OWL2.imports)) {
        throw new BadRequestException("owl:imports is not supported by native import");
      }
      for (final Resource header :
          model.listSubjectsWithProperty(RDF.type, OWL2.Ontology).toList()) {
        expressions.takeType(header, OWL2.Ontology);
        text(header, RDFS.label);
        text(header, RDFS.comment);
        final RDFNode version = expressions.one(header, OWL2.versionIRI);
        if (version != null) {
          versionIri = OntologyExpressionRdfReader.iri(version).toString();
        }
      }
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
            OntologyExpressionRdfReader.iri(
                expressions.require(annotation, OWL2.annotatedProperty));
        final RDFNode target = expressions.require(annotation, OWL2.annotatedTarget);
        final RDFNode hint = expressions.one(annotation, DCTerms.source);
        final Statement base =
            model.createStatement(source, model.createProperty(predicate.toString()), target);
        if (!model.contains(base)) {
          throw new BadRequestException(
              "RDF axiom annotation does not describe an asserted triple");
        }
        if (hint != null) {
          sources
              .computeIfAbsent(base, ignored -> new ArrayList<>())
              .add(OntologyExpressionRdfReader.iri(hint).toString());
          nativeExport |=
              versionIri != null
                  && OntologyExpressionRdfReader.iri(hint).toString().startsWith(versionIri + ":");
        }
      }
    }

    private List<OntologyConcept> concepts() {
      final Set<Resource> subjects = new LinkedHashSet<>();
      subjects.addAll(model.listSubjectsWithProperty(RDF.type, OWL2.Class).toList());
      subjects.addAll(model.listSubjectsWithProperty(RDF.type, SKOS.Concept).toList());
      final List<OntologyConcept> parsed = new ArrayList<>();
      for (final Resource subject : subjects) {
        if (!subject.isURIResource()
            || OwlEntityDeclarations.isReservedVocabulary(subject.getURI())
            || (nativeExport && !model.contains(subject, RDFS.label) && referenced(subject))) {
          continue;
        }
        final boolean owl = expressions.takeType(subject, OWL2.Class);
        final boolean skos = expressions.takeType(subject, SKOS.Concept);
        if (skos) {
          expressions.takeType(subject, OWL2.NamedIndividual);
        }
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
                .withDefinitionSource(optionalIri(expressions.one(subject, DCTerms.source)))
                .withDeprecated(flag(subject, OWL2.deprecated))
                .withReplacedBy(optionalIri(expressions.one(subject, DCTerms.isReplacedBy)));
        final Set<String> synonyms = new LinkedHashSet<>();
        for (final RDFNode synonym : takeAll(subject, SKOS.altLabel)) {
          synonyms.add(string(synonym));
        }
        concept.withSynonyms(synonyms);
        final List<ConceptMapping> mappings = new ArrayList<>();
        for (final var kind : ConceptMapping.ConceptMappingType.values()) {
          final Property predicate = OntologyRdfVocabulary.mapping(kind);
          for (final RDFNode target : takeAll(subject, predicate)) {
            mappings.add(
                new ConceptMapping()
                    .withMappingType(kind)
                    .withConceptIri(OntologyExpressionRdfReader.iri(target)));
          }
        }
        concept.withConceptMappings(mappings);
        parsed.add(concept);
      }
      return parsed;
    }

    private List<OntologyProperty> properties() {
      final List<OntologyProperty> parsed = new ArrayList<>();
      for (final OntologyPropertyKind kind : OntologyPropertyKind.values()) {
        final Resource type =
            switch (kind) {
              case OBJECT -> OWL2.ObjectProperty;
              case DATA -> OWL2.DatatypeProperty;
              case ANNOTATION -> OWL2.AnnotationProperty;
            };
        for (final Resource subject : model.listSubjectsWithProperty(RDF.type, type).toList()) {
          if (!subject.isURIResource()
              || OwlEntityDeclarations.isReservedVocabulary(subject.getURI())
              || OntologyRdfVocabulary.ANNOTATIONS.contains(subject)
              || (nativeExport && !model.contains(subject, RDFS.label) && referenced(subject))) {
            continue;
          }
          expressions.takeType(subject, type);
          final OntologyProperty property =
              new OntologyProperty()
                  .withIri(URI.create(subject.getURI()))
                  .withKind(kind)
                  .withDisplayName(text(subject, RDFS.label))
                  .withDescription(text(subject, RDFS.comment))
                  .withDomain(iris(subject, RDFS.domain))
                  .withInverse(optionalIri(expressions.one(subject, OWL2.inverseOf)))
                  .withDisjointWith(iris(subject, OWL2.propertyDisjointWith))
                  .withUnit(text(subject, OntologyRdfVocabulary.UNIT))
                  .withDeprecated(flag(subject, OWL2.deprecated))
                  .withReplacedBy(optionalIri(expressions.one(subject, DCTerms.isReplacedBy)));
          final RDFNode identifier =
              expressions.one(subject, OntologyRdfVocabulary.IDENTIFIER_INTENT);
          property.withIsIdentifier(identifier != null && booleanValue(identifier));
          final Set<RelationshipCharacteristic> characteristics = new LinkedHashSet<>();
          for (final RelationshipCharacteristic characteristic :
              RelationshipCharacteristic.values()) {
            if (expressions.takeType(
                subject, OntologyRdfVocabulary.characteristic(characteristic))) {
              characteristics.add(characteristic);
            }
          }
          property.withCharacteristics(characteristics);
          final RDFNode chain = expressions.one(subject, OWL2.propertyChainAxiom);
          property.withPropertyChain(
              chain == null
                  ? List.of()
                  : expressions.list(chain, 0).stream()
                      .map(OntologyExpressionRdfReader::iri)
                      .toList());
          final List<URI> ranges = new ArrayList<>();
          final List<OntologyLiteral> enums = new ArrayList<>();
          for (final RDFNode range : takeAll(subject, RDFS.range)) {
            final Resource value = resource(range, "Property range must be a resource");
            if (model.contains(value, OWL2.equivalentClass) || model.contains(value, OWL2.oneOf)) {
              final Resource enumeration;
              if (value.isURIResource()) {
                if (!nativeExport
                    || versionIri == null
                    || !value
                        .getURI()
                        .matches(Pattern.quote(versionIri) + ":PROPERTY:[0-9a-fA-F-]{36}:values")) {
                  throw new BadRequestException(
                      "A named data enumeration cannot preserve its datatype IRI");
                }
                expressions.takeType(value, RDFS.Datatype);
                enumeration =
                    resource(
                        expressions.require(value, OWL2.equivalentClass),
                        "Data enumeration must be a resource");
              } else {
                enumeration = value;
              }
              expressions.takeType(enumeration, RDFS.Datatype);
              for (final RDFNode item :
                  expressions.list(expressions.require(enumeration, OWL2.oneOf), 0)) {
                if (!item.isLiteral()) {
                  throw new BadRequestException("A data enumeration requires literal values");
                }
                enums.add(OntologyExpressionRdfReader.literal(item.asLiteral()));
              }
            } else {
              ranges.add(OntologyExpressionRdfReader.iri(range));
            }
          }
          property.withRange(ranges).withEnumValues(enums);
          parsed.add(property);
        }
      }
      return parsed;
    }

    private List<OntologyAxiom> axioms(final List<OntologyProperty> properties) {
      final Map<String, OntologyAxiom> grouped = new LinkedHashMap<>();
      final Map<String, OntologyPropertyKind> kinds = new HashMap<>();
      model
          .listSubjectsWithProperty(RDF.type, OWL2.ObjectProperty)
          .forEachRemaining(property -> kinds.put(property.getURI(), OntologyPropertyKind.OBJECT));
      model
          .listSubjectsWithProperty(RDF.type, OWL2.DatatypeProperty)
          .forEachRemaining(property -> kinds.put(property.getURI(), OntologyPropertyKind.DATA));
      properties.forEach(property -> kinds.put(property.getIri().toString(), property.getKind()));
      for (final Statement statement : List.copyOf(remaining)) {
        if (!remaining.contains(statement) || !statement.getSubject().isURIResource()) {
          continue;
        }
        final Property predicate = statement.getPredicate();
        final OntologyPropertyKind propertyKind = assertionPropertyKind(predicate.getURI(), kinds);
        final OntologyAxiomType type =
            predicate.equals(RDFS.subClassOf)
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
        if (type == null) {
          continue;
        }
        remaining.remove(statement);
        final List<String> hints = sources.getOrDefault(statement, List.of(statement.toString()));
        for (final String hint : hints) {
          final String key =
              type
                  + ":"
                  + statement.getSubject().getURI()
                  + ":"
                  + hint
                  + (type == OntologyAxiomType.OBJECT_PROPERTY_ASSERTION
                          || type == OntologyAxiomType.DATA_PROPERTY_ASSERTION
                          || type == OntologyAxiomType.CLASS_ASSERTION
                      ? ":" + statement
                      : "");
          final OntologyAxiom axiom =
              grouped.computeIfAbsent(
                  key,
                  ignored ->
                      new OntologyAxiom()
                          .withAxiomType(type)
                          .withSubjectIri(URI.create(statement.getSubject().getURI()))
                          .withExpressions(new ArrayList<>()));
          switch (type) {
            case SUBCLASS_OF, EQUIVALENT_CLASS, DISJOINT_WITH, CLASS_ASSERTION -> axiom
                .getExpressions()
                .add(expressions.read(statement.getObject()));
            case OBJECT_PROPERTY_ASSERTION -> axiom
                .withPropertyIri(URI.create(predicate.getURI()))
                .withTargetIri(OntologyExpressionRdfReader.iri(statement.getObject()));
            case DATA_PROPERTY_ASSERTION -> {
              if (!statement.getObject().isLiteral()) {
                throw new BadRequestException("Data property assertion requires a literal");
              }
              axiom
                  .withPropertyIri(URI.create(predicate.getURI()))
                  .withLiteral(OntologyExpressionRdfReader.literal(statement.getLiteral()));
            }
          }
        }
      }
      return List.copyOf(grouped.values());
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

    private List<RDFNode> takeAll(final Resource subject, final Property predicate) {
      final List<Statement> statements =
          model.listStatements(subject, predicate, (RDFNode) null).toList();
      statements.forEach(remaining::remove);
      return statements.stream().map(Statement::getObject).toList();
    }

    private List<URI> iris(final Resource subject, final Property predicate) {
      return takeAll(subject, predicate).stream().map(OntologyExpressionRdfReader::iri).toList();
    }

    private String text(final Resource subject, final Property predicate) {
      final RDFNode value = expressions.one(subject, predicate);
      return value == null ? null : string(value);
    }

    private String conceptText(
        final Resource subject, final Property skosPredicate, final Property rdfsPredicate) {
      final String skosText = text(subject, skosPredicate);
      final String rdfsText = text(subject, rdfsPredicate);
      if (skosText != null && rdfsText != null && !skosText.equals(rdfsText)) {
        throw new BadRequestException(
            "Conflicting concept annotations: " + skosPredicate + " and " + rdfsPredicate);
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

    private static URI optionalIri(final RDFNode value) {
      return value == null ? null : OntologyExpressionRdfReader.iri(value);
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
}
