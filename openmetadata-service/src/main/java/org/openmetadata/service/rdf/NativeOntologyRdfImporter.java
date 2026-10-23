package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.util.ArrayList;
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
import org.openmetadata.schema.api.data.NativeOntologyImportCounts;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.NativeOntologyImportSummary;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
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
import org.openmetadata.service.ontology.NativeOntologyCsvCodec;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.ontology.OntologyFormatDetector;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Matches the definitions one import source states against a working ontology, counts what would
 * change, and plans the regular native change-set request that applies it.
 */
public final class NativeOntologyRdfImporter {
  private static final int MAX_CHANGED_DEFINITIONS = 1000;
  private static final String FORMAT_REQUIRED =
      "Specify format as one of turtle, rdfxml, ntriples, jsonld, or csv";

  /** One parsed source: the format the server parsed it with and the definitions it states. */
  public record Source(NativeOntologyImportFormat format, NativeOntologyDocument document) {}

  public Model parse(final String data, final RdfSerializationFormat format) {
    return new SafeRdfModelParser().parse(data, format);
  }

  public static NativeOntologyDocument read(final Model model) {
    return new Reader(model).read();
  }

  public Source read(final PreviewNativeOntologyImport request) {
    final NativeOntologyImportFormat format =
        OntologyFormatDetector.resolve(request)
            .orElseThrow(() -> new BadRequestException(FORMAT_REQUIRED));
    if (format == NativeOntologyImportFormat.CSV) {
      return new Source(format, NativeOntologyCsvCodec.read(request.getData()));
    }
    return new Source(format, readRdf(request.getData(), grammar(request, format)));
  }

  /** Detection sees only a window of the file, and every N-Triples file is valid Turtle. */
  private static RdfSerializationFormat grammar(
      final PreviewNativeOntologyImport request, final NativeOntologyImportFormat format) {
    return request.getFormat() == null && format == NativeOntologyImportFormat.NTRIPLES
        ? RdfSerializationFormat.TURTLE
        : RdfSerializationFormat.parse(format.value());
  }

  public NativeOntologyImportPreview preview(
      final Source source, final OntologyWorkingSnapshot.Snapshot working) {
    final Stored stored = Stored.index(working);
    final Outcomes outcomes = classify(source.document(), stored);
    return new NativeOntologyImportPreview()
        .withSummary(summary(source.format(), source.document().header(), outcomes))
        .withChangeSet(plan(outcomes, stored, working, SourceFamily.of(source.format())));
  }

  public NativeOntologyImportSummary summarize(final Source source) {
    return summary(
        source.format(), source.document().header(), classify(source.document(), Stored.EMPTY));
  }

  public CreateOntologyChangeSet reconcile(
      final Model model, final OntologyWorkingSnapshot.Snapshot working) {
    final Stored stored = Stored.index(working);
    return plan(classify(read(model), stored), stored, working, SourceFamily.RDF);
  }

  private NativeOntologyDocument readRdf(final String data, final RdfSerializationFormat format) {
    final Model model = parse(data, format);
    try {
      return read(model);
    } finally {
      model.close();
    }
  }

  /** The working snapshot, indexed the way classification looks definitions up. */
  private record Stored(
      Map<String, OntologyConcept> concepts,
      Map<String, OntologyProperty> properties,
      Map<String, List<OntologyAxiom>> axioms,
      Set<String> conceptNames,
      Set<String> propertyNames,
      Set<String> axiomNames) {
    static final Stored EMPTY =
        new Stored(Map.of(), Map.of(), Map.of(), Set.of(), Set.of(), Set.of());

    static Stored index(final OntologyWorkingSnapshot.Snapshot working) {
      final Stored stored =
          new Stored(
              new HashMap<>(),
              new HashMap<>(),
              new HashMap<>(),
              new HashSet<>(),
              new HashSet<>(),
              new HashSet<>());
      working.entries().forEach(entry -> stored.add(entry.definition()));
      return stored;
    }

    private void add(final OntologyDefinition definition) {
      switch (definition) {
        case OntologyConcept concept -> {
          unique(concepts, concept.getIri().toString(), concept);
          conceptNames.add(concept.getName());
        }
        case OntologyProperty property -> {
          unique(properties, property.getIri().toString(), property);
          propertyNames.add(property.getName());
        }
        case OntologyAxiom axiom -> {
          axioms
              .computeIfAbsent(
                  NativeOntologyDocument.signature(axiom), ignored -> new ArrayList<>())
              .add(axiom);
          axiomNames.add(axiom.getName());
        }
        default -> {}
      }
    }
  }

