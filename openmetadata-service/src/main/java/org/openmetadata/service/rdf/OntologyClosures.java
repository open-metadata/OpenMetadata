/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.google.common.collect.Iterators;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Consumer;
import org.openmetadata.schema.api.rdf.RdfOntologyCandidate;
import org.openmetadata.schema.api.rdf.RdfOntologyCandidateOutcome;
import org.openmetadata.schema.api.rdf.RdfOntologyClosure;
import org.openmetadata.schema.api.rdf.RdfOntologyClosureProblem;
import org.openmetadata.schema.api.rdf.RdfOntologyClosureProblemCode;
import org.openmetadata.schema.api.rdf.RdfOntologyExclusion;
import org.openmetadata.schema.api.rdf.RdfOntologyExclusionReason;
import org.openmetadata.schema.api.rdf.RdfOntologyImportedVersion;
import org.openmetadata.schema.api.rdf.RdfOntologyMemberCounts;
import org.openmetadata.schema.api.rdf.RdfOntologyReasoningStatus;
import org.openmetadata.schema.api.rdf.RdfOntologySelection;
import org.openmetadata.schema.api.rdf.RdfReasoningCheck;
import org.openmetadata.schema.api.rdf.RdfReasoningCheckKind;
import org.openmetadata.schema.api.rdf.RdfReasoningJobRequest;
import org.openmetadata.schema.api.rdf.RdfReasoningOperation;
import org.openmetadata.schema.api.rdf.RdfSourceRevision;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.Entity;

/**
 * Selects, digests and publishes the ontology closures reasoning reads. A glossary's closure is the
 * graphs of its Approved axioms and terms, the relationship-type graphs they use, and the pinned
 * closures of the glossaries it imports. Draft and In Review graphs stay projected, so the serving
 * data says what was authored, but only a candidate closure, which never becomes active, includes
 * them.
 *
 * <p>Membership is read from the member records written with each graph (see {@link
 * OntologyGraphMember}), a page at a time in graph-IRI order, so a closure of any size is digested
 * and published without holding it in memory. A version manifest is a content-addressed graph
 * named after the closure digest; activation points a glossary at one.
 *
 * <p>See ADR:2026-10-15-reasoning-closures-are-approved-graphs-pinned-by-a-content-manifest.
 */
public final class OntologyClosures {
  static final String DIGEST_ALGORITHM = "om-closure-v2";
  static final int PAGE_SIZE = 2000;
  static final int MAX_CANDIDATE_ENTITIES = 10_000;
  static final int MAX_LISTED_CANDIDATES = 1000;
  static final int RETAINED_CANDIDATE_MANIFESTS = 32;
  static final Duration MANIFEST_GRACE = Duration.ofMinutes(10);
  private static final int LOOKUP_BATCH = 500;
  private static final int MAX_MANIFESTS_LISTED = 10_000;
  private static final String APPROVED = EntityStatus.APPROVED.value();
  private static final Set<String> CANDIDATE_STATUSES =
      Set.of(EntityStatus.DRAFT.value(), EntityStatus.IN_REVIEW.value());
  private static final String RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  private static final String OWL = "http://www.w3.org/2002/07/owl#";
  private static final String XSD = "http://www.w3.org/2001/XMLSchema#";
  private static final int MAX_LISTED_UNDIGESTED = 10;

  /** A member record whose digest the current graph digest algorithm computed. */
  private static final String DIGESTED =
      " omr:contentDigest ?d ; omr:digestAlgorithm \""
          + OntologyGraphCanonicalForm.ALGORITHM
          + "\" ";

  /** SPARQL access to the serving dataset. */
  public interface Store {
    /** Rows of a SELECT, each variable bound to its IRI or lexical form; fails rather than guess. */
    List<Map<String, String>> select(String query);

    boolean ask(String query);

    void update(String update);
  }

  /** The metadata a closure reads beyond the store. */
  public interface Metadata {
    /** A glossary that is not deleted, with its ontology configuration. */
    Optional<Glossary> glossary(UUID glossaryId);

    long approvedAxiomCount(UUID glossaryId);

    long approvedTermCount(Glossary glossary);

    /** False while live projection is degraded, so the store may be missing writes. */
    boolean projectionReady();

    /** The serving revision a reasoning job would read, or empty when it cannot be read. */
    Optional<RdfSourceRevision> sourceRevision();
  }

  /**
   * Publication or activation was refused; the closure carries the problems. Activation is refused
   * for any problem; a candidate only for those that leave a manifest unable to pin its closure.
   */
  public static final class PublicationRefusedException extends RuntimeException {
    private final transient RdfOntologyClosure closure;

    PublicationRefusedException(final String what, final RdfOntologyClosure closure) {
      super(
          "Ontology closure cannot be "
              + what
              + ": "
              + closure.getProblems().size()
              + " problem(s)");
      this.closure = closure;
    }

    public RdfOntologyClosure closure() {
      return closure;
    }
  }

  /** Member records changed while a manifest was written; publishing again reads the new state. */
  public static final class ClosureChangedException extends RuntimeException {
    ClosureChangedException(final String glossaryIri) {
      super("The ontology closure of " + glossaryIri + " changed while its manifest was written");
    }
  }

  private static final ReentrantLock PUBLICATION = new ReentrantLock();

  private final String baseUri;
  private final URI base;
  private final Store store;
  private final Metadata metadata;
  private final Clock clock;
  private final String members;
  private final String activations;
  private final int pageSize;

  public OntologyClosures(
      final URI baseUri, final Store store, final Metadata metadata, final Clock clock) {
    this(baseUri, store, metadata, clock, PAGE_SIZE);
  }

