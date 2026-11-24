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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Locale;
import java.util.Objects;
import org.apache.jena.riot.RDFFormat;

/** Supported RDF graph serializations and their wire metadata. */
public enum RdfSerializationFormat {
  TURTLE("turtle", "text/turtle", "ttl", RDFFormat.TURTLE_PRETTY),
  RDF_XML("rdfxml", "application/rdf+xml", "rdf", RDFFormat.RDFXML_PRETTY),
  N_TRIPLES("ntriples", "application/n-triples", "nt", RDFFormat.NTRIPLES),
  JSON_LD("jsonld", "application/ld+json", "jsonld", RDFFormat.JSONLD_PRETTY);

  private final String externalName;
  private final String mediaType;
  private final String extension;
  private final RDFFormat rdfFormat;

  RdfSerializationFormat(
      String externalName, String mediaType, String extension, RDFFormat rdfFormat) {
    this.externalName = externalName;
    this.mediaType = mediaType;
    this.extension = extension;
    this.rdfFormat = rdfFormat;
  }

  public static RdfSerializationFormat parse(String requested) {
    return parseOrDefault(requested, TURTLE);
  }

  public static RdfSerializationFormat parseOrDefault(
      String requested, RdfSerializationFormat defaultFormat) {
    Objects.requireNonNull(defaultFormat);
    if (nullOrEmpty(requested) || requested.isBlank()) {
      return defaultFormat;
    }
    // Media types are accepted alongside the short names because callers legitimately hold either:
    // the REST layer negotiates on "text/turtle" while the tools and query string use "turtle".
    // Only short names were recognised before, so a caller asking for "text/turtle" fell through to
    // the writer's RDF/XML default and got XML in a response still labelled turtle.
    return switch (requested.trim().toLowerCase(Locale.ROOT)) {
      case "turtle", "ttl", "text/turtle" -> TURTLE;
      case "rdfxml", "rdf+xml", "rdf/xml", "xml", "application/rdf+xml" -> RDF_XML;
      case "ntriples", "n-triples", "nt", "application/n-triples", "text/plain" -> N_TRIPLES;
      case "jsonld", "json-ld", "ld+json", "application/ld+json" -> JSON_LD;
      default -> throw new IllegalArgumentException(
          "Unsupported RDF serialization format: " + requested);
    };
  }

  public String externalName() {
    return externalName;
  }

  public String mediaType() {
    return mediaType;
  }

  public String extension() {
    return extension;
  }

  public RDFFormat rdfFormat() {
    return rdfFormat;
  }
}