  /** What one parsed definition does to the target. Every parsed definition gets exactly one. */
  private sealed interface Outcome<T extends OntologyDefinition>
      permits Added, Updated, Unchanged {}

  /** A definition the target lacks. {@code key} is what classification matched on; it seeds the name. */
  private record Added<T extends OntologyDefinition>(T parsed, String key) implements Outcome<T> {}

  /** A stored definition the source changes. {@code proposed} is the stored copy with the source's fields. */
  private record Updated<T extends OntologyDefinition>(T current, T proposed)
      implements Outcome<T> {}

  /** A stored definition the source repeats unchanged. */
  private record Unchanged<T extends OntologyDefinition>(T parsed) implements Outcome<T> {}

  private record Outcomes(
      List<Outcome<OntologyConcept>> concepts,
      List<Outcome<OntologyProperty>> properties,
      List<Outcome<OntologyAxiom>> axioms) {
    int changed() {
      return concepts.size()
          + properties.size()
          + axioms.size()
          - count(concepts, Unchanged.class)
          - count(properties, Unchanged.class)
          - count(axioms, Unchanged.class);
    }
  }

  /** The vocabulary a source is written in, as the change set names it. */
  private enum SourceFamily {
    RDF,
    CSV;

    static SourceFamily of(final NativeOntologyImportFormat format) {
      return format == NativeOntologyImportFormat.CSV ? CSV : RDF;
    }
  }

  private static Outcomes classify(final NativeOntologyDocument document, final Stored stored) {
    final Outcomes outcomes =
        new Outcomes(
            document.concepts().stream()
                .map(
                    concept ->
                        classifyConcept(
                            concept, stored.concepts().get(concept.getIri().toString())))
                .toList(),
            document.properties().stream()
                .map(
                    property ->
                        classifyProperty(
                            property, stored.properties().get(property.getIri().toString())))
                .toList(),
            classifyAxioms(document.axioms(), stored.axioms()));
    if (outcomes.changed() > MAX_CHANGED_DEFINITIONS) {
      throw new BadRequestException("A native import accepts at most 1000 changed definitions");
    }
    return outcomes;
  }

  private static Outcome<OntologyConcept> classifyConcept(
      final OntologyConcept parsed, final OntologyConcept current) {
    if (current == null) {
      return new Added<>(parsed, parsed.getIri().toString());
    }
    final OntologyConcept proposed = JsonUtils.deepCopy(current, OntologyConcept.class);
    proposed
        .withConceptType(parsed.getConceptType())
        .withSynonyms(parsed.getSynonyms())
        .withConceptMappings(
            reconcileMappings(proposed.getConceptMappings(), parsed.getConceptMappings()));
    overlayLabel(proposed, parsed.getDisplayName(), parsed.getDescription());
    return sameConcept(current, proposed)
        ? new Unchanged<>(parsed)
        : new Updated<>(current, proposed);
  }

  private static Outcome<OntologyProperty> classifyProperty(
      final OntologyProperty parsed, final OntologyProperty current) {
    if (current == null) {
      return new Added<>(parsed, parsed.getIri().toString());
    }
    final OntologyProperty proposed =
        JsonUtils.deepCopy(current, OntologyProperty.class)
            .withKind(parsed.getKind())
            .withDomain(parsed.getDomain())
            .withRange(parsed.getRange())
            .withEnumValues(parsed.getEnumValues())
            .withUnit(parsed.getUnit())
            .withIsIdentifier(parsed.getIsIdentifier())
            .withInverse(parsed.getInverse())
            .withCharacteristics(parsed.getCharacteristics())
            .withPropertyChain(parsed.getPropertyChain())
            .withDisjointWith(parsed.getDisjointWith());
    overlayLabel(proposed, parsed.getDisplayName(), parsed.getDescription());
    return sameProperty(current, proposed)
        ? new Unchanged<>(parsed)
        : new Updated<>(current, proposed);
  }

  /** Axioms match by signature; the stored copies of a signature absorb the parsed ones in order. */
  private static List<Outcome<OntologyAxiom>> classifyAxioms(
      final List<OntologyAxiom> parsed, final Map<String, List<OntologyAxiom>> stored) {
    final Map<String, Integer> seen = new HashMap<>();
    final List<Outcome<OntologyAxiom>> outcomes = new ArrayList<>();
    for (final OntologyAxiom axiom : parsed) {
      final String signature = NativeOntologyDocument.signature(axiom);
      final int ordinal = seen.merge(signature, 1, Integer::sum) - 1;
      outcomes.add(
          ordinal < stored.getOrDefault(signature, List.of()).size()
              ? new Unchanged<>(axiom)
              : new Added<>(axiom, signature + ":" + ordinal));
    }
    return outcomes;
  }

