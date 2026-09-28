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

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;

/**
 * Post-filter for subjects restricted by the seeded {@code DomainOnlyAccessRole}.
 *
 * <p>{@code DomainOnlyAccessPolicy} grants "All operations on All resources" whenever
 * {@link RuleEvaluator#hasDomain()} passes, and {@code hasDomain()} deliberately returns {@code
 * true} for a resource context that carries no concrete entity, leaving the narrowing to the caller.
 * Flows that resolve their entities inside the repository, after that decision has been made, apply
 * the narrowing here. The rule mirrors the entity-level decision {@code hasDomain()} makes:
 * domainless entities are visible to everyone, otherwise the subject must own the entity's domain or
 * one of its ancestors.
 *
 * <p>Callers holding only a principal name resolve it with {@link
 * SubjectContext#getSubjectContext(String)}, which throws for a principal that no longer resolves to
 * a user rather than yielding an unfiltered subject.
 */
public final class DomainAccessFilter {

  private DomainAccessFilter() {}

  /**
   * Returns true when the subject's view must be narrowed to its own domain hierarchy. A bot holding
   * the role is narrowed like any other subject; exempting bots here left a bot-authenticated caller
   * seeing every domain's lineage and incidents even though the role had been assigned to it.
   */
  public static boolean shouldApply(SubjectContext subjectContext) {
    return subjectContext != null
        && !subjectContext.isAdmin()
        && subjectContext.hasDomainOnlyAccessRole();
  }

  /** Returns true when the subject may read or write an entity carrying {@code domains}. */
  public static boolean isAccessible(SubjectContext subjectContext, List<EntityReference> domains) {
    return !shouldApply(subjectContext) || subjectContext.hasDomains(domains);
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
}