  OntologyClosures(
      final URI baseUri,
      final Store store,
      final Metadata metadata,
      final Clock clock,
      final int pageSize) {
    this.pageSize = pageSize;
    this.base = baseUri;
    this.baseUri = baseUri.toString();
    this.store = store;
    this.metadata = metadata;
    this.clock = clock;
    this.members = OntologyGraphs.membersGraph(this.baseUri);
    this.activations = OntologyGraphs.activationsGraph(this.baseUri);
  }

  /** The glossary's Approved closure as it stands, without writing anything. */
  public Optional<RdfOntologyClosure> approved(final UUID glossaryId) {
    return metadata
        .glossary(glossaryId)
        .map(glossary -> describe(compute(glossary, Overlay.NONE, new HashMap<>()), true));
  }

  /**
   * Publishes the Approved closure of the glossary and of everything it imports, and makes each
   * the glossary's active version. Refused when any closure has a problem.
   */
  public Optional<RdfOntologyClosure> activate(final UUID glossaryId) {
    final Optional<Glossary> glossary = metadata.glossary(glossaryId);
    if (glossary.isEmpty()) {
      return Optional.empty();
    }
    PUBLICATION.lock();
    try {
      final Node root = compute(glossary.get(), Overlay.NONE, new HashMap<>());
      if (!root.allProblems().isEmpty()) {
        throw new PublicationRefusedException("activated", describe(root, true));
      }
      publish(root, new HashSet<>());
      activateAll(root, new HashSet<>());
      sweepManifests();
      return Optional.of(describe(root, true));
    } finally {
      PUBLICATION.unlock();
    }
  }

  /**
   * Publishes a candidate closure: the Approved closure with the Draft and In Review graphs of
   * these entities added, in whichever glossary of the closure owns them. Production is untouched:
   * no activation changes, and the candidate's manifest is a separate graph. The result carries the
   * CHECK request that asks the store whether the candidate is consistent. Refused, like activation,
   * when an import is missing, imports form a cycle, or a graph has no current digest, since its
   * manifest could not pin that closure. See
   * ADR:2026-10-15-candidate-checks-add-draft-graphs-to-the-approved-closure.
   */
  public Optional<RdfOntologyClosure> candidate(
      final UUID glossaryId, final Collection<UUID> entityIds) {
    final Optional<Glossary> glossary = metadata.glossary(glossaryId);
    if (glossary.isEmpty()) {
      return Optional.empty();
    }
    final Set<UUID> requested = new LinkedHashSet<>(entityIds);
    if (requested.size() > MAX_CANDIDATE_ENTITIES) {
      throw new IllegalArgumentException(
          "A candidate check takes at most " + MAX_CANDIDATE_ENTITIES + " entities");
    }
    final Overlay overlay = lookUpCandidates(requested);
    PUBLICATION.lock();
    try {
      final Node root = compute(glossary.get(), overlay, new HashMap<>());
      if (root.unpinnable()) {
        throw new PublicationRefusedException("published", describe(root, false));
      }
      publish(root, new HashSet<>());
      sweepManifests();
      final RdfOntologyClosure closure = describe(root, false);
      closure.setCandidates(overlay.report(MAX_LISTED_CANDIDATES));
      closure.setCandidateCount(overlay.includedCount());
      metadata
          .sourceRevision()
          .ifPresent(revision -> closure.setCheckRequest(check(root, revision)));
      return Optional.of(closure);
    } finally {
      PUBLICATION.unlock();
    }
  }

  /** Approved and excluded graph counts across every glossary, and the active closures. */
  public RdfOntologyReasoningStatus status() {
    final Counts counts = new Counts();
    for (final Map<String, String> row :
        store.select(
            prefixes()
                + "SELECT ?t ?s (COUNT(?g) AS ?n) WHERE { GRAPH <"
                + members
                + "> { ?g omr:entityType ?t . OPTIONAL { ?g omr:lifecycleStatus ?s } } } "
                + "GROUP BY ?t ?s")) {
      counts.add(row.get("t"), row.get("s"), Long.parseLong(row.get("n")), true);
    }
    final List<Map<String, String>> active =
        store.select(
            prefixes()
                + "SELECT (COUNT(DISTINCT ?gl) AS ?n) WHERE { GRAPH <"
                + activations
                + "> { ?gl omr:activeManifest ?m } }");
    return new RdfOntologyReasoningStatus()
        .withIncluded(counts.included())
        .withExcluded(counts.excluded())
        .withActiveOntologies(active.isEmpty() ? 0L : Long.parseLong(active.getFirst().get("n")));
  }

  // ---------------------------------------------------------------------------------------------
  // Computing a closure

  /** One glossary's closure, computed once per request even when imported twice. */
  private record Node(
      Glossary glossary,
      String glossaryIri,
      String ontologyIri,
      RdfOntologySelection selection,
      String digest,
      long memberCount,
      RdfOntologyMemberCounts included,
      List<RdfOntologyExclusion> excluded,
      List<Node> imports,
      List<String> importLines,
      List<RdfOntologyClosureProblem> problems,
      boolean pinsAll,
      SortedMap<String, String> typeGraphs,
      SortedMap<String, String> candidateGraphs) {

    String hex() {
      return OntologyGraphDigest.hex(digest);
    }

    List<RdfOntologyClosureProblem> allProblems() {
      final List<RdfOntologyClosureProblem> all = new ArrayList<>(problems);
      imports.forEach(imported -> all.addAll(imported.allProblems()));
      return all;
    }

    /**
     * A missing import, an import cycle or a graph without a current digest: the closure digest
     * records none of them, so no manifest of this closure can be published.
     */
    boolean unpinnable() {
      return !pinsAll || imports.stream().anyMatch(Node::unpinnable);
    }
  }

