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
import java.util.stream.Stream;
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
import org.openmetadata.schema.api.data.NativeOntologyImportItem;
import org.openmetadata.schema.api.data.NativeOntologyImportItemKind;
import org.openmetadata.schema.api.data.NativeOntologyImportItemStatus;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.NativeOntologyImportSummary;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyProfileViolation;
import org.openmetadata.schema.type.OntologyProfileViolationSeverity;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.ontology.OntologyClassHierarchy;
import org.openmetadata.service.ontology.OntologyConceptReferences;
import org.openmetadata.service.ontology.OntologyDisjointnessClashes;
import org.openmetadata.service.ontology.OntologyFormatDetector;
import org.openmetadata.service.ontology.OntologyPropertyRules;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Matches the definitions one import source states against a working ontology, counts what would
 * change, and plans the regular native change-set request that applies it.
 */
public final class NativeOntologyRdfImporter {
  private static final int MAX_CHANGED_DEFINITIONS = 1000;
  private static final int MAX_NAME_LENGTH = 64;
  private static final int ITEM_DIGEST_LENGTH = 16;
  private static final OntologyWorkingSnapshot.Snapshot PREVIEW_TARGET =
      new OntologyWorkingSnapshot.Snapshot(
          new OntologyState().withWorkingRevision(0L),
          List.of(
              new OntologyWorkingSnapshot.Entry(
                  MemberKind.ONTOLOGY,
                  new Ontology()
                      .withId(new UUID(0, 0))
                      .withName("preview")
                      .withFullyQualifiedName("preview"))));
  private static final String FORMAT_REQUIRED =
      "Specify format as one of turtle, rdfxml, ntriples, jsonld, or csv";

