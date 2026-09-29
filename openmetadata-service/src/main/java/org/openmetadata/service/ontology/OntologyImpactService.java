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

import com.auth0.jwt.exceptions.JWTVerificationException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.DeleteOntologyResource;
import org.openmetadata.schema.api.data.MoveGlossaryTermRequest;
import org.openmetadata.schema.api.data.OntologyDeleteResult;
import org.openmetadata.schema.api.data.OntologyImpactOperation;
import org.openmetadata.schema.api.data.OntologyImpactReport;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.security.jwt.InternalActionTokenSigner;
import org.openmetadata.service.security.jwt.InternalActionTokenSigner.Claims;
import org.openmetadata.service.util.RestUtil.DeleteResponse;

/** Computes version-bound ontology impacts and enforces their confirmation at deletion time. */
public final class OntologyImpactService {
  static final Duration DEFAULT_TOKEN_TTL = Duration.ofMinutes(2);
  static final int ASSET_PREVIEW_LIMIT = 100;
  private static final String DELETE_PURPOSE = "ontology-delete";
  private static final String SHA_256 = "SHA-256";
  private static final Set<String> REASSIGNMENT_TYPES =
      Set.of(Entity.GLOSSARY, Entity.GLOSSARY_TERM);

  private final GlossaryTermRepository repository;
  private final InternalActionTokenSigner tokenSigner;
  private final Clock clock;
  private final Duration tokenTtl;

  public OntologyImpactService(
      final GlossaryTermRepository repository,
      final InternalActionTokenSigner tokenSigner,
      final Clock clock,
      final Duration tokenTtl) {
    this.repository = Objects.requireNonNull(repository);
    this.tokenSigner = Objects.requireNonNull(tokenSigner);
    this.clock = Objects.requireNonNull(clock);
    this.tokenTtl = requirePositive(tokenTtl);
  }

  public static OntologyImpactService createDefault(final GlossaryTermRepository repository) {
    final Clock clock = Clock.systemUTC();
    return new OntologyImpactService(
        repository, InternalActionTokenSigner.createDefault(clock), clock, DEFAULT_TOKEN_TTL);
  }

  public OntologyImpactReport previewDelete(final UUID termId, final String principal) {
    final ImpactSnapshot snapshot = loadSnapshot(termId);
    final Instant generatedAt = clock.instant();
    final Instant expiresAt = generatedAt.plus(tokenTtl);
    final String token = sign(snapshot, principal, expiresAt);
    return report(snapshot, generatedAt, expiresAt, token);
  }

  public OntologyDeleteResult delete(
      final UUID termId, final DeleteOntologyResource request, final String principal) {
    final ImpactSnapshot snapshot = loadSnapshot(termId);
    verify(request.getImpactToken(), snapshot, principal);
    final DeletionPlan plan = deletionPlan(request, snapshot);
    final int reassignedChildren = reassignChildren(snapshot, plan.target(), principal);
    final DeleteResponse<GlossaryTerm> response =
        repository.delete(principal, termId, plan.cascade(), plan.hardDelete());
    return result(response.entity(), reassignedChildren, plan);
  }

  private ImpactSnapshot loadSnapshot(final UUID termId) {
    final GlossaryTerm term =
        repository.get(
            null,
            termId,
            repository.getFields("relatedTerms,conceptMappings"),
            Include.NON_DELETED,
            false);
    return new ImpactSnapshot(term, dependencies(term));
  }

  private Dependencies dependencies(final GlossaryTerm term) {
    final List<EntityReference> children =
        repository.findTo(
            term.getId(), Entity.GLOSSARY_TERM, Relationship.CONTAINS, Entity.GLOSSARY_TERM);
    final ResultList<EntityReference> assetPage =
        repository.getGlossaryTermAssets(term.getId(), ASSET_PREVIEW_LIMIT, 0);
    final int assetCount = repository.getGlossaryTermAssetCount(term.getFullyQualifiedName());
    return new Dependencies(
        immutable(children),
        immutable(term.getRelatedTerms()),
        immutable(assetPage.getData()),
        assetCount,
        immutable(term.getConceptMappings()));
  }