  private static NativeOntologyImportSummary summary(
      final NativeOntologyImportFormat format,
      final NativeOntologyDocument.Header header,
      final Outcomes outcomes) {
    return new NativeOntologyImportSummary()
        .withDetectedFormat(format)
        .withOntologyLabel(header == null ? null : header.label())
        .withCounts(counts(outcomes));
  }

  private static NativeOntologyImportCounts counts(final Outcomes outcomes) {
    return new NativeOntologyImportCounts()
        .withNewConcepts(count(outcomes.concepts(), Added.class))
        .withUpdatedConcepts(count(outcomes.concepts(), Updated.class))
        .withNewProperties(count(outcomes.properties(), Added.class))
        .withUpdatedProperties(count(outcomes.properties(), Updated.class))
        .withNewRelations(count(outcomes.axioms(), Added.class))
        .withNewMappings(
            outcomes.concepts().stream().mapToInt(NativeOntologyRdfImporter::newMappings).sum())
        .withSkippedDefinitions(
            count(outcomes.concepts(), Unchanged.class)
                + count(outcomes.properties(), Unchanged.class))
        .withSkippedRelations(count(outcomes.axioms(), Unchanged.class));
  }

  private static int count(final List<? extends Outcome<?>> outcomes, final Class<?> kind) {
    return (int) outcomes.stream().filter(kind::isInstance).count();
  }

  private static int newMappings(final Outcome<OntologyConcept> outcome) {
    return switch (outcome) {
      case Added<OntologyConcept> added -> mappingKeys(added.parsed().getConceptMappings()).size();
      case Updated<OntologyConcept> updated -> {
        final Set<String> keys = mappingKeys(updated.proposed().getConceptMappings());
        keys.removeAll(mappingKeys(updated.current().getConceptMappings()));
        yield keys.size();
      }
      case Unchanged<OntologyConcept> ignored -> 0;
    };
  }

  private static CreateOntologyChangeSet plan(
      final Outcomes outcomes,
      final Stored stored,
      final OntologyWorkingSnapshot.Snapshot working,
      final SourceFamily family) {
    return new Plan(stored, working, family).of(outcomes);
  }

  /** Gives added definitions their catalog identity and wraps every change as a draft operation. */
  private static final class Plan {
    private final OntologyWorkingSnapshot.Snapshot working;
    private final SourceFamily family;
    private final Set<String> conceptNames;
    private final Set<String> propertyNames;
    private final Set<String> axiomNames;
    private final List<OntologyChangeOperation> operations = new ArrayList<>();

    private Plan(
        final Stored stored,
        final OntologyWorkingSnapshot.Snapshot working,
        final SourceFamily family) {
      this.working = working;
      this.family = family;
      conceptNames = new HashSet<>(stored.conceptNames());
      propertyNames = new HashSet<>(stored.propertyNames());
      axiomNames = new HashSet<>(stored.axiomNames());
    }

    private CreateOntologyChangeSet of(final Outcomes outcomes) {
      outcomes.concepts().forEach(this::concept);
      outcomes.properties().forEach(this::property);
      outcomes.axioms().forEach(this::axiom);
      return new CreateOntologyChangeSet()
          .withName("native-import-" + UUID.randomUUID())
          .withDisplayName("Native " + family + " import")
          .withDescription("Native " + family + " import preview")
          .withOntology(working.root().getFullyQualifiedName())
          .withBaseWorkingRevision(working.state().getWorkingRevision())
          .withOperations(operations)
          .withUndoCursor(operations.size());
    }

    private void concept(final Outcome<OntologyConcept> outcome) {
      switch (outcome) {
        case Added<OntologyConcept> added -> operations.add(
            operation(OntologyChangeOperationType.UPSERT_CONCEPT, null)
                .withConcept(identified(added, OntologyConcept.class, conceptNames)));
        case Updated<OntologyConcept> updated -> operations.add(
            operation(OntologyChangeOperationType.UPSERT_CONCEPT, updated.current())
                .withConcept(updated.proposed()));
        case Unchanged<OntologyConcept> ignored -> {}
      }
    }

