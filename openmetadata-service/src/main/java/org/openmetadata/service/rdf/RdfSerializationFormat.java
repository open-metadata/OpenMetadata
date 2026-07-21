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
    return switch (requested.trim().toLowerCase(Locale.ROOT)) {
      case "turtle", "ttl" -> TURTLE;
      case "rdfxml", "rdf+xml", "rdf/xml", "xml" -> RDF_XML;
      case "ntriples", "n-triples", "nt" -> N_TRIPLES;
      case "jsonld", "json-ld", "ld+json" -> JSON_LD;
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
