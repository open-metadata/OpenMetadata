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
package org.openmetadata.service.aicontext;

import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.AIContextFinder.CandidateAsset;
import org.openmetadata.service.aicontext.AIContextFinder.FoundContext;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/** Knowledge-layer authorization shared by the find-context REST endpoint and MCP tool. */
@Slf4j
public final class AIContextFinderAccess {
  public static final List<String> KNOWLEDGE_TYPES =
      List.of(Entity.GLOSSARY_TERM, Entity.METRIC, Entity.PAGE);

  private AIContextFinderAccess() {}

  /** The caller must hold VIEW_ALL on every knowledge type the finder surfaces. */
  public static void authorizeKnowledgeAccess(
      Authorizer authorizer, SecurityContext securityContext) {
    for (String knowledgeType : KNOWLEDGE_TYPES) {
      authorizer.authorize(
          securityContext,
          new OperationContext(knowledgeType, VIEW_ALL),
          new ResourceContext<>(knowledgeType));
    }
  }

  /**
   * Drops candidate assets the caller cannot view. Glossary-routed candidates are already
   * RBAC-filtered by the subject-scoped search; this guards the relationship-routed ones (metric
   * APPLIED_TO, page HAS), which are read straight from the entity-relationship table.
   */
  public static FoundContext filterCandidates(
      FoundContext found, Authorizer authorizer, SecurityContext securityContext) {
    List<CandidateAsset> visible = new ArrayList<>();
    for (CandidateAsset asset : found.candidateAssets()) {
      if (canView(asset, authorizer, securityContext)) {
        visible.add(asset);
      }
    }
    return new FoundContext(found.items(), visible);
  }

  private static boolean canView(
      CandidateAsset asset, Authorizer authorizer, SecurityContext securityContext) {
    return canView(asset.entityType(), asset.fullyQualifiedName(), authorizer, securityContext);
  }

  /** True when the caller holds VIEW_BASIC on the asset; false (never throws) otherwise. */
  public static boolean canView(
      String entityType, String fqn, Authorizer authorizer, SecurityContext securityContext) {
    boolean visible = false;
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, VIEW_BASIC),
          new ResourceContext<>(entityType, null, fqn));
      visible = true;
    } catch (Exception e) {
      LOG.debug("Dropping asset {} not viewable by caller: {}", fqn, e.getMessage());
    }
    return visible;
  }
}