  /**
   * One parsed source: the format the server parsed it with and the definitions it states.
   *
   * @param propertyRows the CSV row each property was declared on, by IRI; empty for RDF
   */
  public record Source(
      NativeOntologyImportFormat format,
      NativeOntologyDocument document,
      Map<String, Integer> propertyRows) {
    public Source(final NativeOntologyImportFormat format, final NativeOntologyDocument document) {
      this(format, document, Map.of());
    }
  }

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
      final NativeOntologyCsvCodec.Located csv =
          NativeOntologyCsvCodec.readLocated(request.getData());
      return new Source(format, csv.document(), csv.propertyRows());
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
    requireApplicable(source.document(), stored, source.propertyRows());
    final Outcomes outcomes = reject(classify(source.document(), stored), stored);
    final Plan plan = new Plan(stored, working, SourceFamily.of(source.format()));
    final CreateOntologyChangeSet changeSet = plan.of(outcomes);
    final List<NativeOntologyImportItem> items = plan.itemsWithClashes();
    return new NativeOntologyImportPreview()
        .withSummary(
            summary(source.format(), source.document().header(), outcomes).withItems(items))
        .withChangeSet(changeSet);
  }

  /**
   * Counts and items against an empty target that does not exist yet. The items carry no
   * operation, because no change set exists until the ontology does.
   */
  public NativeOntologyImportSummary summarize(final Source source) {
    requireApplicable(source.document(), Stored.EMPTY, source.propertyRows());
    final Outcomes outcomes = reject(classify(source.document(), Stored.EMPTY), Stored.EMPTY);
    final Plan plan = new Plan(Stored.EMPTY, PREVIEW_TARGET, SourceFamily.of(source.format()));
    plan.of(outcomes);
    final List<NativeOntologyImportItem> items = plan.itemsWithClashes();
    items.forEach(item -> item.setOperationId(null));
    return summary(source.format(), source.document().header(), outcomes).withItems(items);
  }

  public CreateOntologyChangeSet reconcile(
      final Model model, final OntologyWorkingSnapshot.Snapshot working) {
    final Stored stored = Stored.index(working);
    final NativeOntologyDocument document = read(model);
    requireApplicable(document, stored, Map.of());
    return plan(reject(classify(document, stored), stored), stored, working, SourceFamily.RDF);
  }

  /** Applying a draft refuses these properties, so a preview must not count them as importable. */
  private static void requireApplicable(
      final NativeOntologyDocument document,
      final Stored stored,
      final Map<String, Integer> propertyRows) {
    for (final OntologyProperty parsed : document.properties()) {
      final String iri = parsed.getIri().toString();
      final OntologyProperty current = stored.properties().get(iri);
      final OntologyPropertyRules.Violation violation =
          firstNonNull(
              OntologyPropertyRules.firstViolation(
                  parsed,
                  () ->
                      current != null
                          && JsonUtils.pojoToJson(current.getEnumValues())
                              .equals(JsonUtils.pojoToJson(parsed.getEnumValues()))),
              OntologyPropertyRules.datatypeViolation(parsed));
      if (violation != null) {
        final Integer row = propertyRows.get(iri);
        final String where =
            row == null
                ? "Property " + iri + ", " + violation.field()
                : "CSV row "
                    + row
                    + ", column "
                    + NativeOntologyCsvCodec.propertyColumn(violation.field());
        throw new BadRequestException(where + ": " + violation.message());
      }
    }
  }

  private static OntologyPropertyRules.Violation firstNonNull(
      final OntologyPropertyRules.Violation first, final OntologyPropertyRules.Violation second) {
    return first != null ? first : second;
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
      permits Added, Updated, Unchanged, Duplicate, Rejected {}

  /** A definition the target lacks. {@code key} is what classification matched on; it seeds the name. */
  private record Added<T extends OntologyDefinition>(T parsed, String key) implements Outcome<T> {}

  /** A stored definition the source changes. {@code proposed} is the stored copy with the source's fields. */
  private record Updated<T extends OntologyDefinition>(T current, T proposed)
      implements Outcome<T> {}

  /** A stored definition the source repeats unchanged. */
  private record Unchanged<T extends OntologyDefinition>(T parsed) implements Outcome<T> {}

  /** A definition the source already stated earlier; only the first statement counts. */
  private record Duplicate<T extends OntologyDefinition>(T parsed) implements Outcome<T> {}

  /** A definition applying would refuse, with the reason; it carries no operation. */
  private record Rejected<T extends OntologyDefinition>(T parsed, String reason)
      implements Outcome<T> {}

  private record Outcomes(
      List<Outcome<OntologyConcept>> concepts,
      List<Outcome<OntologyProperty>> properties,
      List<Outcome<OntologyAxiom>> axioms) {
    int changed() {
      return changes(concepts) + changes(properties) + changes(axioms);
    }

    private static int changes(final List<? extends Outcome<?>> outcomes) {
      return count(outcomes, Added.class) + count(outcomes, Updated.class);
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
            firstOccurrences(
                document.concepts(),
                concept -> concept.getIri().toString(),
                concept ->
                    classifyConcept(concept, stored.concepts().get(concept.getIri().toString()))),
            firstOccurrences(
                document.properties(),
                property -> property.getIri().toString(),
                property ->
                    classifyProperty(
                        property, stored.properties().get(property.getIri().toString()))),
            classifyAxioms(document.axioms(), stored.axioms()));
    if (outcomes.changed() > MAX_CHANGED_DEFINITIONS) {
      throw new BadRequestException("A native import accepts at most 1000 changed definitions");
    }
    return outcomes;
  }

  private static <T extends OntologyDefinition> List<Outcome<T>> firstOccurrences(
      final List<T> parsed,
      final java.util.function.Function<T, String> key,
      final java.util.function.Function<T, Outcome<T>> classify) {
    final Set<String> seen = new HashSet<>();
    return parsed.stream()
        .map(value -> seen.add(key.apply(value)) ? classify.apply(value) : new Duplicate<>(value))
        .toList();
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
        .withAbstract(parsed.getAbstract())
        .withDefinitionSource(parsed.getDefinitionSource())
        .withDeprecated(parsed.getDeprecated())
        .withReplacedBy(parsed.getReplacedBy())
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
            .withDisjointWith(parsed.getDisjointWith())
            .withDeprecated(parsed.getDeprecated())
            .withReplacedBy(parsed.getReplacedBy());
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
        .withSkippedDefinitions(skipped(outcomes.concepts()) + skipped(outcomes.properties()))
        .withSkippedRelations(skipped(outcomes.axioms()));
  }

  private static int skipped(final List<? extends Outcome<?>> outcomes) {
    return count(outcomes, Unchanged.class)
        + count(outcomes, Duplicate.class)
        + count(outcomes, Rejected.class);
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
      case Duplicate<OntologyConcept> ignored -> 0;
      case Rejected<OntologyConcept> ignored -> 0;
    };
  }

  private static CreateOntologyChangeSet plan(
      final Outcomes outcomes,
      final Stored stored,
      final OntologyWorkingSnapshot.Snapshot working,
      final SourceFamily family) {
    return new Plan(stored, working, family).of(outcomes);
  }

  /** Refuses what applying the draft would refuse, so a preview never lists what apply rejects. */
  private static Outcomes reject(final Outcomes outcomes, final Stored stored) {
    final OntologyClassHierarchy hierarchy =
        new OntologyClassHierarchy(afterImport(outcomes, stored));
    return new Outcomes(
        outcomes.concepts(),
        outcomes.properties().stream().map(outcome -> refuse(outcome, hierarchy)).toList(),
        outcomes.axioms().stream().map(outcome -> refuse(outcome, hierarchy)).toList());
  }

  private static List<OntologyDefinition> afterImport(
      final Outcomes outcomes, final Stored stored) {
    final Map<String, OntologyConcept> concepts = new LinkedHashMap<>(stored.concepts());
    outcomes.concepts().forEach(outcome -> overlay(concepts, outcome));
    final Map<String, OntologyProperty> properties = new LinkedHashMap<>(stored.properties());
    outcomes.properties().forEach(outcome -> overlay(properties, outcome));
    final List<OntologyDefinition> definitions = new ArrayList<>(concepts.values());
    definitions.addAll(properties.values());
    stored.axioms().values().forEach(definitions::addAll);
    outcomes.axioms().stream()
        .filter(Added.class::isInstance)
        .forEach(outcome -> definitions.add(((Added<OntologyAxiom>) outcome).parsed()));
    return definitions;
  }

  private static <T extends OntologyDefinition> void overlay(
      final Map<String, T> index, final Outcome<T> outcome) {
    switch (outcome) {
      case Added<T> added -> index.put(iriOf(added.parsed()), added.parsed());
      case Updated<T> updated -> index.put(iriOf(updated.proposed()), updated.proposed());
      default -> {}
    }
  }

  private static String iriOf(final OntologyDefinition definition) {
    return definition instanceof OntologyConcept concept
        ? concept.getIri().toString()
        : ((OntologyProperty) definition).getIri().toString();
  }

  private static <T extends OntologyDefinition> Outcome<T> refuse(
      final Outcome<T> outcome, final OntologyClassHierarchy hierarchy) {
    final T candidate =
        switch (outcome) {
          case Added<T> added -> added.parsed();
          case Updated<T> updated -> updated.proposed();
          default -> null;
        };
    if (candidate == null) {
      return outcome;
    }
    final List<OntologyProfileViolation> violations = new ArrayList<>();
    hierarchy.validate(candidate, violations::add);
    return violations.stream()
        .filter(violation -> violation.getSeverity() == OntologyProfileViolationSeverity.ERROR)
        .findFirst()
        .<Outcome<T>>map(violation -> new Rejected<>(candidate, violation.getMessage()))
        .orElse(outcome);
  }

  /** Gives added definitions their catalog identity and wraps every change as a draft operation. */
  private static final class Plan {
    private static final String DUPLICATE_REASON = "Listed more than once in the file.";
    private final OntologyWorkingSnapshot.Snapshot working;
    private final SourceFamily family;
    private final Set<String> conceptNames;
    private final Set<String> propertyNames;
    private final Set<String> axiomNames;
    private final Map<String, String> labels = new HashMap<>();
    private final Map<String, Integer> idCounts = new HashMap<>();
    private final List<OntologyChangeOperation> operations = new ArrayList<>();
    private final List<NativeOntologyImportItem> items = new ArrayList<>();
    private final Set<String> newConceptIris = new HashSet<>();

    private Plan(
        final Stored stored,
        final OntologyWorkingSnapshot.Snapshot working,
        final SourceFamily family) {
      this.working = working;
      this.family = family;
      conceptNames = lowerCased(stored.conceptNames());
      propertyNames = lowerCased(stored.propertyNames());
      axiomNames = lowerCased(stored.axiomNames());
      stored.concepts().forEach((iri, concept) -> labels.put(iri, shown(concept)));
      stored.properties().forEach((iri, property) -> labels.put(iri, shown(property)));
    }

    private static Set<String> lowerCased(final Set<String> names) {
      return names.stream()
          .filter(Objects::nonNull)
          .map(name -> name.toLowerCase(Locale.ROOT))
          .collect(Collectors.toCollection(HashSet::new));
    }

    private CreateOntologyChangeSet of(final Outcomes outcomes) {
      outcomes.concepts().forEach(outcome -> remember(outcome));
      outcomes.concepts().stream()
          .filter(Added.class::isInstance)
          .forEach(
              outcome -> newConceptIris.add(iriOf(((Added<OntologyConcept>) outcome).parsed())));
      outcomes.properties().forEach(outcome -> remember(outcome));
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

    /** Items in listing order, each warned when applying it would create a disjointness clash. */
    private List<NativeOntologyImportItem> itemsWithClashes() {
      final Map<UUID, OntologyDefinition> after = new LinkedHashMap<>();
      final List<OntologyDefinition> before =
          working.entries().stream().map(OntologyWorkingSnapshot.Entry::definition).toList();
      before.forEach(definition -> after.put(definition.getId(), definition));
      operations.forEach(
          operation ->
              Stream.of(operation.getConcept(), operation.getProperty(), operation.getAxiom())
                  .filter(Objects::nonNull)
                  .forEach(definition -> after.put(definition.getId(), definition)));
      final Set<String> existing =
          OntologyDisjointnessClashes.find(before).stream()
              .map(Plan::clashKey)
              .collect(Collectors.toSet());
      for (final OntologyDisjointnessClashes.Clash clash :
          OntologyDisjointnessClashes.find(new ArrayList<>(after.values()))) {
        if (!existing.contains(clashKey(clash))) {
          warn(clash);
        }
      }
      return items;
    }

    private static String clashKey(final OntologyDisjointnessClashes.Clash clash) {
      return clash.subject().getIri() + "|" + clash.first() + "|" + clash.second();
    }

    private void warn(final OntologyDisjointnessClashes.Clash clash) {
      final Set<String> involved =
          new HashSet<>(
              List.of(clash.subject().getIri().toString(), clash.first(), clash.second()));
      for (final NativeOntologyImportItem item : items) {
        final boolean changes =
            item.getStatus() == NativeOntologyImportItemStatus.NEW
                || item.getStatus() == NativeOntologyImportItemStatus.UPDATE;
        final boolean rule = item.getKind() != NativeOntologyImportItemKind.CONCEPT;
        if (changes && rule && item.getIri() != null && involved.contains(item.getIri())) {
          item.setWarning(
              item.getWarning() == null
                  ? clash.message()
                  : item.getWarning() + "; " + clash.message());
          final Set<UUID> ids = new LinkedHashSet<>(item.getConceptIds());
          ids.addAll(clash.conceptIds());
          item.setConceptIds(new ArrayList<>(ids));
        }
      }
    }

    private void remember(final Outcome<? extends OntologyDefinition> outcome) {
      final OntologyDefinition parsed =
          switch (outcome) {
            case Added<?> added -> added.parsed();
            case Updated<?> updated -> updated.proposed();
            case Unchanged<?> unchanged -> unchanged.parsed();
            case Duplicate<?> duplicate -> duplicate.parsed();
            case Rejected<?> rejected -> rejected.parsed();
          };
      labels.putIfAbsent(iriOf(parsed), shown(parsed));
    }

    private void concept(final Outcome<OntologyConcept> outcome) {
      switch (outcome) {
        case Added<OntologyConcept> added -> {
          final OntologyChangeOperation operation =
              operation(OntologyChangeOperationType.UPSERT_CONCEPT, null)
                  .withConcept(identified(added, OntologyConcept.class, conceptNames));
          operations.add(operation);
          items.add(
              item(
                      NativeOntologyImportItemKind.CONCEPT,
                      NativeOntologyImportItemStatus.NEW,
                      added.parsed())
                  .withOperationId(operation.getId()));
        }
        case Updated<OntologyConcept> updated -> {
          final OntologyChangeOperation operation =
              operation(OntologyChangeOperationType.UPSERT_CONCEPT, updated.current())
                  .withConcept(updated.proposed());
          operations.add(operation);
          items.add(
              item(
                      NativeOntologyImportItemKind.CONCEPT,
                      NativeOntologyImportItemStatus.UPDATE,
                      updated.proposed())
                  .withDetail(conceptChanges(updated.current(), updated.proposed()))
                  .withOperationId(operation.getId()));
        }
        case Unchanged<OntologyConcept> same -> items.add(
            item(
                NativeOntologyImportItemKind.CONCEPT,
                NativeOntologyImportItemStatus.ALREADY_EXISTS,
                same.parsed()));
        case Duplicate<OntologyConcept> repeated -> items.add(
            item(
                    NativeOntologyImportItemKind.CONCEPT,
                    NativeOntologyImportItemStatus.DUPLICATE,
                    repeated.parsed())
                .withReason(DUPLICATE_REASON));
        case Rejected<OntologyConcept> rejected -> items.add(
            item(
                    NativeOntologyImportItemKind.CONCEPT,
                    NativeOntologyImportItemStatus.SKIPPED,
                    rejected.parsed())
                .withReason(rejected.reason()));
      }
    }

    private void property(final Outcome<OntologyProperty> outcome) {
      switch (outcome) {
        case Added<OntologyProperty> added -> {
          final List<URI> needs = referencedNewConcepts(added.parsed());
          final OntologyChangeOperation operation =
              operation(OntologyChangeOperationType.UPSERT_PROPERTY, null)
                  .withProperty(identified(added, OntologyProperty.class, propertyNames))
                  .withRequiresConceptIris(needs.isEmpty() ? null : needs);
          operations.add(operation);
          items.add(
              item(
                      NativeOntologyImportItemKind.PROPERTY,
                      NativeOntologyImportItemStatus.NEW,
                      added.parsed())
                  .withDependsOnIris(needs)
                  .withOperationId(operation.getId()));
        }
        case Updated<OntologyProperty> updated -> {
          final List<URI> needs = referencedNewConcepts(updated.proposed());
          final OntologyChangeOperation operation =
              operation(OntologyChangeOperationType.UPSERT_PROPERTY, updated.current())
                  .withProperty(updated.proposed())
                  .withRequiresConceptIris(needs.isEmpty() ? null : needs);
          operations.add(operation);
          items.add(
              item(
                      NativeOntologyImportItemKind.PROPERTY,
                      NativeOntologyImportItemStatus.UPDATE,
                      updated.proposed())
                  .withDetail(propertyChanges(updated.current(), updated.proposed()))
                  .withDependsOnIris(needs)
                  .withOperationId(operation.getId()));
        }
        case Unchanged<OntologyProperty> same -> items.add(
            item(
                NativeOntologyImportItemKind.PROPERTY,
                NativeOntologyImportItemStatus.ALREADY_EXISTS,
                same.parsed()));
        case Duplicate<OntologyProperty> repeated -> items.add(
            item(
                    NativeOntologyImportItemKind.PROPERTY,
                    NativeOntologyImportItemStatus.DUPLICATE,
                    repeated.parsed())
                .withReason(DUPLICATE_REASON));
        case Rejected<OntologyProperty> rejected -> items.add(
            item(
                    NativeOntologyImportItemKind.PROPERTY,
                    NativeOntologyImportItemStatus.SKIPPED,
                    rejected.parsed())
                .withReason(rejected.reason()));
      }
    }

    private void axiom(final Outcome<OntologyAxiom> outcome) {
      // Axioms match by signature, so a changed axiom is a new one and the stored one stays.
      switch (outcome) {
        case Added<OntologyAxiom> added -> {
          final OntologyAxiom axiom =
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
                  .withProvenance(RelationProvenance.IMPORTED);
          final List<URI> needs = referencedNewConcepts(added.parsed());
          final OntologyChangeOperation operation =
              operation(OntologyChangeOperationType.UPSERT_AXIOM, null)
                  .withAxiom(axiom)
                  .withRequiresConceptIris(needs.isEmpty() ? null : needs);
          operations.add(operation);
          items.add(
              axiomItem(NativeOntologyImportItemStatus.NEW, added.parsed(), operation.getId())
                  .withDependsOnIris(needs));
        }
        case Unchanged<OntologyAxiom> same -> items.add(
            axiomItem(NativeOntologyImportItemStatus.ALREADY_EXISTS, same.parsed(), null));
        case Rejected<OntologyAxiom> rejected -> items.add(
            axiomItem(NativeOntologyImportItemStatus.SKIPPED, rejected.parsed(), null)
                .withReason(rejected.reason()));
        case Duplicate<OntologyAxiom> repeated -> items.add(
            axiomItem(NativeOntologyImportItemStatus.DUPLICATE, repeated.parsed(), null)
                .withReason(DUPLICATE_REASON));
        case Updated<OntologyAxiom> ignored -> {}
      }
    }

    /** The concepts this import creates that the axiom states a fact about, in IRI order. */
    private List<URI> referencedNewConcepts(final OntologyAxiom axiom) {
      return newAmong(OntologyConceptReferences.of(axiom));
    }

    /** The concepts this import creates that the property names in its domain or range. */
    private List<URI> referencedNewConcepts(final OntologyProperty property) {
      return newAmong(OntologyConceptReferences.of(property));
    }

    private List<URI> newAmong(final Set<String> referenced) {
      return referenced.stream().filter(newConceptIris::contains).map(URI::create).toList();
    }

    /** Repeats of one id get a numbered suffix, so every id in a preview is unique. */
    private String itemId(final String base) {
      final int seen = idCounts.merge(base, 1, Integer::sum) - 1;
      return seen == 0 ? base : base + "#" + seen;
    }

    private NativeOntologyImportItem item(
        final NativeOntologyImportItemKind kind,
        final NativeOntologyImportItemStatus status,
        final OntologyDefinition definition) {
      return new NativeOntologyImportItem()
          .withId(itemId(kind.value().toLowerCase(Locale.ROOT) + ":" + iriOf(definition)))
          .withKind(kind)
          .withStatus(status)
          .withLabel(shown(definition))
          .withIri(iriOf(definition));
    }

    private NativeOntologyImportItem axiomItem(
        final NativeOntologyImportItemStatus status,
        final OntologyAxiom axiom,
        final UUID operationId) {
      return new NativeOntologyImportItem()
          .withId(
              itemId(
                  "axiom:"
                      + DigestUtils.sha256Hex(NativeOntologyDocument.signature(axiom))
                          .substring(0, ITEM_DIGEST_LENGTH)))
          .withKind(axiomKind(axiom))
          .withStatus(status)
          .withLabel(sentence(axiom))
          .withIri(axiom.getSubjectIri() == null ? null : axiom.getSubjectIri().toString())
          .withOperationId(operationId);
    }

    private <T extends OntologyDefinition> T identified(
        final Added<T> added, final Class<T> type, final Set<String> names) {
      final String name =
          availableName(
              OntologyAxiom.class.equals(type)
                  ? hashedName(added.key())
                  : readableName(added.key()),
              names);
      final T copy = JsonUtils.deepCopy(added.parsed(), type);
      copy.setId(UUID.randomUUID());
      copy.setName(name);
      copy.setFullyQualifiedName(
          FullyQualifiedName.add(working.root().getFullyQualifiedName(), name));
      copy.setOntology(working.root().getEntityReference());
      copy.setVersion(0.1);
      return copy;
    }

    private String sentence(final OntologyAxiom axiom) {
      final String subject = name(axiom.getSubjectIri());
      return switch (axiom.getAxiomType()) {
        case SUBCLASS_OF -> subject + " is a kind of " + expressions(axiom);
        case EQUIVALENT_CLASS -> subject + " is equivalent to " + expressions(axiom);
        case DISJOINT_WITH -> subject + " is disjoint with " + expressions(axiom);
        case CLASS_ASSERTION -> subject + " is a " + expressions(axiom);
        case OBJECT_PROPERTY_ASSERTION -> subject
            + " "
            + name(axiom.getPropertyIri())
            + " "
            + name(axiom.getTargetIri());
        case DATA_PROPERTY_ASSERTION -> subject
            + " "
            + name(axiom.getPropertyIri())
            + " \""
            + axiom.getLiteral().getValue()
            + "\"";
      };
    }

    private String expressions(final OntologyAxiom axiom) {
      return listOrEmpty(axiom.getExpressions()).stream()
          .map(this::expression)
          .collect(Collectors.joining(", "));
    }

    private String expression(final OntologyExpression expression) {
      return switch (expression.getKind()) {
        case NAMED_CLASS -> name(expression.getClassIri());
        case INTERSECTION -> operands(expression, " and ");
        case UNION -> operands(expression, " or ");
        case ONE_OF -> "one of "
            + listOrEmpty(expression.getIndividualIris()).stream()
                .map(this::name)
                .collect(Collectors.joining(", "));
        case RESTRICTION -> name(expression.getPropertyIri())
            + " "
            + expression.getRestrictionKind().value().toLowerCase(Locale.ROOT)
            + (expression.getCardinality() == null ? "" : " " + expression.getCardinality())
            + (expression.getFiller() == null ? "" : " " + expression(expression.getFiller()))
            + (expression.getIndividualIri() == null
                ? ""
                : " " + name(expression.getIndividualIri()))
            + (expression.getLiteral() == null ? "" : " " + expression.getLiteral().getValue());
      };
    }

    private String operands(final OntologyExpression expression, final String joiner) {
      return listOrEmpty(expression.getOperands()).stream()
          .map(this::expression)
          .collect(Collectors.joining(joiner, "(", ")"));
    }

    private String name(final URI iri) {
      return iri == null ? "" : labels.getOrDefault(iri.toString(), localName(iri.toString()));
    }
  }

  private static NativeOntologyImportItemKind axiomKind(final OntologyAxiom axiom) {
    final boolean named =
        listOrEmpty(axiom.getExpressions()).stream()
            .allMatch(
                expression ->
                    expression.getKind()
                        == org.openmetadata.schema.type.OntologyExpressionKind.NAMED_CLASS);
    return switch (axiom.getAxiomType()) {
      case SUBCLASS_OF, CLASS_ASSERTION -> named
          ? NativeOntologyImportItemKind.RELATIONSHIP
          : NativeOntologyImportItemKind.RULE;
      case OBJECT_PROPERTY_ASSERTION, DATA_PROPERTY_ASSERTION -> NativeOntologyImportItemKind
          .RELATIONSHIP;
      case EQUIVALENT_CLASS, DISJOINT_WITH -> NativeOntologyImportItemKind.RULE;
    };
  }

  private static String conceptChanges(final OntologyConcept current, final OntologyConcept next) {
    return changes(
        change("Name", shown(current), shown(next), true),
        change("Description", current.getDescription(), next.getDescription(), true),
        change("Type", current.getConceptType(), next.getConceptType(), false),
        change(
            "Synonyms", setOrEmpty(current.getSynonyms()), setOrEmpty(next.getSynonyms()), false),
        change("Abstract", flag(current.getAbstract()), flag(next.getAbstract()), false),
        change(
            "Mappings",
            mappingKeys(current.getConceptMappings()),
            mappingKeys(next.getConceptMappings()),
            false),
        change(
            "Deprecation",
            flag(current.getDeprecated()) + String.valueOf(current.getReplacedBy()),
            flag(next.getDeprecated()) + String.valueOf(next.getReplacedBy()),
            false));
  }

  private static String propertyChanges(
      final OntologyProperty current, final OntologyProperty next) {
    return changes(
        change("Name", shown(current), shown(next), true),
        change("Description", current.getDescription(), next.getDescription(), true),
        change("Kind", current.getKind(), next.getKind(), false),
        change("Domain", iriSet(current.getDomain()), iriSet(next.getDomain()), false),
        change("Range", iriSet(current.getRange()), iriSet(next.getRange()), false),
        change("Unit", current.getUnit(), next.getUnit(), false),
        change(
            "Characteristics",
            setOrEmpty(current.getCharacteristics()),
            setOrEmpty(next.getCharacteristics()),
            false),
        change("Inverse", iriText(current.getInverse()), iriText(next.getInverse()), false),
        change(
            "Deprecation",
            flag(current.getDeprecated()) + String.valueOf(current.getReplacedBy()),
            flag(next.getDeprecated()) + String.valueOf(next.getReplacedBy()),
            false));
  }

  private static boolean flag(final Boolean value) {
    return Boolean.TRUE.equals(value);
  }

  /** A changed field, with both values when a reader can use them. */
  private static String change(
      final String field, final Object current, final Object next, final boolean showValues) {
    if (Objects.equals(current, next)) {
      return null;
    }
    return showValues
        ? field
            + ": "
            + (current == null ? "none" : current)
            + " → "
            + (next == null ? "none" : next)
        : field;
  }

  private static String changes(final String... changed) {
    return Stream.of(changed).filter(Objects::nonNull).collect(Collectors.joining("; "));
  }

  private static String localName(final String iri) {
    return iri.substring(
        Math.max(iri.lastIndexOf('/'), Math.max(iri.lastIndexOf('#'), iri.lastIndexOf(':'))) + 1);
  }

  private static <T> void unique(final Map<String, T> index, final String iri, final T value) {
    if (index.putIfAbsent(iri, value) != null) {
      throw new BadRequestException("Ontology has a duplicate definition IRI");
    }
  }

  /** Names compare ignoring case, so a database collation cannot see a clash the plan missed. */
  private static String availableName(final String name, final Set<String> used) {
    String candidate = name;
    for (int attempt = 2; !used.add(candidate.toLowerCase(Locale.ROOT)); attempt++) {
      candidate = name + "-" + attempt;
    }
    return candidate;
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

  private static String readableName(final String iri) {
    final String local =
        localName(iri).replaceAll("[^A-Za-z0-9_-]+", "-").replaceAll("^-+|-+$", "");
    return local.isBlank()
        ? "definition"
        : local.substring(0, Math.min(MAX_NAME_LENGTH, local.length()));
  }

  /** Axioms have no name worth reading, so theirs stays a digest of what they state. */
  private static String hashedName(final String key) {
    return "imported-axiom-" + DigestUtils.sha256Hex(key);
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

  /** What a reader calls a definition: its label, else its name, else the end of its IRI. */
  private static String shown(final OntologyDefinition value) {
    if (value.getDisplayName() != null) {
      return value.getDisplayName();
    }
    return value.getName() != null ? value.getName() : localName(iriOf(value));
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
      NativeOntologyDocument.linkInverses(parsed);
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
