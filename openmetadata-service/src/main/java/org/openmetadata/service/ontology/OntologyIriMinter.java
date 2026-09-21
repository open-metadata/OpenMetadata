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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.data.OntologyIriPreview;
import org.openmetadata.schema.api.data.OntologyIriPreviewRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.OntologyConfiguration;

public final class OntologyIriMinter {
  private static final String GLOSSARY_PLACEHOLDER = "{glossary}";
  private static final String TERM_PLACEHOLDER = "{term}";
  private static final String UUID_PLACEHOLDER = "{uuid}";
  private static final String ENCODED_SPACE = "%20";
  private static final String FORM_SPACE = "+";
  private static final String EMPTY = "";
  private static final String PATH_SEPARATOR = "/";
  private static final String FRAGMENT_SEPARATOR = "#";
  private static final String SCHEME_SEPARATOR = ":";
  private static final String LEFT_BRACE = "{";
  private static final String RIGHT_BRACE = "}";
  private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{([^{}]+)}");
  private static final Set<String> SUPPORTED_PLACEHOLDERS =
      Set.of(GLOSSARY_PLACEHOLDER, TERM_PLACEHOLDER, UUID_PLACEHOLDER);

  public OntologyIriPreview preview(
      final Glossary glossary, final OntologyIriPreviewRequest request) {
    final OntologyConfiguration configuration = requireConfiguration(glossary);
    final UUID candidateId =
        request.getCandidateId() == null ? UUID.randomUUID() : request.getCandidateId();
    final String termSegment = encodeSegment(request.getTermName());
    final URI iri = mint(configuration, glossary.getName(), termSegment, candidateId);
    return response(glossary, configuration, candidateId, termSegment, iri);
  }

  public static void validateConfiguration(final OntologyConfiguration configuration) {
    requireAbsoluteBaseIri(configuration.getBaseIri());
    requireSupportedPattern(configuration.getIriMintingPattern());
    mint(configuration, "glossary", "term", new UUID(0L, 0L));
  }

  private static URI mint(
      final OntologyConfiguration configuration,
      final String glossaryName,
      final String termSegment,
      final UUID candidateId) {
    final String suffix =
        expand(configuration.getIriMintingPattern(), glossaryName, termSegment, candidateId);
    final String value = join(configuration.getBaseIri().toString(), suffix);
    final URI iri = requireAbsoluteIri(value);
    return iri;
  }

  private static String expand(
      final String pattern,
      final String glossaryName,
      final String termSegment,
      final UUID candidateId) {
    final String expanded =
        pattern
            .replace(GLOSSARY_PLACEHOLDER, encodeSegment(glossaryName))
            .replace(TERM_PLACEHOLDER, termSegment)
            .replace(UUID_PLACEHOLDER, candidateId.toString());
    return expanded;
  }

  private static String join(final String baseIri, final String suffix) {
    final boolean hasSeparator =
        baseIri.endsWith(PATH_SEPARATOR)
            || baseIri.endsWith(FRAGMENT_SEPARATOR)
            || baseIri.endsWith(SCHEME_SEPARATOR);
    final String separator =
        hasSeparator || suffix.startsWith(PATH_SEPARATOR) || suffix.startsWith(FRAGMENT_SEPARATOR)
            ? EMPTY
            : PATH_SEPARATOR;
    return baseIri + separator + suffix;
  }

  private static OntologyConfiguration requireConfiguration(final Glossary glossary) {
    final OntologyConfiguration configuration = glossary.getOntologyConfiguration();
    if (configuration == null) {
      throw new BadRequestException(
          "Glossary '" + glossary.getName() + "' does not have an ontology configuration");
    }
    validateConfiguration(configuration);
    return configuration;
  }

  private static void requireAbsoluteBaseIri(final URI baseIri) {
    if (baseIri == null || !baseIri.isAbsolute()) {
      throw new BadRequestException("Ontology base IRI must be absolute");
    }
  }

  private static void requireSupportedPattern(final String pattern) {
    if (nullOrEmpty(pattern) || pattern.isBlank()) {
      throw new BadRequestException("Ontology IRI minting pattern is required");
    }
    final Matcher matcher = PLACEHOLDER_PATTERN.matcher(pattern);
    while (matcher.find()) {
      final String placeholder = matcher.group();
      if (!SUPPORTED_PLACEHOLDERS.contains(placeholder)) {
        throw new BadRequestException(
            "Unsupported ontology IRI minting placeholder '" + placeholder + "'");
      }
    }
    requireBalancedBraces(pattern);
  }

  private static void requireBalancedBraces(final String pattern) {
    final String literalsRemoved =
        pattern
            .replace(GLOSSARY_PLACEHOLDER, EMPTY)
            .replace(TERM_PLACEHOLDER, EMPTY)
            .replace(UUID_PLACEHOLDER, EMPTY);
    if (literalsRemoved.contains(LEFT_BRACE) || literalsRemoved.contains(RIGHT_BRACE)) {
      throw new BadRequestException("Ontology IRI minting pattern contains an invalid placeholder");
    }
  }

  private static URI requireAbsoluteIri(final String value) {
    final URI iri;
    try {
      iri = URI.create(value);
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(
          "Ontology IRI minting pattern produced an invalid IRI", exception);
    }
    if (!iri.isAbsolute()) {
      throw new BadRequestException("Ontology IRI minting pattern must produce an absolute IRI");
    }
    return iri;
  }

  private static String encodeSegment(final String value) {
    if (nullOrEmpty(value) || value.isBlank()) {
      throw new BadRequestException("Ontology IRI segment is required");
    }
    return URLEncoder.encode(value.trim(), StandardCharsets.UTF_8)
        .replace(FORM_SPACE, ENCODED_SPACE);
  }

  private static OntologyIriPreview response(
      final Glossary glossary,
      final OntologyConfiguration configuration,
      final UUID candidateId,
      final String termSegment,
      final URI iri) {
    return new OntologyIriPreview()
        .withGlossaryId(glossary.getId())
        .withCandidateId(candidateId)
        .withBaseIri(configuration.getBaseIri())
        .withPattern(configuration.getIriMintingPattern())
        .withTermSegment(termSegment)
        .withIri(iri);
  }
}