  private Node compute(final Glossary glossary, final Overlay overlay, final Map<UUID, Node> done) {
    return compute(glossary, overlay, done, new ArrayDeque<>());
  }

  private Node compute(
      final Glossary glossary,
      final Overlay overlay,
      final Map<UUID, Node> done,
      final Deque<UUID> path) {
    final Node known = done.get(glossary.getId());
    if (known != null) {
      return known;
    }
    path.push(glossary.getId());
    final String glossaryIri = GlossaryOntologyIri.entityIri(glossary.getId(), base);
    final List<RdfOntologyClosureProblem> problems = new ArrayList<>();
    final List<Node> imports = new ArrayList<>();
    final List<String> importLines = new ArrayList<>();
    boolean pinsAll = true;
    for (final EntityReference imported : imports(glossary)) {
      if (path.contains(imported.getId())) {
        problems.add(problem(RdfOntologyClosureProblemCode.IMPORT_CYCLE, glossary, imported));
        pinsAll = false;
        continue;
      }
      final Optional<Glossary> target = metadata.glossary(imported.getId());
      if (target.isEmpty()) {
        problems.add(problem(RdfOntologyClosureProblemCode.MISSING_IMPORT, glossary, imported));
        pinsAll = false;
        continue;
      }
      final Node node = compute(target.get(), overlay, done, path);
      imports.add(node);
      importLines.add("import <" + node.ontologyIri() + "> " + node.digest());
    }
    path.pop();

    final SortedMap<String, String> candidates = overlay.take(glossaryIri);
    final Set<String> undigested = new TreeSet<>();
    final SortedMap<String, String> types =
        typeGraphs(glossaryIri, candidates.keySet(), undigested);
    final Counts counts = counts(glossaryIri);
    counts.relationshipTypes = types.size();
    counts.addCandidates(candidates.keySet(), baseUri);
    problems.addAll(completeness(glossary, counts));
    undigested.addAll(undigestedApproved(glossaryIri));
    if (!undigested.isEmpty()) {
      problems.add(undigestedProblem(glossary, undigested));
      pinsAll = false;
    }
    if (path.isEmpty() && !metadata.projectionReady()) {
      problems.add(
          new RdfOntologyClosureProblem()
              .withCode(RdfOntologyClosureProblemCode.PROJECTION_NOT_READY)
              .withMessage(
                  "Live RDF projection is degraded; the store may be missing ontology graphs"));
    }

    final boolean isCandidate =
        !candidates.isEmpty()
            || imports.stream()
                .anyMatch(node -> node.selection() == RdfOntologySelection.CANDIDATE);
    final RdfOntologySelection selection =
        isCandidate ? RdfOntologySelection.CANDIDATE : RdfOntologySelection.APPROVED;
    final String ontologyIri = GlossaryOntologyIri.of(glossary, base);
    final ClosureDigest digest = new ClosureDigest(ontologyIri, glossaryIri, selection);
    forEachMember(glossaryIri, types, candidates, digest::member);
    importLines.sort(Comparator.naturalOrder());
    importLines.forEach(digest::line);

    final Node node =
        new Node(
            glossary,
            glossaryIri,
            ontologyIri,
            selection,
            digest.finish(),
            digest.members,
            counts.included(),
            counts.excluded(),
            List.copyOf(imports),
            List.copyOf(importLines),
            List.copyOf(problems),
            pinsAll,
            types,
            candidates);
    done.put(glossary.getId(), node);
    return node;
  }

  private static List<EntityReference> imports(final Glossary glossary) {
    final List<EntityReference> imports =
        new ArrayList<>(
            glossary.getOntologyConfiguration() == null
                ? List.of()
                : listOrEmpty(glossary.getOntologyConfiguration().getImports()));
    imports.sort(Comparator.comparing(reference -> reference.getId().toString()));
    return imports;
  }

  private static RdfOntologyClosureProblem problem(
      final RdfOntologyClosureProblemCode code,
      final Glossary importer,
      final EntityReference imported) {
    final String verb =
        code == RdfOntologyClosureProblemCode.IMPORT_CYCLE
            ? " imports itself through "
            : " imports a glossary that does not exist: ";
    return new RdfOntologyClosureProblem()
        .withCode(code)
        .withGlossary(importer.getEntityReference())
        .withMessage(
            "Glossary " + importer.getFullyQualifiedName() + verb + describeReference(imported));
  }

  private static String describeReference(final EntityReference reference) {
    return reference.getFullyQualifiedName() != null
        ? reference.getFullyQualifiedName()
        : reference.getId().toString();
  }

  /** The metadata and the store disagree on how many graphs are Approved. */
  private List<RdfOntologyClosureProblem> completeness(
      final Glossary glossary, final Counts counts) {
    final List<RdfOntologyClosureProblem> problems = new ArrayList<>();
    final long axioms = metadata.approvedAxiomCount(glossary.getId());
    final long terms = metadata.approvedTermCount(glossary);
    if (axioms != counts.approvedAxioms || terms != counts.approvedTerms) {
      problems.add(
          new RdfOntologyClosureProblem()
              .withCode(RdfOntologyClosureProblemCode.INCOMPLETE_PROJECTION)
              .withGlossary(glossary.getEntityReference())
              .withMessage(
                  String.format(
                      "Glossary %s has %d Approved axioms and %d Approved terms, but the RDF store"
                          + " holds %d and %d; wait for live projection or run RdfIndexApp",
                      glossary.getFullyQualifiedName(),
                      axioms,
                      terms,
                      counts.approvedAxioms,
                      counts.approvedTerms)));
    }
    return problems;
  }

