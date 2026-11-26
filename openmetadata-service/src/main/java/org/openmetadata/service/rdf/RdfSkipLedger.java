package org.openmetadata.service.rdf;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.vocabulary.RDF;
import org.openmetadata.schema.api.data.NativeOntologyImportSkipGroup;
import org.openmetadata.schema.api.data.NativeOntologyImportSkipReason;
import org.openmetadata.schema.api.data.NativeOntologyImportSkipped;

/**
 * Counts the RDF statements an import leaves out, by reason and predicate. Samples are the
 * lexicographically first subjects, so two parses of the same source report the same thing no
 * matter how the parser orders blank nodes or statements.
 */
final class RdfSkipLedger {
  static final int SAMPLE_SIZE = 3;
  static final int MAX_GROUPS = 100;
  private static final String BLANK_SUBJECT = "(blank node)";

  private final Map<Key, Group> groups = new HashMap<>();
  private long unlistedCount;
  private int unlistedGroups;

  RdfSkipLedger() {}

  /**
   * Continues a report the reader finished, so the importer can add what it drops against its
   * target. Groups the report left unlisted stay counted in the total and the omitted-group count.
   */
  static RdfSkipLedger continuing(final NativeOntologyImportSkipped report) {
    final RdfSkipLedger ledger = new RdfSkipLedger();
    long listed = 0;
    for (final NativeOntologyImportSkipGroup group : report.getGroups()) {
      ledger
          .groups
          .computeIfAbsent(
              new Key(group.getReason(), group.getPredicate(), group.getObject()),
              ignored -> new Group())
          .seed(group.getSubjects(), group.getCount());
      listed += group.getCount();
    }
    ledger.unlistedCount = report.getTotal() - listed;
    ledger.unlistedGroups = report.getOmittedGroups();
    return ledger;
  }

  void skip(final NativeOntologyImportSkipReason reason, final Statement statement) {
    skip(reason, statement, 1);
  }

  void skip(
      final NativeOntologyImportSkipReason reason, final Statement statement, final int count) {
    groups
        .computeIfAbsent(Key.of(reason, statement), ignored -> new Group())
        .add(subjectLabel(statement), count);
  }

  /** A link the importer drops from a parsed definition, by the subject's and predicate's IRIs. */
  void skip(
      final NativeOntologyImportSkipReason reason, final String subject, final Property predicate) {
    groups
        .computeIfAbsent(new Key(reason, predicate.getURI(), null), ignored -> new Group())
        .add(subject, 1);
  }

  /** Statements about an individual are grouped by reason alone, whatever their predicates. */
  void skipIndividual(final Statement statement) {
    groups
        .computeIfAbsent(
            new Key(NativeOntologyImportSkipReason.INDIVIDUAL, null, null), ignored -> new Group())
        .add(subjectLabel(statement), 1);
  }

  NativeOntologyImportSkipped report() {
    final List<Map.Entry<Key, Group>> ordered = new ArrayList<>(groups.entrySet());
    ordered.sort(
        Comparator.comparingLong((Map.Entry<Key, Group> entry) -> -entry.getValue().count)
            .thenComparing(entry -> entry.getKey().reason().ordinal())
            .thenComparing(entry -> String.valueOf(entry.getKey().predicate()))
            .thenComparing(entry -> String.valueOf(entry.getKey().object())));
    final List<NativeOntologyImportSkipGroup> listed =
        ordered.stream()
            .limit(MAX_GROUPS)
            .map(entry -> entry.getKey().toGroup(entry.getValue()))
            .toList();
    final long total =
        groups.values().stream().mapToLong(group -> group.count).sum() + unlistedCount;
    return new NativeOntologyImportSkipped()
        .withTotal(Math.toIntExact(total))
        .withGroups(listed)
        .withOmittedGroups(Math.max(0, ordered.size() - MAX_GROUPS) + unlistedGroups);
  }

  private static String subjectLabel(final Statement statement) {
    return statement.getSubject().isURIResource() ? statement.getSubject().getURI() : BLANK_SUBJECT;
  }

  private record Key(NativeOntologyImportSkipReason reason, String predicate, String object) {
    static Key of(final NativeOntologyImportSkipReason reason, final Statement statement) {
      final RDFNode object = statement.getObject();
      final boolean typed = statement.getPredicate().equals(RDF.type) && object.isURIResource();
      return new Key(
          reason, statement.getPredicate().getURI(), typed ? object.asResource().getURI() : null);
    }

    NativeOntologyImportSkipGroup toGroup(final Group group) {
      return new NativeOntologyImportSkipGroup()
          .withReason(reason)
          .withPredicate(predicate)
          .withObject(object)
          .withCount(Math.toIntExact(group.count))
          .withSubjects(List.copyOf(group.samples));
    }
  }

  private static final class Group {
    private long count;
    private final TreeSet<String> samples = new TreeSet<>();

    void add(final String subject, final int added) {
      count += added;
      samples.add(subject);
      if (samples.size() > SAMPLE_SIZE) {
        samples.pollLast();
      }
    }

    void seed(final List<String> subjects, final int added) {
      count += added;
      samples.addAll(subjects);
      while (samples.size() > SAMPLE_SIZE) {
        samples.pollLast();
      }
    }
  }
}
