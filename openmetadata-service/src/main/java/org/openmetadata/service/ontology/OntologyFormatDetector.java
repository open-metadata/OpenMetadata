package org.openmetadata.service.ontology;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;

/**
 * Names the format of an import file from its content first and its file name second, so a
 * misleading extension never decides how a file is parsed. Reads at most {@link #WINDOW}
 * characters. A longer browser sample signals that the window is truncated.
 */
public final class OntologyFormatDetector {
  public static final int WINDOW = 65_536;

  private static final String BOM = "﻿";
  private static final Pattern JSON_LD = Pattern.compile("(?s)^(\\{|\\[\\s*[\\{\\]]).*");
  private static final Pattern RDF_XML =
      Pattern.compile(
          "(?s)^(<\\?xml\\b|<!--|<[A-Za-z_][\\w.-]*(:[A-Za-z_][\\w.-]*)?(?:\\s|/>)|<[A-Za-z_][\\w.-]*>).*");
  private static final String TERM = "(<[^>\\s]*>|_:\\S+)";
  private static final String OBJECT =
      "(<[^>\\s]*>|_:\\S+|\"(?:[^\"\\\\]|\\\\.)*\"(?:\\^\\^<[^>\\s]*>|@[A-Za-z0-9-]+)?)";
  private static final Pattern N_TRIPLES_LINE =
      Pattern.compile("^\\s*" + TERM + "\\s+<[^>\\s]*>\\s+" + OBJECT + "\\s*\\.\\s*(#.*)?$");
  private static final Pattern TURTLE_DIRECTIVE =
      Pattern.compile("^(@prefix|@base|(?i:prefix|base)\\s)");
  private static final Pattern TURTLE_SUBJECT =
      Pattern.compile("^(<[^>\\s]*>|_:|\\[|[A-Za-z][\\w.-]*:|:)");
  private static final Map<String, NativeOntologyImportFormat> EXTENSIONS =
      Map.of(
          "ttl", NativeOntologyImportFormat.TURTLE,
          "rdf", NativeOntologyImportFormat.RDFXML,
          "owl", NativeOntologyImportFormat.RDFXML,
          "xml", NativeOntologyImportFormat.RDFXML,
          "nt", NativeOntologyImportFormat.NTRIPLES,
          "jsonld", NativeOntologyImportFormat.JSONLD,
          "json", NativeOntologyImportFormat.JSONLD,
          "csv", NativeOntologyImportFormat.CSV);

  private record Rule(Predicate<Sample> matches, NativeOntologyImportFormat format) {}

  /** Content signatures in the order they are tried; the first match wins. */
  private static final List<Rule> CONTENT_RULES =
      List.of(
          new Rule(
              sample -> JSON_LD.matcher(sample.body()).matches(),
              NativeOntologyImportFormat.JSONLD),
          new Rule(
              sample -> RDF_XML.matcher(sample.body()).matches(),
              NativeOntologyImportFormat.RDFXML),
          new Rule(
              sample -> NativeOntologyCsvCodec.isHeader(sample.firstLine()),
              NativeOntologyImportFormat.CSV),
          new Rule(OntologyFormatDetector::isNTriples, NativeOntologyImportFormat.NTRIPLES),
          new Rule(OntologyFormatDetector::isTurtle, NativeOntologyImportFormat.TURTLE));

  private OntologyFormatDetector() {}

  /** What the request asks for, else what the content and file name say. */
  public static Optional<NativeOntologyImportFormat> resolve(
      final PreviewNativeOntologyImport request) {
    if (request.getFormat() != null) {
      return Optional.of(request.getFormat());
    }
    return detect(request.getData(), request.getFileName());
  }

  public static Optional<NativeOntologyImportFormat> detect(
      final String content, final String fileName) {
    final Sample sample = Sample.of(content);
    return CONTENT_RULES.stream()
        .filter(rule -> rule.matches().test(sample))
        .map(Rule::format)
        .findFirst()
        .or(() -> fromExtension(fileName));
  }

  private static Optional<NativeOntologyImportFormat> fromExtension(final String fileName) {
    if (fileName == null || fileName.lastIndexOf('.') < 0) {
      return Optional.empty();
    }
    final String extension = fileName.substring(fileName.lastIndexOf('.') + 1);
    return Optional.ofNullable(EXTENSIONS.get(extension.toLowerCase(Locale.ROOT)));
  }

  private static boolean isNTriples(final Sample sample) {
    final List<String> lines = sample.statementLines();
    return !lines.isEmpty()
        && lines.stream().allMatch(line -> N_TRIPLES_LINE.matcher(line).matches());
  }

  private static boolean isTurtle(final Sample sample) {
    return TURTLE_DIRECTIVE.matcher(sample.firstLine()).find()
        || TURTLE_SUBJECT.matcher(sample.firstLine()).find();
  }

  /**
   * The window of a file with its BOM, blank lines, and leading comment lines removed.
   *
   * @param body everything from the first significant line
   * @param truncated whether the file continues past the window
   */
  private record Sample(String body, boolean truncated) {
    static Sample of(final String content) {
      if (content == null) {
        return new Sample("", false);
      }
      final String window = content.substring(0, Math.min(content.length(), WINDOW));
      final String text = window.startsWith(BOM) ? window.substring(1) : window;
      return new Sample(skipInsignificant(text), content.length() > WINDOW);
    }

    private static String skipInsignificant(final String text) {
      int start = 0;
      while (start < text.length()) {
        int end = text.indexOf('\n', start);
        end = end < 0 ? text.length() : end;
        final String line = text.substring(start, end).strip();
        if (!line.isEmpty() && line.charAt(0) != '#') {
          return text.substring(start).stripLeading();
        }
        start = end + 1;
      }
      return "";
    }

    String firstLine() {
      final int end = body.indexOf('\n');
      return (end < 0 ? body : body.substring(0, end)).strip();
    }

    /** Non-comment lines, without the last line when the window cut it short. */
    List<String> statementLines() {
      final List<String> lines = body.lines().toList();
      final List<String> complete =
          truncated && !lines.isEmpty() ? lines.subList(0, lines.size() - 1) : lines;
      return complete.stream()
          .filter(line -> !line.isBlank() && !line.strip().startsWith("#"))
          .toList();
    }
  }
}