  /**
   * Approved graphs of the glossary whose record has no {@value
   * OntologyGraphCanonicalForm#ALGORITHM} digest: written by an earlier build, or with blank nodes
   * too symmetric to canonicalize. At most {@value #MAX_LISTED_UNDIGESTED} plus one are read.
   */
  private List<String> undigestedApproved(final String glossaryIri) {
    return store
        .select(
            prefixes()
                + "SELECT ?g WHERE { GRAPH <"
                + members
                + "> { ?g omr:glossary <"
                + glossaryIri
                + "> ; omr:lifecycleStatus \""
                + APPROVED
                + "\" FILTER NOT EXISTS { ?g"
                + DIGESTED
                + "} } } ORDER BY STR(?g) LIMIT "
                + (MAX_LISTED_UNDIGESTED + 1))
        .stream()
        .map(row -> row.get("g"))
        .toList();
  }

  private static RdfOntologyClosureProblem undigestedProblem(
      final Glossary glossary, final Set<String> graphs) {
    final List<String> listed = graphs.stream().limit(MAX_LISTED_UNDIGESTED).toList();
    return new RdfOntologyClosureProblem()
        .withCode(RdfOntologyClosureProblemCode.INCOMPLETE_PROJECTION)
        .withGlossary(glossary.getEntityReference())
        .withMessage(
            "Glossary "
                + glossary.getFullyQualifiedName()
                + " needs graphs that have no "
                + OntologyGraphCanonicalForm.ALGORITHM
                + " digest, so no manifest can pin them: "
                + String.join(", ", listed)
                + (graphs.size() > listed.size() ? ", and more" : "")
                + ". Run RdfIndexApp to digest graphs an earlier version wrote; a graph that still"
                + " has none has blank nodes too symmetric to canonicalize");
  }

  /** Member records of the glossary grouped by entity type and status. */
  private Counts counts(final String glossaryIri) {
    final Counts counts = new Counts();
    for (final Map<String, String> row :
        store.select(
            prefixes()
                + "SELECT ?t ?s (COUNT(?g) AS ?n) WHERE { GRAPH <"
                + members
                + "> { ?g omr:glossary <"
                + glossaryIri
                + "> ; omr:entityType ?t . OPTIONAL { ?g omr:lifecycleStatus ?s } } } "
                + "GROUP BY ?t ?s")) {
      counts.add(row.get("t"), row.get("s"), Long.parseLong(row.get("n")), false);
    }
    return counts;
  }

  /**
   * Relationship-type graphs that define a property the glossary's Approved members or its
   * candidates use, and the types those types' axioms name in turn. A used type graph without a
   * current digest goes to {@code undigested} instead.
   */
  private SortedMap<String, String> typeGraphs(
      final String glossaryIri, final Set<String> candidateGraphs, final Set<String> undigested) {
    final SortedMap<String, String> types = new TreeMap<>();
    addTypeRows(
        types,
        undigested,
        "SELECT DISTINCT ?tg ?d WHERE { GRAPH <"
            + members
            + "> { ?g omr:glossary <"
            + glossaryIri
            + "> ; omr:lifecycleStatus \""
            + APPROVED
            + "\" ; omr:usesProperty ?p . ?tg omr:definesProperty ?p . OPTIONAL { ?tg"
            + DIGESTED
            + "} } }");
    Set<String> frontier = new TreeSet<>(types.keySet());
    frontier.addAll(candidateGraphs);
    while (!frontier.isEmpty()) {
      final Set<String> before = new HashSet<>(types.keySet());
      for (final List<String> batch : batches(frontier)) {
        addTypeRows(
            types,
            undigested,
            "SELECT DISTINCT ?tg ?d WHERE { VALUES ?g { "
                + iris(batch)
                + " } GRAPH <"
                + members
                + "> { ?g omr:usesProperty ?p . ?tg omr:definesProperty ?p . OPTIONAL { ?tg"
                + DIGESTED
                + "} } }");
      }
      frontier = new TreeSet<>(types.keySet());
      frontier.removeAll(before);
    }
    return types;
  }

  private void addTypeRows(
      final SortedMap<String, String> types, final Set<String> undigested, final String query) {
    for (final Map<String, String> row : store.select(prefixes() + query)) {
      if (row.get("d") == null) {
        undigested.add(row.get("tg"));
      } else {
        types.put(row.get("tg"), row.get("d"));
      }
    }
  }

  /**
   * Visits every graph the manifest pins directly, in graph-IRI order: the Approved members read a
   * page at a time, merged with the type and candidate graphs.
   */
  private void forEachMember(
      final String glossaryIri,
      final SortedMap<String, String> types,
      final SortedMap<String, String> candidates,
      final Consumer<Member> visitor) {
    final List<Iterator<Member>> sources =
        List.of(
            new ApprovedMembers(glossaryIri),
            members(types, MemberKind.RELATIONSHIP_TYPE),
            members(candidates, MemberKind.CANDIDATE));
    final Iterator<Member> merged =
        Iterators.mergeSorted(sources, Comparator.comparing(Member::graph));
    String previous = null;
    while (merged.hasNext()) {
      final Member member = merged.next();
      if (member.graph().equals(previous)) {
        continue;
      }
      visitor.accept(member);
      previous = member.graph();
    }
  }

  private enum MemberKind {
    APPROVED,
    RELATIONSHIP_TYPE,
    CANDIDATE
  }

  private record Member(String graph, String digest, MemberKind kind) {}

  private static Iterator<Member> members(
      final SortedMap<String, String> graphs, final MemberKind kind) {
    return graphs.entrySet().stream()
        .map(entry -> new Member(entry.getKey(), entry.getValue(), kind))
        .iterator();
  }