    private void property(final Outcome<OntologyProperty> outcome) {
      switch (outcome) {
        case Added<OntologyProperty> added -> operations.add(
            operation(OntologyChangeOperationType.UPSERT_PROPERTY, null)
                .withProperty(identified(added, OntologyProperty.class, propertyNames)));
        case Updated<OntologyProperty> updated -> operations.add(
            operation(OntologyChangeOperationType.UPSERT_PROPERTY, updated.current())
                .withProperty(updated.proposed()));
        case Unchanged<OntologyProperty> ignored -> {}
      }
    }

    private void axiom(final Outcome<OntologyAxiom> outcome) {
      // Axioms match by signature, so a changed axiom is a new one and the stored one stays.
      if (outcome instanceof Added<OntologyAxiom> added) {
        operations.add(
            operation(OntologyChangeOperationType.UPSERT_AXIOM, null)
                .withAxiom(
                    identified(added, OntologyAxiom.class, axiomNames)
                        .withDisplayName(
                            "Imported "
                                + added
                                    .parsed()
                                    .getAxiomType()
                                    .value()
                                    .replace('_', ' ')
                                    .toLowerCase(Locale.ROOT))
                        .withDescription("Imported from native " + family)
                        .withProvenance(RelationProvenance.IMPORTED)));
      }
    }

    private <T extends OntologyDefinition> T identified(
        final Added<T> added, final Class<T> type, final Set<String> names) {
      final String name = availableName(importedName(added.key()), names);
      final T copy = JsonUtils.deepCopy(added.parsed(), type);
      copy.setId(UUID.randomUUID());
      copy.setName(name);
      copy.setFullyQualifiedName(
          FullyQualifiedName.add(working.root().getFullyQualifiedName(), name));
      copy.setOntology(working.root().getEntityReference());
      copy.setVersion(0.1);
      return copy;
    }
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
        && mappingKeys(a.getConceptMappings()).equals(mappingKeys(b.getConceptMappings()));
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
        && iriSet(a.getDisjointWith()).equals(iriSet(b.getDisjointWith()));
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
    final Set<String> savedKeys = mappingKeys(saved);
    final Set<String> parsedKeys = mappingKeys(parsed);
    final List<ConceptMapping> mappings =
        listOrEmpty(saved).stream()
            .filter(mapping -> parsedKeys.contains(mappingKey(mapping)))
            .collect(Collectors.toCollection(ArrayList::new));
    listOrEmpty(parsed).stream()
        .filter(mapping -> !savedKeys.contains(mappingKey(mapping)))
        .forEach(mappings::add);
    return mappings;
  }

  private static Set<String> mappingKeys(final List<ConceptMapping> mappings) {
    return listOrEmpty(mappings).stream()
        .map(NativeOntologyRdfImporter::mappingKey)
        .collect(Collectors.toCollection(HashSet::new));
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

  private static final class Reader {
    private final Model model;
    private final Set<Statement> remaining;
    private final OntologyExpressionRdfReader expressions;
    private final Map<Statement, List<String>> sources = new HashMap<>();
    private boolean nativeExport;
    private String versionIri;
    private NativeOntologyDocument.Header header;

    private Reader(final Model model) {
      this.model = model;
      remaining = new LinkedHashSet<>(model.listStatements().toList());
      expressions = new OntologyExpressionRdfReader(model, remaining);
    }

    private NativeOntologyDocument read() {
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
      return new NativeOntologyDocument(header, concepts, properties, axioms);
    }

    private static String diagnostic(final String value) {
      return value.length() > 200 ? value.substring(0, 200) + "…" : value;
    }

    private void headers() {
      if (model.contains(null, OWL2.imports)) {
        throw new BadRequestException("owl:imports is not supported by native import");
      }
      final List<Resource> declared =
          model.listSubjectsWithProperty(RDF.type, OWL2.Ontology).toList();
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
                .withDescription(conceptText(subject, SKOS.definition, RDFS.comment));
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
              || DCTerms.source.equals(subject)
              || OntologyRdfVocabulary.UNIT.equals(subject)
              || OntologyRdfVocabulary.IDENTIFIER_INTENT.equals(subject)
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
                  .withUnit(text(subject, OntologyRdfVocabulary.UNIT));
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
                || DCTerms.source.equals(statement.getSubject())
                || OntologyRdfVocabulary.UNIT.equals(statement.getSubject())
                || OntologyRdfVocabulary.IDENTIFIER_INTENT.equals(statement.getSubject())
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
