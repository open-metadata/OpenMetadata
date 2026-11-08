package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.vocabulary.RDF;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.ontology.OntologyDisjointnessClashes;
import org.openmetadata.service.ontology.OntologyFormatDetector;
import org.openmetadata.service.ontology.OntologyPropertyRules;
import org.openmetadata.service.ontology.OntologyStructureValidator;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Matches the definitions one import source states against a working ontology, counts what would
 * change, and plans the regular native change-set request that applies it.
 */
public final class NativeOntologyRdfImporter {
  public static final int MAX_CHANGED_DEFINITIONS = 1000;
  public static final int MAX_LISTED_ITEMS = 5_000;
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
    return new NativeOntologyRdfReader(model).read();
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
    return new NativeOntologyImportPreview()
        .withSummary(
            listing(summary(source.format(), source.document(), outcomes), plan.itemsWithClashes()))
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
    return listing(summary(source.format(), source.document(), outcomes), items);
  }

  /**
   * Lists at most {@link #MAX_LISTED_ITEMS} items in source order. ALREADY_EXISTS items go first
   * when the budget is short: nothing can be done with them, and the counts still cover them.
   */
  static NativeOntologyImportSummary listing(
      final NativeOntologyImportSummary summary, final List<NativeOntologyImportItem> items) {
    if (items.size() <= MAX_LISTED_ITEMS) {
      return summary.withItems(items).withOmittedItems(0);
    }
    long existingBudget =
        Math.max(
            0,
            MAX_LISTED_ITEMS
                - items.stream()
                    .filter(
                        item -> item.getStatus() != NativeOntologyImportItemStatus.ALREADY_EXISTS)
                    .count());
    final List<NativeOntologyImportItem> listed = new ArrayList<>(MAX_LISTED_ITEMS);
    for (final NativeOntologyImportItem item : items) {
      if (listed.size() == MAX_LISTED_ITEMS) {
        break;
      }
      if (item.getStatus() == NativeOntologyImportItemStatus.ALREADY_EXISTS) {
        if (existingBudget == 0) {
          continue;
        }
        existingBudget--;
      }
      listed.add(item);
    }
    return summary.withItems(listed).withOmittedItems(items.size() - listed.size());
  }

  public CreateOntologyChangeSet reconcile(
      final Model model, final OntologyWorkingSnapshot.Snapshot working) {
    final Stored stored = Stored.index(working);
    final NativeOntologyDocument document = read(model);
    requireApplicable(document, stored, Map.of());
    return plan(reject(classify(document, stored), stored), stored, working, SourceFamily.RDF);
  }

  /**
   * Reconciles checksum-verified bundled content, which a library install job cuts into slices of
   * at most {@link #MAX_CHANGED_DEFINITIONS}, so the whole change is not held to that limit.
   */
  public CreateOntologyChangeSet reconcileUnbounded(
      final Model model, final OntologyWorkingSnapshot.Snapshot working) {
    final Stored stored = Stored.index(working);
    final NativeOntologyDocument document = read(model);
    requireApplicable(document, stored, Map.of());
    return plan(
        reject(classify(document, stored, Integer.MAX_VALUE), stored),
        stored,
        working,
        SourceFamily.RDF);
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
    return classify(document, stored, MAX_CHANGED_DEFINITIONS);
  }

  private static Outcomes classify(
      final NativeOntologyDocument document, final Stored stored, final int maxChanged) {
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
    if (outcomes.changed() > maxChanged) {
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
      final NativeOntologyDocument document,
      final Outcomes outcomes) {
    final NativeOntologyDocument.Header header = document.header();
    return new NativeOntologyImportSummary()
        .withDetectedFormat(format)
        .withOntologyLabel(header == null ? null : header.label())
        .withCounts(counts(outcomes))
        .withSkippedStatements(document.skipped());
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

  /**
   * Refuses what applying the draft would refuse, so a preview never lists what apply rejects.
   * Refusing one definition can strand another that names it, so the check repeats on what is
   * left until nothing more is refused. Concepts are never refused: a stored concept the source
   * touches keeps whatever it already holds, and only what names a concept can be refused.
   */
  private static Outcomes reject(final Outcomes outcomes, final Stored stored) {
    Outcomes current = outcomes;
    int refused = -1;
    while (refused < count(current)) {
      refused = count(current);
      current = refuseWhatApplyWouldRefuse(current, stored);
    }
    return current;
  }

  private static int count(final Outcomes outcomes) {
    return count(outcomes.concepts(), Rejected.class)
        + count(outcomes.properties(), Rejected.class)
        + count(outcomes.axioms(), Rejected.class);
  }

  private static Outcomes refuseWhatApplyWouldRefuse(final Outcomes outcomes, final Stored stored) {
    final Map<Outcome<?>, UUID> candidateIds = new IdentityHashMap<>();
    final List<OntologyDefinition> definitions = afterImport(outcomes, stored, candidateIds);
    final Map<UUID, String> errors =
        OntologyStructureValidator.workingErrors(definitions, new HashSet<>(candidateIds.values()));
    return new Outcomes(
        outcomes.concepts(),
        outcomes.properties().stream()
            .map(outcome -> refuse(outcome, candidateIds, errors))
            .toList(),
        outcomes.axioms().stream().map(outcome -> refuse(outcome, candidateIds, errors)).toList());
  }

  /** The target as applying the surviving outcomes leaves it; each candidate gets a throwaway id. */
  private static List<OntologyDefinition> afterImport(
      final Outcomes outcomes, final Stored stored, final Map<Outcome<?>, UUID> candidateIds) {
    final Map<String, OntologyConcept> concepts = new LinkedHashMap<>(stored.concepts());
    outcomes.concepts().forEach(outcome -> overlay(concepts, outcome, candidateIds));
    final Map<String, OntologyProperty> properties = new LinkedHashMap<>(stored.properties());
    outcomes.properties().forEach(outcome -> overlay(properties, outcome, candidateIds));
    final List<OntologyDefinition> definitions = new ArrayList<>(concepts.values());
    definitions.addAll(properties.values());
    stored.axioms().values().forEach(definitions::addAll);
    outcomes.axioms().stream()
        .filter(Added.class::isInstance)
        .forEach(outcome -> definitions.add(identified(candidate(outcome), outcome, candidateIds)));
    return definitions;
  }

  private static <T extends OntologyDefinition> void overlay(
      final Map<String, T> index,
      final Outcome<T> outcome,
      final Map<Outcome<?>, UUID> candidateIds) {
    final T candidate = candidate(outcome);
    if (candidate != null && !(outcome instanceof Rejected)) {
      index.put(iriOf(candidate), identified(candidate, outcome, candidateIds));
    }
  }

  private static <T extends OntologyDefinition> T candidate(final Outcome<T> outcome) {
    return switch (outcome) {
      case Added<T> added -> added.parsed();
      case Updated<T> updated -> updated.proposed();
      default -> null;
    };
  }

  @SuppressWarnings("unchecked")
  private static <T extends OntologyDefinition> T identified(
      final T candidate, final Outcome<?> outcome, final Map<Outcome<?>, UUID> candidateIds) {
    final T copy = (T) JsonUtils.deepCopy(candidate, candidate.getClass());
    copy.setId(UUID.randomUUID());
    if (copy.getOntology() == null) {
      copy.setOntology(new EntityReference().withId(new UUID(0, 0)).withType(Entity.ONTOLOGY));
    }
    candidateIds.put(outcome, copy.getId());
    return copy;
  }

  private static String iriOf(final OntologyDefinition definition) {
    return definition instanceof OntologyConcept concept
        ? concept.getIri().toString()
        : ((OntologyProperty) definition).getIri().toString();
  }

  private static <T extends OntologyDefinition> Outcome<T> refuse(
      final Outcome<T> outcome,
      final Map<Outcome<?>, UUID> candidateIds,
      final Map<UUID, String> errors) {
    final String error = errors.get(candidateIds.get(outcome));
    return error == null ? outcome : new Rejected<>(candidate(outcome), error);
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
      final Set<String> referenced = new TreeSet<>();
      collectIris(axiom.getSubjectIri(), referenced);
      collectIris(axiom.getTargetIri(), referenced);
      listOrEmpty(axiom.getExpressions())
          .forEach(expression -> collectIris(expression, referenced));
      referenced.retainAll(newConceptIris);
      return referenced.stream().map(URI::create).toList();
    }

    /** The concepts this import creates that the property names in its domain or range. */
    private List<URI> referencedNewConcepts(final OntologyProperty property) {
      final Set<String> referenced = new TreeSet<>();
      listOrEmpty(property.getDomain()).forEach(iri -> collectIris(iri, referenced));
      listOrEmpty(property.getRange()).forEach(iri -> collectIris(iri, referenced));
      referenced.retainAll(newConceptIris);
      return referenced.stream().map(URI::create).toList();
    }

    private static void collectIris(final URI iri, final Set<String> into) {
      if (iri != null) {
        into.add(iri.toString());
      }
    }

    private static void collectIris(final OntologyExpression expression, final Set<String> into) {
      if (expression == null) {
        return;
      }
      collectIris(expression.getClassIri(), into);
      collectIris(expression.getIndividualIri(), into);
      listOrEmpty(expression.getIndividualIris()).forEach(iri -> collectIris(iri, into));
      listOrEmpty(expression.getOperands()).forEach(operand -> collectIris(operand, into));
      collectIris(expression.getFiller(), into);
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
}
