/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * Where the UI shows an entity, for a message that links to it. The caller's {@link
 * LinkFormatter} writes the link in its own markup.
 */
@Slf4j
public final class EntityUrls {
  private EntityUrls() {}

  /** Writes a link to the UI page at {@code prefix/fqn}, followed by {@code additionalInput}. */
  @FunctionalInterface
  public interface LinkFormatter {
    String getEntityUrl(String prefix, String fqn, String additionalInput);
  }

  public static String buildEntityUrl(
      String entityType, EntityInterface<?> entityInterface, LinkFormatter formatter) {
    String fqn = resolveFullyQualifiedName(entityType, entityInterface);
    String entityUrl = "";
    switch (entityType) {
      case Entity.TEST_CASE:
        if (entityInterface instanceof TestCase testCase) {
          entityUrl =
              formatter.getEntityUrl(
                  "test-case", testCase.getFullyQualifiedName(), "test-case-results");
        }
        break;

      case Entity.GLOSSARY_TERM:
        entityUrl = formatter.getEntityUrl(Entity.GLOSSARY, fqn, "");
        break;

      case Entity.TAG:
        entityUrl = formatter.getEntityUrl("tags", fqn.split("\\.")[0], "");
        break;

      case Entity.USER:
        entityUrl = formatter.getEntityUrl("users", fqn, "");
        break;

      case Entity.TEAM:
        entityUrl = formatter.getEntityUrl("settings/members/teams", fqn, "");
        break;

      case Entity.INGESTION_PIPELINE:
        entityUrl = getIngestionPipelineUrl(formatter, entityType, entityInterface);
        break;

      case Entity.DATA_CONTRACT:
        entityUrl = getDataContractUrl(formatter, entityType, entityInterface);
        break;

      default:
        entityUrl = formatter.getEntityUrl(entityType, fqn, "");
    }

    LOG.debug("buildEntityUrl for Alert: {}", entityUrl);
    return entityUrl;
  }

  // Helper function to resolve FQN if null or empty
  private static String resolveFullyQualifiedName(
      String entityType, EntityInterface<?> entityInterface) {
    String fqn = entityInterface.getFullyQualifiedName();
    if (nullOrEmpty(fqn)) {
      EntityInterface<?> result =
          Entity.getEntity(entityType, entityInterface.getId(), "id", Include.NON_DELETED);
      fqn = result.getFullyQualifiedName();
    }
    return fqn;
  }

  public static String getIngestionPipelineUrl(
      LinkFormatter formatter, String entityType, EntityInterface<?> entityInterface) {
    if (entityType.equals(Entity.INGESTION_PIPELINE)) {
      // Tags need to be redirected to Classification Page
      IngestionPipeline ingestionPipeline = (IngestionPipeline) entityInterface;
      EntityReference serviceRef = ingestionPipeline.getService();
      if (nullOrEmpty(serviceRef)) {
        serviceRef =
            ((IngestionPipeline)
                    Entity.getEntity(
                        ingestionPipeline.getEntityReference(), "service", Include.ALL))
                .getService();
      }
      // Specific Pipeline
      if (ingestionPipeline.getPipelineType().equals(PipelineType.TEST_SUITE)) {
        String suffix = ".testSuite";
        return !nullOrEmpty(serviceRef)
            ? formatter.getEntityUrl(
                "table",
                serviceRef
                    .getFullyQualifiedName()
                    .substring(0, serviceRef.getFullyQualifiedName().length() - suffix.length()),
                "profiler?activeTab=Data%20Quality")
            : "";
      } else if (ingestionPipeline.getPipelineType().equals(PipelineType.APPLICATION)) {
        return !nullOrEmpty(serviceRef)
            ? formatter.getEntityUrl(
                "automations", serviceRef.getFullyQualifiedName(), "automator-details")
            : "";
      } else {
        return !nullOrEmpty(serviceRef)
            ? formatter.getEntityUrl(
                String.format("service/%ss", serviceRef.getType()),
                serviceRef.getFullyQualifiedName(),
                "ingestions")
            : "";
      }
    }
    return "";
  }

  // Provide the URL of the table the Data Contract belongs to
  public static String getDataContractUrl(
      LinkFormatter formatter, String entityType, EntityInterface<?> entityInterface) {
    if (entityType.equals(Entity.DATA_CONTRACT)) {
      DataContract contract = (DataContract) entityInterface;
      EntityReference tableRef = contract.getEntity();

      tableRef = Entity.getEntityReferenceById(tableRef.getType(), tableRef.getId(), Include.ALL);
      return !nullOrEmpty(tableRef)
          ? formatter.getEntityUrl(tableRef.getType(), tableRef.getFullyQualifiedName(), "contract")
          : "";
    }
    return "";
  }
}