  private String sign(
      final ImpactSnapshot snapshot, final String principal, final Instant expiresAt) {
    final Claims claims =
        new Claims(
            DELETE_PURPOSE,
            snapshot.term().getId().toString(),
            principal,
            revision(snapshot.term()),
            fingerprint(snapshot),
            expiresAt);
    return tokenSigner.sign(claims);
  }

  private OntologyImpactReport report(
      final ImpactSnapshot snapshot,
      final Instant generatedAt,
      final Instant expiresAt,
      final String token) {
    final Dependencies dependencies = snapshot.dependencies();
    return new OntologyImpactReport()
        .withResource(snapshot.term().getEntityReference())
        .withOperation(OntologyImpactOperation.DELETE)
        .withBaseVersion(snapshot.term().getVersion())
        .withGeneratedAt(generatedAt.toEpochMilli())
        .withExpiresAt(expiresAt.toEpochMilli())
        .withImpactToken(token)
        .withChildren(dependencies.children())
        .withRelationships(dependencies.relationships())
        .withBoundAssets(dependencies.assets())
        .withBoundAssetCount(dependencies.assetCount())
        .withBoundAssetsTruncated(dependencies.assets().size() < dependencies.assetCount())
        .withConceptMappings(dependencies.mappings())
        .withShaclRecheckRequired(true);
  }

  private void verify(final String token, final ImpactSnapshot snapshot, final String principal) {
    final Claims claims = verifiedClaims(token);
    requireClaim(principal, claims.principal(), "principal");
    requireClaim(snapshot.term().getId().toString(), claims.subject(), "resource");
    requireClaim(revision(snapshot.term()), claims.revision(), "version");
    requireClaim(fingerprint(snapshot), claims.fingerprint(), "impact snapshot");
  }

  private Claims verifiedClaims(final String token) {
    final Claims claims;
    try {
      claims = tokenSigner.verify(token, DELETE_PURPOSE);
    } catch (JWTVerificationException exception) {
      throw new IllegalArgumentException("Ontology impact token is invalid or expired", exception);
    }
    return claims;
  }

  private static DeletionPlan deletionPlan(
      final DeleteOntologyResource request, final ImpactSnapshot snapshot) {
    final EntityReference target = request.getReassignChildrenTo();
    final boolean cascade = Boolean.TRUE.equals(request.getCascadeConfirmed());
    validateDeletionChoice(target, cascade, snapshot.dependencies().children());
    validateReassignmentTarget(snapshot.term().getId(), target, snapshot.dependencies().children());
    return new DeletionPlan(target, cascade, Boolean.TRUE.equals(request.getHardDelete()));
  }

  private int reassignChildren(
      final ImpactSnapshot snapshot, final EntityReference target, final String principal) {
    int reassigned = 0;
    if (target != null) {
      final MoveGlossaryTermRequest move = new MoveGlossaryTermRequest().withParent(target);
      validateMoves(snapshot.dependencies().children(), move);
      applyMoves(snapshot.dependencies().children(), move, principal);
      reassigned = snapshot.dependencies().children().size();
    }
    return reassigned;
  }

  private void validateMoves(
      final List<EntityReference> children, final MoveGlossaryTermRequest move) {
    children.forEach(child -> repository.validateMoveOperation(child.getId(), move));
  }

  private void applyMoves(
      final List<EntityReference> children,
      final MoveGlossaryTermRequest move,
      final String principal) {
    children.forEach(child -> repository.moveGlossaryTerm(child.getId(), move, principal));
  }

  private static OntologyDeleteResult result(
      final GlossaryTerm deleted, final int reassignedChildren, final DeletionPlan plan) {
    return new OntologyDeleteResult()
        .withResource(deleted.getEntityReference())
        .withReassignedChildren(reassignedChildren)
        .withCascaded(plan.cascade())
        .withHardDeleted(plan.hardDelete());
  }

  private static void validateDeletionChoice(
      final EntityReference target, final boolean cascade, final List<EntityReference> children) {
    if (target != null && cascade) {
      throw new IllegalArgumentException(
          "Choose child reassignment or explicit cascade confirmation, not both");
    }
    if (!nullOrEmpty(children) && target == null && !cascade) {
      throw new IllegalArgumentException(
          "Glossary term has children; reassign them or explicitly confirm cascade deletion");
    }
  }

