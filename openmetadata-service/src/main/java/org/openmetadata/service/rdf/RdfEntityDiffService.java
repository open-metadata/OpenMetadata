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

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.apache.jena.rdf.model.Literal;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.riot.out.NodeFmtLib;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.RdfEntityDiff;
import org.openmetadata.schema.type.RdfObjectKind;
import org.openmetadata.schema.type.RdfStatement;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.RdfBlankNodeCanonicalizer;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/** Creates deterministic, typed RDF statement diffs from database entity history. */
public final class RdfEntityDiffService {
  private final EntityVersionReader versionReader;
  private final EntityRdfTranslator translator;
  private final RdfBlankNodeCanonicalizer canonicalizer;
  private final UnaryOperator<String> entityTypeValidator;

  public RdfEntityDiffService(final String baseUri) {
    this(
        RdfEntityDiffService::readVersion,
        new JsonLdTranslator(JsonUtils.getObjectMapper(), baseUri)::toRdf,
        new RdfBlankNodeCanonicalizer(),
        RdfEntityTypeValidator::requireKnown);
  }

  RdfEntityDiffService(
      final EntityVersionReader versionReader,
      final EntityRdfTranslator translator,
      final RdfBlankNodeCanonicalizer canonicalizer,
      final UnaryOperator<String> entityTypeValidator) {
    this.versionReader = Objects.requireNonNull(versionReader);
    this.translator = Objects.requireNonNull(translator);
    this.canonicalizer = Objects.requireNonNull(canonicalizer);
    this.entityTypeValidator = Objects.requireNonNull(entityTypeValidator);
  }

  public RdfEntityDiff diff(
      final String requestedEntityType,
      final UUID entityId,
      final Double fromVersion,
      final Double toVersion) {
    final String entityType = entityTypeValidator.apply(requestedEntityType);
    requireVersion("fromVersion", fromVersion);
    requireVersion("toVersion", toVersion);
    final DiffRequest request = new DiffRequest(entityType, entityId, fromVersion, toVersion);
    final Model fromModel = versionModel(entityType, entityId, fromVersion);
    try {
      return createDiff(request, fromModel);
    } finally {
      fromModel.close();
    }
  }

  private RdfEntityDiff createDiff(final DiffRequest request, final Model fromModel) {
    final Model toModel =
        versionModel(request.entityType(), request.entityId(), request.toVersion());
    try {
      return buildDiff(request, fromModel, toModel);
    } finally {
      toModel.close();
    }
  }

  private static RdfEntityDiff buildDiff(
      final DiffRequest request, final Model fromModel, final Model toModel) {
    return new RdfEntityDiff()
        .withEntityType(request.entityType())
        .withEntityId(request.entityId())
        .withFromVersion(request.fromVersion())
        .withToVersion(request.toVersion())
        .withAddedStatements(difference(toModel, fromModel))
        .withRemovedStatements(difference(fromModel, toModel));
  }

  private Model versionModel(final String entityType, final UUID entityId, final Double version) {
    final EntityInterface entity = versionReader.read(entityType, entityId, version);
    final Model source = translator.toRdf(entity);
    try {
      return parseCanonical(canonicalizer.canonicalize(source));
    } finally {
      source.close();
    }
  }

  private static Model parseCanonical(final String canonicalNTriples) {
    final Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(canonicalNTriples).lang(Lang.NTRIPLES).parse(model);
    return model;
  }

  private static List<RdfStatement> difference(final Model left, final Model right) {
    final Model difference = left.difference(right);
    try {
      return difference.listStatements().toList().stream()
          .sorted(Comparator.comparing(RdfEntityDiffService::statementKey))
          .map(RdfEntityDiffService::toRdfStatement)
          .toList();
    } finally {
      difference.close();
    }
  }

  private static String statementKey(final Statement statement) {
    return NodeFmtLib.strNT(statement.getSubject().asNode())
        + NodeFmtLib.strNT(statement.getPredicate().asNode())
        + NodeFmtLib.strNT(statement.getObject().asNode());
  }

  private static RdfStatement toRdfStatement(final Statement statement) {
    final RdfStatement result =
        new RdfStatement()
            .withSubjectIri(URI.create(statement.getSubject().getURI()))
            .withPredicateIri(URI.create(statement.getPredicate().getURI()));
    populateObject(result, statement.getObject());
    return result;
  }

  private static void populateObject(final RdfStatement target, final RDFNode object) {
    if (object.isURIResource()) {
      target
          .withObjectKind(RdfObjectKind.IRI)
          .withObjectIri(URI.create(object.asResource().getURI()));
    } else if (object.isLiteral()) {
      populateLiteral(target, object.asLiteral());
    } else {
      throw new IllegalStateException("Canonical RDF diff contains an unsupported object node");
    }
  }

  private static void populateLiteral(final RdfStatement target, final Literal literal) {
    target
        .withObjectKind(RdfObjectKind.LITERAL)
        .withLiteralValue(literal.getLexicalForm())
        .withDatatypeIri(optionalUri(literal.getDatatypeURI()))
        .withLanguage(optionalText(literal.getLanguage()));
  }

  private static URI optionalUri(final String value) {
    final URI uri = nullOrEmpty(value) ? null : URI.create(value);
    return uri;
  }

  private static String optionalText(final String value) {
    final String text = nullOrEmpty(value) ? null : value;
    return text;
  }

  private static void requireVersion(final String parameterName, final Double version) {
    if (version == null || !Double.isFinite(version) || version <= 0.0) {
      throw new BadRequestException(parameterName + " must be a positive finite entity version");
    }
  }

  private static EntityInterface readVersion(
      final String entityType, final UUID entityId, final Double version) {
    return Entity.getEntityRepository(entityType).getVersion(entityId, version.toString());
  }

  @FunctionalInterface
  interface EntityVersionReader {
    EntityInterface read(String entityType, UUID entityId, Double version);
  }

  @FunctionalInterface
  interface EntityRdfTranslator {
    Model toRdf(EntityInterface entity);
  }

  private record DiffRequest(
      String entityType, UUID entityId, Double fromVersion, Double toVersion) {}
}
