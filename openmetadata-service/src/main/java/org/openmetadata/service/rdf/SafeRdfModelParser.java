package org.openmetadata.service.rdf;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.Triple;
import org.apache.jena.irix.IRIxResolver;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.riot.system.StreamRDFBase;
import org.apache.jena.sparql.core.Quad;
import org.openmetadata.service.exception.BadRequestException;

/** A bounded parser for native preview; it never loads external documents or named graphs. */
public final class SafeRdfModelParser {
  public static final int MAX_INPUT_BYTES = 10 * 1024 * 1024;
  public static final int MAX_TRIPLES = 100_000;
  public static final long PARSE_NANOS = Duration.ofSeconds(30).toNanos();

  /** A backstop against a corrupt bundle, for content whose checksum was verified. */
  public static final int TRUSTED_MAX_INPUT_BYTES = 64 * 1024 * 1024;

  public static final int TRUSTED_MAX_TRIPLES = 2_000_000;
  public static final long TRUSTED_PARSE_NANOS = Duration.ofSeconds(120).toNanos();

  private static final String SHA_256 = "SHA-256";
  private static final Limits UNTRUSTED =
      new Limits(
          MAX_INPUT_BYTES,
          MAX_TRIPLES,
          PARSE_NANOS,
          "Native ontology RDF must contain at most 10 MiB of data");
  private static final Limits TRUSTED =
      new Limits(
          TRUSTED_MAX_INPUT_BYTES,
          TRUSTED_MAX_TRIPLES,
          TRUSTED_PARSE_NANOS,
          "Bundled ontology RDF must contain at most 64 MiB of data");

  private record Limits(int maxBytes, int maxTriples, long parseNanos, String tooLarge) {}

  public Model parse(final String data, final RdfSerializationFormat format) {
    return parse(data, format, UNTRUSTED);
  }

  /**
   * Parses bundled content whose checksum the catalogue verified. The size, statement and time
   * limits that guard user uploads become a large backstop; relative identifiers, named graphs and
   * DOCTYPE declarations stay refused.
   */
  public Model parseTrusted(
      final String data, final RdfSerializationFormat format, final String expectedSha256) {
    requireChecksum(data, expectedSha256);
    return parse(data, format, TRUSTED);
  }

  private static void requireChecksum(final String data, final String expectedSha256) {
    final String actual = sha256(data.getBytes(StandardCharsets.UTF_8));
    if (expectedSha256 == null || !actual.equalsIgnoreCase(expectedSha256)) {
      throw new IllegalStateException("Bundled ontology content does not match its checksum");
    }
  }

  private static String sha256(final byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance(SHA_256).digest(bytes));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("JVM does not provide SHA-256", exception);
    }
  }

  private Model parse(final String data, final RdfSerializationFormat format, final Limits limits) {
    if (data == null
        || data.isBlank()
        || data.getBytes(StandardCharsets.UTF_8).length > limits.maxBytes()) {
      throw new BadRequestException(limits.tooLarge());
    }
    if (format == RdfSerializationFormat.RDF_XML
        && data.toUpperCase(Locale.ROOT).contains("<!DOCTYPE")) {
      throw new BadRequestException("RDF/XML DOCTYPE declarations are not allowed");
    }
    if (format == RdfSerializationFormat.JSON_LD) {
      return new SafeJsonLdModelParser().parseStrict(data);
    }
    return parseTriples(data, format.rdfFormat().getLang(), limits);
  }

  private Model parseTriples(final String data, final Lang lang, final Limits limits) {
    final Model model = ModelFactory.createDefaultModel();
    final long deadline = System.nanoTime() + limits.parseNanos();
    try {
      RDFParser.fromString(data, lang)
          .resolver(IRIxResolver.create().noBase().resolve(true).allowRelative(false).build())
          .parse(
              new StreamRDFBase() {
                private int count;

                @Override
                public void triple(final Triple triple) {
                  if (++count > limits.maxTriples() || System.nanoTime() >= deadline) {
                    throw new BadRequestException("Native RDF exceeds its triple or time budget");
                  }
                  requireAbsolute(triple.getSubject());
                  requireAbsolute(triple.getPredicate());
                  requireAbsolute(triple.getObject());
                  model.getGraph().add(triple);
                }

                @Override
                public void quad(final Quad quad) {
                  throw new BadRequestException("Named RDF graphs are not supported");
                }
              });
      return model;
    } catch (RuntimeException exception) {
      model.close();
      if (exception instanceof BadRequestException) {
        throw exception;
      }
      final String message = String.valueOf(exception.getMessage());
      throw new BadRequestException(
          "Failed to parse native RDF: " + message.substring(0, Math.min(200, message.length())));
    }
  }

  private static void requireAbsolute(final Node node) {
    if (node.isURI() && !URI.create(node.getURI()).isAbsolute()) {
      throw new BadRequestException("RDF contains a relative identifier");
    }
  }
}