  private static void validateReassignmentTarget(
      final UUID sourceId, final EntityReference target, final List<EntityReference> children) {
    if (target != null) {
      requireSupportedTarget(target);
      if (sourceId.equals(target.getId()) || contains(children, target.getId())) {
        throw new IllegalArgumentException(
            "Child reassignment target cannot be the deleted term or one of its children");
      }
    }
  }

  private static void requireSupportedTarget(final EntityReference target) {
    if (target.getId() == null || !REASSIGNMENT_TYPES.contains(target.getType())) {
      throw new IllegalArgumentException(
          "Child reassignment target must reference a glossary or glossary term");
    }
  }

  private static boolean contains(final List<EntityReference> references, final UUID id) {
    return references.stream().map(EntityReference::getId).anyMatch(id::equals);
  }

  private static void requireClaim(
      final String expected, final String actual, final String claimName) {
    if (!Objects.equals(expected, actual)) {
      throw new IllegalArgumentException(
          "Ontology impact token no longer matches the current " + claimName);
    }
  }

  private static String revision(final GlossaryTerm term) {
    return Double.toString(term.getVersion());
  }

  private static String fingerprint(final ImpactSnapshot snapshot) {
    final StringBuilder canonical = new StringBuilder();
    appendTerm(canonical, snapshot.term());
    appendDependencies(canonical, snapshot.dependencies());
    return sha256(canonical.toString());
  }

  private static void appendTerm(final StringBuilder canonical, final GlossaryTerm term) {
    canonical
        .append(term.getId())
        .append('|')
        .append(revision(term))
        .append('|')
        .append(term.getUpdatedAt());
  }

  private static void appendDependencies(
      final StringBuilder canonical, final Dependencies dependencies) {
    appendSorted(
        canonical, dependencies.children().stream().map(OntologyImpactService::referenceKey));
    appendSorted(
        canonical,
        dependencies.relationships().stream().map(OntologyImpactService::relationshipKey));
    appendSorted(
        canonical, dependencies.assets().stream().map(OntologyImpactService::referenceKey));
    canonical.append('|').append(dependencies.assetCount());
    appendSorted(
        canonical, dependencies.mappings().stream().map(OntologyImpactService::mappingKey));
  }

  private static void appendSorted(final StringBuilder canonical, final Stream<String> values) {
    values.sorted().forEach(value -> canonical.append('|').append(value));
  }

  private static String referenceKey(final EntityReference reference) {
    return reference.getType() + ':' + reference.getId();
  }

  private static String relationshipKey(final TermRelation relationship) {
    final String stableId =
        relationship.getId() == null
            ? referenceKey(relationship.getTerm()) + ':' + relationship.getRelationType()
            : relationship.getId().toString();
    return stableId;
  }

  private static String mappingKey(final ConceptMapping mapping) {
    return mapping.getConceptIri() + ":" + mapping.getMappingType() + ":" + mapping.getSchemeIri();
  }

  private static String sha256(final String value) {
    final byte[] digest;
    try {
      digest = MessageDigest.getInstance(SHA_256).digest(value.getBytes(StandardCharsets.UTF_8));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("Required SHA-256 digest is unavailable", exception);
    }
    return HexFormat.of().formatHex(digest);
  }

  private static Duration requirePositive(final Duration duration) {
    if (duration == null || duration.isZero() || duration.isNegative()) {
      throw new IllegalArgumentException("Ontology impact token TTL must be positive");
    }
    return duration;
  }

  private static <T> List<T> immutable(final List<T> values) {
    return nullOrEmpty(values) ? List.of() : List.copyOf(values);
  }

  private record ImpactSnapshot(GlossaryTerm term, Dependencies dependencies) {}

  private record Dependencies(
      List<EntityReference> children,
      List<TermRelation> relationships,
      List<EntityReference> assets,
      int assetCount,
      List<ConceptMapping> mappings) {}

  private record DeletionPlan(EntityReference target, boolean cascade, boolean hardDelete) {}
}
