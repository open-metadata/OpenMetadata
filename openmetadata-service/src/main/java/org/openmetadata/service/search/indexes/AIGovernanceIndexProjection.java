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
package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Projects AI governance metadata onto flat fields that the AI Governance Studio's
 * dashboards, registry filters, and Shadow AI screen aggregate against.
 *
 * <p>The raw GovernanceMetadata blocks on {@code AIApplication} and {@code McpServer}
 * have nested compliance records, so common UI questions (e.g. "how many high-risk
 * EU AI Act assets are there?") would otherwise require nested ES queries. We promote
 * the most common dimensions to the top level of the search doc as keyword/boolean/date
 * fields so terms aggregations stay flat and fast.
 *
 * <p>The two entities generate independent {@code GovernanceMetadata} Java types from
 * their respective JSON schemas, so this helper accepts the value as {@link Object}
 * and converts via Jackson to a normalized {@code Map<String, Object>} for projection.
 */
@Slf4j
final class AIGovernanceIndexProjection {

  private static final String AI_GOVERNANCE_KEY = "aiGovernance";
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  private AIGovernanceIndexProjection() {}

  static void project(Map<String, Object> doc, Object governance, Object assetSubtype) {
    Map<String, Object> projection = new LinkedHashMap<>();
    if (assetSubtype != null) {
      projection.put("assetSubtype", assetSubtype.toString());
    }
    Map<String, Object> source = toMap(governance);
    if (source == null) {
      doc.put(AI_GOVERNANCE_KEY, projection);
      return;
    }
    projectRegistration(projection, source);
    projectRisk(projection, source);
    projectDataClassification(projection, source);
    projectDetection(projection, source);
    projectCompliance(projection, source);
    doc.put(AI_GOVERNANCE_KEY, projection);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> toMap(Object governance) {
    Map<String, Object> result = null;
    if (governance instanceof Map<?, ?>) {
      result = (Map<String, Object>) governance;
    } else if (governance != null) {
      try {
        ObjectMapper mapper = JsonUtils.getObjectMapper();
        result = mapper.convertValue(governance, MAP_TYPE);
      } catch (IllegalArgumentException error) {
        LOG.warn("Unable to convert AI governance metadata to Map for projection", error);
      }
    }
    return result;
  }

  private static void projectRegistration(
      Map<String, Object> projection, Map<String, Object> source) {
    Object status = source.get("registrationStatus");
    if (status != null) {
      projection.put("registrationStatus", status.toString());
    }
  }

  private static void projectRisk(Map<String, Object> projection, Map<String, Object> source) {
    Map<String, Object> risk = asMap(source.get("riskAssessment"));
    if (risk != null && risk.get("riskLevel") != null) {
      projection.put("riskLevel", risk.get("riskLevel").toString());
    }
  }

  private static void projectDataClassification(
      Map<String, Object> projection, Map<String, Object> source) {
    Map<String, Object> classification = asMap(source.get("dataClassification"));
    if (classification == null) {
      return;
    }
    projection.put("accessesPii", Boolean.TRUE.equals(classification.get("accessesPII")));
    projection.put(
        "accessesSensitiveData", Boolean.TRUE.equals(classification.get("accessesSensitiveData")));
    List<Object> categories = asList(classification.get("dataCategories"));
    if (!nullOrEmpty(categories)) {
      projection.put("dataCategories", categories);
    }
  }

  private static void projectDetection(Map<String, Object> projection, Map<String, Object> source) {
    Map<String, Object> detection = asMap(source.get("detection"));
    if (detection == null) {
      return;
    }
    Map<String, Object> entry = new LinkedHashMap<>();
    putIfPresent(entry, "source", detection.get("source"));
    putIfPresent(entry, "severity", detection.get("severity"));
    putIfPresent(entry, "suspectedTeam", detection.get("suspectedTeam"));
    putIfPresent(entry, "detectedAt", detection.get("detectedAt"));
    List<Object> flags = asList(detection.get("flags"));
    if (!nullOrEmpty(flags)) {
      entry.put("flags", flags);
    }
    if (!entry.isEmpty()) {
      projection.put("detection", entry);
    }
  }

  private static void projectCompliance(
      Map<String, Object> projection, Map<String, Object> source) {
    Map<String, Object> aiCompliance = asMap(source.get("aiCompliance"));
    if (aiCompliance == null) {
      return;
    }
    List<Object> records = asList(aiCompliance.get("complianceRecords"));
    if (nullOrEmpty(records)) {
      return;
    }
    Map<String, String> statusByFramework = new LinkedHashMap<>();
    Set<String> regions = new LinkedHashSet<>();
    String euRiskClassification = null;
    Long lastAssessedAt = null;
    Integer affectedUserCount = null;
    for (Object recordEntry : records) {
      Map<String, Object> record = asMap(recordEntry);
      if (record == null) {
        continue;
      }
      Object framework = record.get("framework");
      Object status = record.get("status");
      if (framework != null && status != null) {
        statusByFramework.put(framework.toString(), status.toString());
      }
      Map<String, Object> euAIAct = asMap(record.get("euAIAct"));
      if (euAIAct != null
          && euAIAct.get("riskClassification") != null
          && euRiskClassification == null) {
        euRiskClassification = euAIAct.get("riskClassification").toString();
      }
      Map<String, Object> scope = asMap(record.get("scopeAndDeployment"));
      if (scope != null) {
        List<Object> deployRegions = asList(scope.get("deploymentRegions"));
        if (!nullOrEmpty(deployRegions)) {
          deployRegions.forEach(r -> regions.add(r.toString()));
        }
        Object users = scope.get("affectedUserCount");
        if (users instanceof Number && affectedUserCount == null) {
          affectedUserCount = ((Number) users).intValue();
        }
      }
      Object assessedAt = record.get("assessedAt");
      if (assessedAt instanceof Number) {
        long timestamp = ((Number) assessedAt).longValue();
        if (lastAssessedAt == null || timestamp > lastAssessedAt) {
          lastAssessedAt = timestamp;
        }
      }
    }
    if (!statusByFramework.isEmpty()) {
      projection.put("complianceStatus", statusByFramework);
      projection.put("frameworks", new ArrayList<>(statusByFramework.keySet()));
    }
    if (euRiskClassification != null) {
      projection.put("euRiskClassification", euRiskClassification);
    }
    if (!regions.isEmpty()) {
      projection.put("regions", new ArrayList<>(regions));
    }
    if (lastAssessedAt != null) {
      projection.put("lastAssessedAt", lastAssessedAt);
    }
    if (affectedUserCount != null) {
      projection.put("affectedUserCount", affectedUserCount);
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object value) {
    return value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
  }

  @SuppressWarnings("unchecked")
  private static List<Object> asList(Object value) {
    return value instanceof List<?> ? (List<Object>) value : null;
  }

  private static void putIfPresent(Map<String, Object> target, String key, Object value) {
    if (value != null) {
      target.put(key, value);
    }
  }
}
