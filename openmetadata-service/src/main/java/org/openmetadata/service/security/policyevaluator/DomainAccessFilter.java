/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Post-filter for subjects restricted by the seeded {@code DomainOnlyAccessRole}.
 *
 * <p>{@code DomainOnlyAccessPolicy} grants "All operations on All resources" whenever
 * {@link RuleEvaluator#hasDomain()} passes, and {@code hasDomain()} deliberately returns {@code
 * true} for a resource context that carries no concrete entity, leaving the narrowing to the caller.
 * The Data Quality CSV export and import flows resolve their test cases inside the repository, after
 * that decision has been made, so they apply the narrowing here. The rule mirrors the entity-level
 * decision {@code hasDomain()} makes: domainless entities are visible to everyone, otherwise the
 * subject must own the entity's domain or one of its ancestors.
 */
@Slf4j
public final class DomainAccessFilter {

  /** The principal {@code NoopFilter} installs when the deployment runs without authentication. */
  private static final String NO_AUTH_PRINCIPAL = "anonymous";

  private static final String UNRESOLVED_PRINCIPAL_MESSAGE =
      "Principal '%s' cannot be resolved to a user; refusing to run without domain filtering";

  private DomainAccessFilter() {}

  /** Returns true when the subject's view must be narrowed to its own domain hierarchy. */
  public static boolean shouldApply(SubjectContext subjectContext) {
    return subjectContext != null
        && !subjectContext.isAdmin()
        && !subjectContext.isBot()
        && subjectContext.hasDomainOnlyAccessRole();
  }

  /**
   * Resolves the subject behind a principal name. Background CSV jobs and repositories only carry
   * the principal name, never the request {@code SecurityContext}, so this is the same resolution
   * {@code CsvImportExportJobHandler} already performs for search-backed exports.
   *
   * <p>Fails closed. A principal that cannot be resolved to a user aborts the operation instead of
   * letting it run unfiltered — the subject resolves at execution time, not request time, so a user
   * deleted or renamed while an async export sat queued would otherwise silently disable filtering.
   * The single exemption is the fixed principal {@code NoopFilter} installs when the deployment runs
   * without authentication, and only when it resolves to no user at all — so a real user named
   * "anonymous" is filtered normally for as long as that user exists. The exemption is not reachable
   * from an authenticated request: {@code DefaultAuthorizer.authorize} resolves the same principal
   * first and rejects an unknown one before any of this runs.
   */
  public static SubjectContext resolveSubject(String principalName) {
    if (nullOrEmpty(principalName)) {
      throw new AuthorizationException(String.format(UNRESOLVED_PRINCIPAL_MESSAGE, principalName));
    }
    SubjectContext subjectContext = null;
    try {
      subjectContext = SubjectContext.getSubjectContext(principalName);
    } catch (EntityNotFoundException e) {
      if (!NO_AUTH_PRINCIPAL.equals(principalName)) {
        throw new AuthorizationException(
            String.format(UNRESOLVED_PRINCIPAL_MESSAGE, principalName), e);
      }
      LOG.debug("Principal '{}' has no user entity; running without authentication", principalName);
    }
    return subjectContext;
  }

  /**
   * Keeps only the entities whose domains the subject may see. Always returns an immutable list,
   * never {@code null}, whether or not any narrowing applied — callers must not rely on getting
   * their own list back.
   */
  public static <T extends EntityInterface> List<T> retainAccessible(
      List<T> entities, SubjectContext subjectContext) {
    List<T> candidates = listOrEmpty(entities);
    return shouldApply(subjectContext)
        ? candidates.stream().filter(e -> subjectContext.hasDomains(e.getDomains())).toList()
        : List.copyOf(candidates);
  }

  /**
   * Loads the entity whose version a bulk CSV import is about to bump, or {@code null} when it must
   * be left alone.
   *
   * <p>Both the target FQN and the repository it is resolved against come straight from the request,
   * so a caller picks the type and the name of the entity that gets a version bump, a
   * {@code bulkImport} ChangeDescription and a ChangeEvent — all writes, and all of which a target
   * outside the caller's domains must not receive.
   *
   * <p>A missing target and an inaccessible one are both skipped rather than failing the job: by
   * this point the rows are already written, so failing would misreport the import, and treating the
   * two alike keeps the job outcome from becoming a cross-domain existence oracle.
   */
  public static EntityInterface resolveAccessibleVersioningTarget(
      EntityRepository<EntityInterface> versioningRepo, String targetFqn, String principalName) {
    EntityInterface target = null;
    try {
      String fields = versioningRepo.isSupportsDomains() ? Entity.FIELD_DOMAINS : "";
      EntityInterface candidate =
          versioningRepo.getByName(
              null,
              targetFqn,
              new Fields(versioningRepo.getAllowedFields(), fields),
              Include.NON_DELETED,
              false);
      if (isAccessible(resolveSubject(principalName), candidate.getDomains())) {
        target = candidate;
      }
    } catch (EntityNotFoundException e) {
      LOG.debug("Bulk import versioning target '{}' no longer exists", targetFqn);
    }
    if (target == null) {
      LOG.info("Skipping bulk import versioning for target '{}'", targetFqn);
    }
    return target;
  }

  /** Returns true when the subject may read or write an entity carrying {@code domains}. */
  public static boolean isAccessible(SubjectContext subjectContext, List<EntityReference> domains) {
    return !shouldApply(subjectContext) || subjectContext.hasDomains(domains);
  }
}
