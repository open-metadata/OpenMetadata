package org.openmetadata.service.rdf;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
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
  private static final int MAX_INPUT_BYTES = 10 * 1024 * 1024;
  private static final int MAX_TRIPLES = 100_000;
  private static final long PARSE_NANOS = Duration.ofSeconds(30).toNanos();

  public Model parse(final String data, final RdfSerializationFormat format) {
    if (data == null
        || data.isBlank()
        || data.getBytes(StandardCharsets.UTF_8).length > MAX_INPUT_BYTES) {
      throw new BadRequestException("Native ontology RDF must contain at most 10 MiB of data");
    }
    if (format == RdfSerializationFormat.RDF_XML
        && data.toUpperCase(Locale.ROOT).contains("<!DOCTYPE")) {
      throw new BadRequestException("RDF/XML DOCTYPE declarations are not allowed");
    }
    if (format == RdfSerializationFormat.JSON_LD) {
      return new SafeJsonLdModelParser().parseStrict(data);
    }
    final Lang lang = format.rdfFormat().getLang();
    final Model model = ModelFactory.createDefaultModel();
    final long deadline = System.nanoTime() + PARSE_NANOS;
    try {
      RDFParser.fromString(data, lang)
          .resolver(IRIxResolver.create().noBase().resolve(true).allowRelative(false).build())
          .parse(
              new StreamRDFBase() {
                private int count;

                @Override
                public void triple(final Triple triple) {
                  if (++count > MAX_TRIPLES || System.nanoTime() >= deadline) {
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