  /**
   * The glossary's Approved member records in graph-IRI order, fetched {@link #PAGE_SIZE} at a time
   * after the last IRI seen. The IRIs are ASCII, where SPARQL string order and Java's agree; the
   * order is checked anyway, since a digest over misordered lines would differ between runs.
   */
  private final class ApprovedMembers implements Iterator<Member> {
    private final String glossaryIri;
    private Iterator<Map<String, String>> page = List.<Map<String, String>>of().iterator();
    private String last = "";
    private boolean exhausted;

    private ApprovedMembers(final String glossaryIri) {
      this.glossaryIri = glossaryIri;
    }

    @Override
    public boolean hasNext() {
      if (!page.hasNext() && !exhausted) {
        final List<Map<String, String>> rows = fetch();
        exhausted = rows.size() < pageSize;
        page = rows.iterator();
      }
      return page.hasNext();
    }

    @Override
    public Member next() {
      if (!hasNext()) {
        throw new NoSuchElementException();
      }
      final Map<String, String> row = page.next();
      final String graph = row.get("g");
      if (graph.compareTo(last) <= 0) {
        throw new IllegalStateException("Member records arrived out of order at " + graph);
      }
      last = graph;
      return new Member(graph, row.get("d"), MemberKind.APPROVED);
    }

    private List<Map<String, String>> fetch() {
      return store.select(
          prefixes()
              + "SELECT ?g ?d WHERE { GRAPH <"
              + members
              + "> { ?g omr:glossary <"
              + glossaryIri
              + "> ; omr:lifecycleStatus \""
              + APPROVED
              + "\" ;"
              + DIGESTED
              + "} FILTER(STR(?g) > \""
              + last
              + "\") } ORDER BY STR(?g) LIMIT "
              + pageSize);
    }
  }

  /**
   * The closure digest, version {@value #DIGEST_ALGORITHM}: SHA-256 over UTF-8 lines, each ending
   * in a newline: the algorithm name; {@code ontology <iri>}; {@code glossary <iri>}; {@code
   * selection APPROVED|CANDIDATE}; one {@code member <graph> <digest>} per pinned graph in graph-IRI
   * order; then one {@code import <ontology> <closure digest>} per import, sorted. Member digests
   * are {@value OntologyGraphCanonicalForm#ALGORITHM} graph digests. A missing import or an import
   * cycle has no line: such a closure is never published (see {@link Node#unpinnable()}).
   */
  static final class ClosureDigest {
    private final MessageDigest sha256 = OntologyGraphDigest.newSha256();
    private long members;

    ClosureDigest(
        final String ontologyIri, final String glossaryIri, final RdfOntologySelection selection) {
      line(DIGEST_ALGORITHM);
      line("ontology <" + ontologyIri + ">");
      line("glossary <" + glossaryIri + ">");
      line("selection " + selection.value());
    }

    void line(final String line) {
      sha256.update((line + "\n").getBytes(StandardCharsets.UTF_8));
    }

    private void member(final Member member) {
      line("member <" + member.graph() + "> " + member.digest());
      members++;
    }

