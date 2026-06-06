/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.junit.jupiter.api.Test;

/**
 * Guards the CollectionDAO decomposition. CollectionDAO was split into domain aggregator
 * interfaces (RdfInfraDAOs, SearchReindexDAOs, ...) that it `extends`. JDBI's SqlObjectFactory
 * builds its handler map from {@code sqlObjectType.getMethods()}, which returns inherited public
 * methods, so every {@code @CreateSqlObject} accessor moved to an extended interface must remain
 * visible (and annotated) through CollectionDAO for the runtime wiring to keep working.
 */
class CollectionDAOCompositionTest {

  private static final Map<String, String> MOVED_ACCESSOR_TO_INTERFACE =
      Map.ofEntries(
          Map.entry("rdfIndexJobDAO", "RdfInfraDAOs"),
          Map.entry("rdfIndexServerStatsDAO", "RdfInfraDAOs"),
          Map.entry("searchIndexJobDAO", "SearchReindexDAOs"),
          Map.entry("searchIndexServerStatsDAO", "SearchReindexDAOs"),
          Map.entry("aiApplicationDAO", "AiGovernanceDAOs"),
          Map.entry("mcpServiceDAO", "AiGovernanceDAOs"),
          Map.entry("feedDAO", "FeedDAOs"),
          Map.entry("taskDAO", "FeedDAOs"),
          Map.entry("tagUsageDAO", "ClassificationTagDAOs"),
          Map.entry("classificationDAO", "ClassificationTagDAOs"),
          Map.entry("testCaseDAO", "TimeSeriesDAOs"),
          Map.entry("testCaseResultTimeSeriesDao", "TimeSeriesDAOs"),
          Map.entry("activityStreamDAO", "ActivityAuditDAOs"),
          Map.entry("auditLogDAO", "ActivityAuditDAOs"),
          Map.entry("domainDAO", "GovernanceDAOs"),
          Map.entry("dataContractDAO", "GovernanceDAOs"),
          Map.entry("eventSubscriptionDAO", "EventSubscriptionDAOs"),
          Map.entry("folderDAO", "KnowledgeAssetDAOs"),
          Map.entry("knowledgePageDAO", "KnowledgeAssetDAOs"),
          Map.entry("systemDAO", "SystemTokenDAOs"),
          Map.entry("getTokenDAO", "SystemTokenDAOs"),
          Map.entry("databaseDAO", "DataAssetServiceDAOs"),
          Map.entry("dashboardDAO", "DataAssetServiceDAOs"),
          Map.entry("containerDAO", "DataAssetServiceDAOs"),
          Map.entry("dbServiceDAO", "DataAssetServiceDAOs"),
          Map.entry("tableDAO", "EntityDataDAOs"),
          Map.entry("pipelineDAO", "EntityDataDAOs"),
          Map.entry("userDAO", "AccessControlDAOs"),
          Map.entry("teamDAO", "AccessControlDAOs"),
          Map.entry("changeEventDAO", "AccessControlDAOs"),
          Map.entry("workflowDAO", "WorkflowDocStoreDAOs"),
          Map.entry("oauthClientDAO", "OAuthDAOs"),
          Map.entry("relationshipDAO", "CoreRelationshipDAOs"),
          Map.entry("fieldRelationshipDAO", "CoreRelationshipDAOs"),
          Map.entry("entityExtensionDAO", "CoreRelationshipDAOs"));

  @Test
  void inheritedCreateSqlObjectAccessorsRemainVisibleAndAnnotated() throws NoSuchMethodException {
    Set<String> visibleMethods =
        Arrays.stream(CollectionDAO.class.getMethods())
            .map(Method::getName)
            .collect(Collectors.toSet());

    for (Map.Entry<String, String> entry : MOVED_ACCESSOR_TO_INTERFACE.entrySet()) {
      String accessor = entry.getKey();
      assertTrue(
          visibleMethods.contains(accessor),
          accessor + " (moved to " + entry.getValue() + ") is not visible via getMethods()");
      Method method = CollectionDAO.class.getMethod(accessor);
      assertNotNull(
          method.getAnnotation(CreateSqlObject.class),
          accessor + " lost its @CreateSqlObject annotation after the move");
    }
  }

  @Test
  void accessorsDeclaredDirectlyOnCollectionDaoStillWire() throws NoSuchMethodException {
    assertNotNull(CollectionDAO.class.getMethod("assetDAO").getAnnotation(CreateSqlObject.class));
  }
}
