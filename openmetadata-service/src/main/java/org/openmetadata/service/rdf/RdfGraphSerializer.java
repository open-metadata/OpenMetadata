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

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.apache.jena.graph.Graph;
import org.apache.jena.graph.Triple;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.shared.JenaException;
import org.apache.jena.util.iterator.ExtendedIterator;

/**
 * Serializes an RDF graph in a requested format, turning a format that cannot carry the graph into a
 * caller-facing error instead of a 500.
 *
 * <p>Turtle, N-Triples, and RDF/XML all carry RDF 1.2 triple terms; JSON-LD does not, and Jena
 * aborts mid-write with a bare {@code JenaException} when it meets one. Every graph response goes
 * through here so that failure reads as "ask for a different format" rather than an unhandled
 * server error, and so the rule lives in one place instead of at each writer.
 */
public final class RdfGraphSerializer {

  private RdfGraphSerializer() {}

  public static String asString(final Model model, final RdfSerializationFormat format) {
    final ByteArrayOutputStream output = new ByteArrayOutputStream();
    write(output, model, format);
    return output.toString(StandardCharsets.UTF_8);
  }

  public static void write(
      final OutputStream output, final Model model, final RdfSerializationFormat format) {
    requireExpressible(model, format);
    try {
      RDFDataMgr.write(output, model, format.rdfFormat());
    } catch (JenaException exception) {
      throw new UnsupportedRdfSerializationException(format, exception);
    }
  }

  /** True when the format can represent every term in the graph. */
  public static boolean canRepresent(final Model model, final RdfSerializationFormat format) {
    return format != RdfSerializationFormat.JSON_LD || !containsTripleTerm(model.getGraph());
  }

  private static void requireExpressible(final Model model, final RdfSerializationFormat format) {
    if (!canRepresent(model, format)) {
      throw new UnsupportedRdfSerializationException(format, null);
    }
  }

  private static boolean containsTripleTerm(final Graph graph) {
    boolean found = false;
    final ExtendedIterator<Triple> triples = graph.find();
    try {
      while (!found && triples.hasNext()) {
        found = containsTripleTerm(triples.next());
      }
    } finally {
      triples.close();
    }
    return found;
  }

  private static boolean containsTripleTerm(final Triple triple) {
    return triple.getSubject().isTripleTerm()
        || triple.getPredicate().isTripleTerm()
        || triple.getObject().isTripleTerm();
  }
}
