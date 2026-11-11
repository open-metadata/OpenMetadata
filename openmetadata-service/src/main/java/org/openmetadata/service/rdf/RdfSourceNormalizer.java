package org.openmetadata.service.rdf;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import org.apache.jena.rdf.model.Literal;
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
import org.openmetadata.schema.api.data.NativeOntologyImportSkipReason;

/**
 * Narrows what a real-world source states to what the native model can hold, before any
 * definition is read. Every decision is a pure function of the statements, never of their parse
 * order, because the pack installer re-runs the import and requires an identical plan.
 */
final class RdfSourceNormalizer {
  private static final List<Property> TEXT_PREDICATES =
      List.of(
          RDFS.label,
          RDFS.comment,
          SKOS.prefLabel,
          SKOS.altLabel,
          SKOS.definition,
          OntologyRdfVocabulary.UNIT);
  private static final List<Property> SINGLE_VALUED =
      List.of(
          RDFS.label,
          RDFS.comment,
          SKOS.prefLabel,
          SKOS.definition,
          DCTerms.source,
          DCTerms.isReplacedBy,
          OWL2.deprecated,
          OWL2.inverseOf,
          OWL2.versionIRI,
          OntologyRdfVocabulary.ABSTRACT,
          OntologyRdfVocabulary.UNIT,
          OntologyRdfVocabulary.IDENTIFIER_INTENT);
  private static final List<Property> DESCRIPTIONS = List.of(SKOS.definition, RDFS.comment);
  private static final Set<String> MARKUP_DATATYPES =
      Set.of(RDF.HTML.getURI(), RDF.xmlLiteral.getURI());
  private static final String ENGLISH = "en";

  private final Model model;
  private final RdfSkipLedger ledger;

  private RdfSourceNormalizer(final Model model, final RdfSkipLedger ledger) {
    this.model = model;
    this.ledger = ledger;
  }

  static void normalize(final Model model, final RdfSkipLedger ledger) {
    final RdfSourceNormalizer normalizer = new RdfSourceNormalizer(model, ledger);
    normalizer.dropImports();
    DESCRIPTIONS.forEach(normalizer::dropDescriptionsThatAreNotText);
    TEXT_PREDICATES.forEach(normalizer::preferOneLanguage);
    SINGLE_VALUED.forEach(normalizer::keepFirstValue);
  }

  /** A bundled pack ships merged files and the importer never fetches a document. */
  private void dropImports() {
    final List<Statement> imports =
        model.listStatements(null, OWL2.imports, (RDFNode) null).toList();
    imports.forEach(statement -> ledger.skip(NativeOntologyImportSkipReason.IMPORTS, statement));
    imports.forEach(model::remove);
  }

  /**
   * A description that is a resource or markup cannot become native text without guessing at its
   * rendering, so it is skipped and the subject keeps its other description or none. ESCO, for
   * one, states each definition as a node with an HTML-bearing literal.
   */
  private void dropDescriptionsThatAreNotText(final Property predicate) {
    for (final Statement statement :
        model.listStatements(null, predicate, (RDFNode) null).toList()) {
      if (!statement.getObject().isLiteral() || isMarkup(statement.getLiteral())) {
        ledger.skip(NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE, statement);
        model.remove(statement);
        removeUnreferencedBlankStructure(statement.getObject());
      }
    }
  }

  private static boolean isMarkup(final Literal literal) {
    return MARKUP_DATATYPES.contains(literal.getDatatypeURI());
  }

  /** The structure belongs to the skipped statement, so it is neither read nor counted again. */
  private void removeUnreferencedBlankStructure(final RDFNode start) {
    final List<Resource> pending = new ArrayList<>();
    final Set<Resource> seen = new HashSet<>();
    if (start.isAnon()) {
      pending.add(start.asResource());
    }
    while (!pending.isEmpty()) {
      final Resource node = pending.removeLast();
      if (seen.add(node) && !model.contains(null, null, node)) {
        for (final Statement inner : model.listStatements(node, null, (RDFNode) null).toList()) {
          model.remove(inner);
          if (inner.getObject().isAnon()) {
            pending.add(inner.getObject().asResource());
          }
        }
      }
    }
  }

  /**
   * Keeps the untagged value when a subject has one, else the {@code en} values, else the
   * lexicographically first tag; the kept values lose their tag so the reader sees plain text.
   */
  private void preferOneLanguage(final Property predicate) {
    for (final Resource subject : model.listSubjectsWithProperty(predicate).toList()) {
      final List<Statement> literals = literalsOf(subject, predicate);
      final Set<String> tags = tagsOf(literals);
      if (!tags.isEmpty()) {
        final boolean hasUntagged = literals.stream().anyMatch(s -> languageOf(s).isEmpty());
        final String keep = hasUntagged ? "" : chooseTag(tags);
        literals.forEach(statement -> settle(statement, keep));
      }
    }
  }

  private List<Statement> literalsOf(final Resource subject, final Property predicate) {
    return model.listStatements(subject, predicate, (RDFNode) null).toList().stream()
        .filter(statement -> statement.getObject().isLiteral())
        .toList();
  }

  private static Set<String> tagsOf(final List<Statement> literals) {
    final Set<String> tags = new TreeSet<>();
    literals.stream()
        .map(RdfSourceNormalizer::languageOf)
        .filter(tag -> !tag.isEmpty())
        .forEach(tags::add);
    return tags;
  }

  private static String languageOf(final Statement statement) {
    return statement.getLiteral().getLanguage().toLowerCase(Locale.ROOT);
  }

  /** {@code tags} is sorted, so the first {@code en-*} or the first tag is deterministic. */
  private static String chooseTag(final Set<String> tags) {
    if (tags.contains(ENGLISH)) {
      return ENGLISH;
    }
    return tags.stream()
        .filter(tag -> tag.startsWith(ENGLISH + "-"))
        .findFirst()
        .orElse(tags.iterator().next());
  }

  private void settle(final Statement statement, final String keptTag) {
    final String tag = languageOf(statement);
    if (tag.isEmpty()) {
      return;
    }
    model.remove(statement);
    if (tag.equals(keptTag)) {
      model.add(
          statement.getSubject(),
          statement.getPredicate(),
          statement.getLiteral().getLexicalForm());
    } else {
      ledger.skip(NativeOntologyImportSkipReason.NON_PREFERRED_LANGUAGE, statement);
    }
  }

  /** The smallest value by lexical form, datatype, then kind, so the choice never depends on parse order. */
  private void keepFirstValue(final Property predicate) {
    for (final Resource subject : model.listSubjectsWithProperty(predicate).toList()) {
      final List<Statement> values =
          new ArrayList<>(model.listStatements(subject, predicate, (RDFNode) null).toList());
      if (values.size() > 1 && !model.contains(subject, RDF.type, OWL2.Axiom)) {
        values.sort(Comparator.comparing(RdfSourceNormalizer::sortKey));
        values.subList(1, values.size()).forEach(extra -> drop(extra));
      }
    }
  }

  private void drop(final Statement extra) {
    ledger.skip(NativeOntologyImportSkipReason.EXTRA_VALUE, extra);
    model.remove(extra);
  }

  private static String sortKey(final Statement statement) {
    final RDFNode object = statement.getObject();
    if (object.isLiteral()) {
      final Literal literal = object.asLiteral();
      return "1|" + literal.getLexicalForm() + "|" + literal.getDatatypeURI();
    }
    return (object.isURIResource() ? "0|" : "2|") + object;
  }
}