    String finish() {
      return OntologyGraphDigest.PREFIX + HexFormat.of().formatHex(sha256.digest());
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Publishing manifests

  private String manifestGraph(final Node node) {
    return OntologyGraphs.manifestGraphPrefix(baseUri) + node.hex();
  }

  /** The version IRI is the ontology IRI with the selection and closure digest appended. */
  static String versionIri(
      final String ontologyIri, final RdfOntologySelection selection, final String digest) {
    String stem = ontologyIri;
    while (stem.endsWith("/") || stem.endsWith("#")) {
      stem = stem.substring(0, stem.length() - 1);
    }
    final String segment =
        selection == RdfOntologySelection.CANDIDATE ? "/candidate/" : "/version/";
    return stem + segment + OntologyGraphDigest.hex(digest);
  }

  private String versionIri(final Node node) {
    return versionIri(node.ontologyIri(), node.selection(), node.digest());
  }

  private boolean isPublished(final Node node) {
    return store.ask(
        prefixes()
            + "ASK { GRAPH <"
            + manifestGraph(node)
            + "> { ?v omr:closureDigest \""
            + node.digest()
            + "\" } }");
  }

  private boolean isActive(final Node node) {
    return store.ask(
        prefixes()
            + "ASK { GRAPH <"
            + activations
            + "> { <"
            + node.glossaryIri()
            + "> omr:activeManifest <"
            + manifestGraph(node)
            + "> } }");
  }

  /**
   * Writes the manifests of the node and its imports that the store does not hold. Members go to a
   * staging graph page by page while the digest is recomputed; the last update moves the staging
   * graph into place and adds the header, so a manifest is never seen without its header or the
   * header without its members.
   */
  private void publish(final Node node, final Set<String> visited) {
    if (!visited.add(node.glossaryIri())) {
      return;
    }
    node.imports().forEach(imported -> publish(imported, visited));
    if (isPublished(node)) {
      return;
    }
    final String staging = OntologyGraphs.manifestStagingGraph(baseUri, UUID.randomUUID());
    final String versionIri = versionIri(node);
    try {
      final ClosureDigest digest =
          new ClosureDigest(node.ontologyIri(), node.glossaryIri(), node.selection());
      final StringBuilder chunk = new StringBuilder();
      final long[] pending = {0};
      forEachMember(
          node.glossaryIri(),
          node.typeGraphs(),
          node.candidateGraphs(),
          member -> {
            digest.member(member);
            chunk
                .append('<')
                .append(member.graph())
                .append("> omr:pinnedDigest \"")
                .append(member.digest())
                .append("\" .\n");
            if (member.kind() == MemberKind.CANDIDATE) {
              chunk
                  .append('<')
                  .append(versionIri)
                  .append("> omr:candidateGraph <")
                  .append(member.graph())
                  .append("> .\n");
            }
            if (++pending[0] >= pageSize) {
              insert(staging, chunk);
              pending[0] = 0;
            }
          });
      insert(staging, chunk);
      node.importLines().forEach(digest::line);
      if (!digest.finish().equals(node.digest())) {
        throw new ClosureChangedException(node.glossaryIri());
      }
      store.update(
          prefixes()
              + "MOVE SILENT GRAPH <"
              + staging
              + "> TO <"
              + manifestGraph(node)
              + "> ;\nINSERT DATA { GRAPH <"
              + manifestGraph(node)
              + "> {\n"
              + header(node, versionIri)
              + "} }");
    } finally {
      store.update(OntologyGraphs.dropUpdate(staging));
    }
  }

  private void insert(final String graph, final StringBuilder triples) {
    if (!triples.isEmpty()) {
      store.update(prefixes() + "INSERT DATA { GRAPH <" + graph + "> {\n" + triples + "} }");
      triples.setLength(0);
    }
  }

  private String header(final Node node, final String versionIri) {
    final StringBuilder header = new StringBuilder();
    header
        .append('<')
        .append(node.ontologyIri())
        .append("> <")
        .append(RDF_TYPE)
        .append("> <")
        .append(OWL)
        .append("Ontology> ; <")
        .append(OWL)
        .append("versionIRI> <")
        .append(versionIri)
        .append("> .\n");
    for (final Node imported : node.imports()) {
      header
          .append('<')
          .append(node.ontologyIri())
          .append("> <")
          .append(OWL)
          .append("imports> <")
          .append(versionIri(imported))
          .append("> .\n");
    }
    header
        .append('<')
        .append(versionIri)
        .append("> a omr:OntologyVersion ; omr:ontology <")
        .append(node.ontologyIri())
        .append("> ; omr:glossary <")
        .append(node.glossaryIri())
        .append("> ; omr:selection \"")
        .append(node.selection().value())
        .append("\" ; omr:closureDigest \"")
        .append(node.digest())
        .append("\" ; omr:digestAlgorithm \"")
        .append(DIGEST_ALGORITHM)
        .append("\" ; omr:memberCount ")
        .append(node.memberCount())
        .append(" ; omr:createdAt \"")
        .append(Instant.now(clock))
        .append("\"^^<")
        .append(XSD)
        .append("dateTime> .\n");
    for (final Node imported : node.imports()) {
      header
          .append('<')
          .append(versionIri)
          .append("> omr:importsManifest <")
          .append(manifestGraph(imported))
          .append("> .\n");
    }
    return header.toString();
  }

  /** Points each glossary of an Approved closure at its manifest, one update per glossary. */
  private void activateAll(final Node node, final Set<String> visited) {
    if (!visited.add(node.glossaryIri())) {
      return;
    }
    node.imports().forEach(imported -> activateAll(imported, visited));
    final String glossary = "<" + node.glossaryIri() + ">";
    store.update(
        prefixes()
            + "DELETE WHERE { GRAPH <"
            + activations
            + "> { "
            + glossary
            + " ?p ?o } } ;\nINSERT DATA { GRAPH <"
            + activations
            + "> { "
            + glossary
            + " omr:activeManifest <"
            + manifestGraph(node)
            + "> ; omr:activeVersion <"
            + versionIri(node)
            + "> ; omr:ontology <"
            + node.ontologyIri()
            + "> ; omr:closureDigest \""
            + node.digest()
            + "\" } }");
  }

  /**
   * Drops manifests nothing needs: not active, not among the newest candidates, and not imported
   * by one that is kept. A manifest younger than {@link #MANIFEST_GRACE} is always kept, so a
   * concurrent publication on another server is not swept before it is activated.
   */
  private void sweepManifests() {
    final String prefix = OntologyGraphs.manifestGraphPrefix(baseUri);
    final Map<String, Instant> approved = new HashMap<>();
    final List<Map.Entry<String, Instant>> candidates = new ArrayList<>();
    for (final Map<String, String> row :
        store.select(
            prefixes()
                + "SELECT ?m ?sel ?created WHERE { GRAPH ?m { ?v a omr:OntologyVersion ; "
                + "omr:selection ?sel ; omr:createdAt ?created } FILTER(STRSTARTS(STR(?m), \""
                + prefix
                + "\")) } LIMIT "
                + MAX_MANIFESTS_LISTED)) {
      final Instant created = Instant.parse(row.get("created"));
      if (RdfOntologySelection.CANDIDATE.value().equals(row.get("sel"))) {
        candidates.add(Map.entry(row.get("m"), created));
      } else {
        approved.put(row.get("m"), created);
      }
    }
    final Instant graceStart = Instant.now(clock).minus(MANIFEST_GRACE);
    final Deque<String> keep = new ArrayDeque<>();
    store
        .select(
            prefixes()
                + "SELECT ?m WHERE { GRAPH <"
                + activations
                + "> { ?gl omr:activeManifest ?m } }")
        .forEach(row -> keep.add(row.get("m")));
    candidates.sort(Map.Entry.<String, Instant>comparingByValue().reversed());
    for (int index = 0; index < candidates.size(); index++) {
      final Map.Entry<String, Instant> candidate = candidates.get(index);
      if (index < RETAINED_CANDIDATE_MANIFESTS || candidate.getValue().isAfter(graceStart)) {
        keep.add(candidate.getKey());
      }
    }
    approved.forEach(
        (manifest, created) -> {
          if (created.isAfter(graceStart)) {
            keep.add(manifest);
          }
        });
    final Map<String, List<String>> importEdges = new HashMap<>();
    store
        .select(
            prefixes()
                + "SELECT ?m ?i WHERE { GRAPH ?m { ?v omr:importsManifest ?i } "
                + "FILTER(STRSTARTS(STR(?m), \""
                + prefix
                + "\")) } LIMIT "
                + MAX_MANIFESTS_LISTED)
        .forEach(
            row ->
                importEdges
                    .computeIfAbsent(row.get("m"), m -> new ArrayList<>())
                    .add(row.get("i")));
    final Set<String> reachable = new HashSet<>();
    while (!keep.isEmpty()) {
      final String manifest = keep.pop();
      if (reachable.add(manifest)) {
        keep.addAll(importEdges.getOrDefault(manifest, List.of()));
      }
    }
    final List<String> drops = new ArrayList<>();
    approved.keySet().stream().filter(m -> !reachable.contains(m)).forEach(drops::add);
    candidates.stream()
        .map(Map.Entry::getKey)
        .filter(m -> !reachable.contains(m))
        .forEach(drops::add);
    for (final List<String> batch : batches(drops)) {
      store.update(String.join(" ;\n", batch.stream().map(OntologyGraphs::dropUpdate).toList()));
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Candidates

  /** Requested candidate graphs, keyed by owning glossary until a closure takes them. */
  private static final class Overlay {
    static final Overlay NONE = new Overlay(Map.of(), List.of());

    private final Map<String, SortedMap<String, String>> byGlossary;
    private final List<RdfOntologyCandidate> report;
    private final Set<String> taken = new HashSet<>();

    private Overlay(
        final Map<String, SortedMap<String, String>> byGlossary,
        final List<RdfOntologyCandidate> report) {
      this.byGlossary = byGlossary;
      this.report = report;
    }

    SortedMap<String, String> take(final String glossaryIri) {
      final SortedMap<String, String> graphs = byGlossary.get(glossaryIri);
      if (graphs == null) {
        return new TreeMap<>();
      }
      taken.add(glossaryIri);
      return graphs;
    }

    long includedCount() {
      return report.stream()
          .filter(candidate -> outcome(candidate) == RdfOntologyCandidateOutcome.INCLUDED)
          .count();
    }

    List<RdfOntologyCandidate> report(final int limit) {
      return report.stream().limit(limit).map(this::resolved).toList();
    }

    private RdfOntologyCandidate resolved(final RdfOntologyCandidate candidate) {
      return candidate.withOutcome(outcome(candidate));
    }

    private RdfOntologyCandidateOutcome outcome(final RdfOntologyCandidate candidate) {
      if (candidate.getOutcome() != RdfOntologyCandidateOutcome.INCLUDED) {
        return candidate.getOutcome();
      }
      final boolean inClosure =
          byGlossary.entrySet().stream()
              .anyMatch(
                  entry ->
                      taken.contains(entry.getKey())
                          && entry.getValue().containsKey(candidate.getGraph().toString()));
      return inClosure
          ? RdfOntologyCandidateOutcome.INCLUDED
          : RdfOntologyCandidateOutcome.OUTSIDE_CLOSURE;
    }
  }

  private Overlay lookUpCandidates(final Set<UUID> entityIds) {
    final Map<String, UUID> graphToEntity = new LinkedHashMap<>();
    for (final UUID id : entityIds) {
      graphToEntity.put(graphIri(Entity.ONTOLOGY_AXIOM, id), id);
      graphToEntity.put(graphIri(Entity.GLOSSARY_TERM, id), id);
    }
    final Map<UUID, Map<String, String>> records = new HashMap<>();
    for (final List<String> batch : batches(graphToEntity.keySet())) {
      for (final Map<String, String> row :
          store.select(
              prefixes()
                  + "SELECT ?g ?t ?s ?d ?gl WHERE { VALUES ?g { "
                  + iris(batch)
                  + " } GRAPH <"
                  + members
                  + "> { ?g omr:entityType ?t ;"
                  + DIGESTED
                  + ". "
                  + "OPTIONAL { ?g omr:lifecycleStatus ?s } OPTIONAL { ?g omr:glossary ?gl } } }")) {
        records.put(graphToEntity.get(row.get("g")), row);
      }
    }
    final Map<String, SortedMap<String, String>> byGlossary = new HashMap<>();
    final List<RdfOntologyCandidate> report = new ArrayList<>();
    for (final UUID id : entityIds) {
      final Map<String, String> record = records.get(id);
      final RdfOntologyCandidate candidate = new RdfOntologyCandidate().withEntityId(id);
      if (record == null) {
        report.add(candidate.withOutcome(RdfOntologyCandidateOutcome.NOT_PROJECTED));
        continue;
      }
      final String status = record.get("s");
      candidate
          .withEntityType(record.get("t"))
          .withGraph(URI.create(record.get("g")))
          .withStatus(status);
      if (APPROVED.equals(status)) {
        candidate.withOutcome(RdfOntologyCandidateOutcome.ALREADY_APPROVED);
      } else if (status == null
          || !CANDIDATE_STATUSES.contains(status)
          || record.get("gl") == null) {
        candidate.withOutcome(RdfOntologyCandidateOutcome.NOT_A_CANDIDATE_STATUS);
      } else {
        candidate.withOutcome(RdfOntologyCandidateOutcome.INCLUDED);
        byGlossary
            .computeIfAbsent(record.get("gl"), glossary -> new TreeMap<>())
            .put(record.get("g"), record.get("d"));
      }
      report.add(candidate);
    }
    return new Overlay(byGlossary, report);
  }

  private RdfReasoningJobRequest check(final Node root, final RdfSourceRevision revision) {
    // The same candidate checked against the same serving revision is the same job, so a retried
    // submission does not start a second one.
    final UUID requestId =
        UUID.nameUUIDFromBytes(
            (root.digest()
                    + "|"
                    + revision.getDatasetGeneration()
                    + "|"
                    + revision.getLiveWriteWatermark())
                .getBytes(StandardCharsets.UTF_8));
    return new RdfReasoningJobRequest()
        .withRequestId(requestId)
        .withOperation(RdfReasoningOperation.CHECK)
        .withSourceRevision(revision)
        .withOntologySelection(root.selection())
        .withOntologyIri(URI.create(root.ontologyIri()))
        .withOntologyDigest(root.digest())
        .withCheck(new RdfReasoningCheck().withKind(RdfReasoningCheckKind.CONSISTENCY));
  }

  // ---------------------------------------------------------------------------------------------
  // Shared helpers

  private RdfOntologyClosure describe(final Node node, final boolean checkActive) {
    return new RdfOntologyClosure()
        .withGlossary(node.glossary().getEntityReference())
        .withOntologyIri(URI.create(node.ontologyIri()))
        .withVersionIri(URI.create(versionIri(node)))
        .withSelection(node.selection())
        .withClosureDigest(node.digest())
        .withManifestGraph(URI.create(manifestGraph(node)))
        .withMemberCount(node.memberCount())
        .withIncluded(node.included())
        .withExcluded(node.excluded())
        .withImports(
            node.imports().stream()
                .map(
                    imported ->
                        new RdfOntologyImportedVersion()
                            .withGlossary(imported.glossary().getEntityReference())
                            .withOntologyIri(URI.create(imported.ontologyIri()))
                            .withVersionIri(URI.create(versionIri(imported)))
                            .withSelection(imported.selection())
                            .withClosureDigest(imported.digest())
                            .withManifestGraph(URI.create(manifestGraph(imported))))
                .toList())
        .withProblems(node.allProblems())
        .withPublished(isPublished(node))
        .withActive(
            checkActive && node.selection() == RdfOntologySelection.APPROVED && isActive(node));
  }

  private String graphIri(final String entityType, final UUID id) {
    return OntologyGraphs.graphIri(baseUri, entityType, id).orElseThrow();
  }

  private static String prefixes() {
    return "PREFIX omr: <" + OntologyReasoningVocabulary.NS + ">\n";
  }

  private static String iris(final Collection<String> iris) {
    final StringBuilder values = new StringBuilder();
    iris.forEach(iri -> values.append('<').append(iri).append("> "));
    return values.toString();
  }

  private static List<List<String>> batches(final Collection<String> values) {
    final List<List<String>> batches = new ArrayList<>();
    List<String> batch = new ArrayList<>();
    for (final String value : values) {
      batch.add(value);
      if (batch.size() == LOOKUP_BATCH) {
        batches.add(batch);
        batch = new ArrayList<>();
      }
    }
    if (!batch.isEmpty()) {
      batches.add(batch);
    }
    return batches;
  }

  /** Member-record counts by entity type and status. */
  private static final class Counts {
    private long approvedAxioms;
    private long approvedTerms;
    private long relationshipTypes;
    private long candidateAxioms;
    private long candidateTerms;
    private final Map<String, Map<RdfOntologyExclusionReason, Long>> excluded = new TreeMap<>();

    void add(
        final String entityType, final String status, final long count, final boolean countTypes) {
      if (Entity.RELATIONSHIP_TYPE.equals(entityType)) {
        if (countTypes) {
          relationshipTypes += count;
        }
        return;
      }
      if (APPROVED.equals(status)) {
        if (Entity.ONTOLOGY_AXIOM.equals(entityType)) {
          approvedAxioms += count;
        } else if (Entity.GLOSSARY_TERM.equals(entityType)) {
          approvedTerms += count;
        }
        return;
      }
      excluded
          .computeIfAbsent(entityType, type -> new TreeMap<>())
          .merge(reason(status), count, Long::sum);
    }

    /** Candidates take part in a candidate closure, so they count as included there. */
    void addCandidates(final Set<String> graphs, final String baseUri) {
      final String axioms = OntologyGraphs.graphPrefix(baseUri, Entity.ONTOLOGY_AXIOM);
      candidateAxioms = graphs.stream().filter(graph -> graph.startsWith(axioms)).count();
      candidateTerms = graphs.size() - candidateAxioms;
    }

    RdfOntologyMemberCounts included() {
      return new RdfOntologyMemberCounts()
          .withAxioms(approvedAxioms + candidateAxioms)
          .withTerms(approvedTerms + candidateTerms)
          .withRelationshipTypes(relationshipTypes);
    }

    List<RdfOntologyExclusion> excluded() {
      final List<RdfOntologyExclusion> exclusions = new ArrayList<>();
      excluded.forEach(
          (entityType, reasons) ->
              reasons.forEach(
                  (reason, count) ->
                      exclusions.add(
                          new RdfOntologyExclusion()
                              .withEntityType(entityType)
                              .withReason(reason)
                              .withCount(count))));
      return exclusions;
    }

    private static RdfOntologyExclusionReason reason(final String status) {
      if (status == null) {
        return RdfOntologyExclusionReason.NO_STATUS;
      }
      return switch (EntityStatus.fromValue(status)) {
        case DRAFT -> RdfOntologyExclusionReason.DRAFT;
        case IN_REVIEW -> RdfOntologyExclusionReason.IN_REVIEW;
        case REJECTED -> RdfOntologyExclusionReason.REJECTED;
        case DEPRECATED -> RdfOntologyExclusionReason.DEPRECATED;
        case ARCHIVED -> RdfOntologyExclusionReason.ARCHIVED;
        case UNPROCESSED -> RdfOntologyExclusionReason.UNPROCESSED;
        case APPROVED -> throw new IllegalArgumentException("Approved graphs are not excluded");
      };
    }
  }
}
