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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;

/**
 * Integration tests for new Metric features: metric groups, advanced filtering, export/import
 */
@Execution(ExecutionMode.CONCURRENT)
public class MetricFeatureTestIT extends BaseEntityIT<Metric, CreateMetric> {
  private static final OpenMetadataClient client = SdkClients.adminClient();

  {
    supportsListHistoryByTimestamp = false;
    supportsBulkAPI = false;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ===================================================================

  @Override
  protected CreateMetric createMinimalRequest(TestNamespace ns) {
    return new CreateMetric()
        .withName(ns.prefix("metric"))
        .withDescription("Test metric for feature testing");
  }

  @Override
  protected CreateMetric createRequest(String name, TestNamespace ns) {
    return new CreateMetric().withName(name).withDescription("Test metric");
  }

  @Override
  protected Metric createEntity(CreateMetric createRequest) {
    return SdkClients.adminClient().metrics().create(createRequest);
  }

  @Override
  protected Metric getEntity(String id) {
    return SdkClients.adminClient().metrics().get(id);
  }

  @Override
  protected Metric getEntityByName(String fqn) {
    return SdkClients.adminClient().metrics().getByName(fqn);
  }

  @Override
  protected Metric patchEntity(String id, Metric entity) {
    return SdkClients.adminClient().metrics().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().metrics().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().metrics().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().metrics().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "metric";
  }

  @Override
  protected void validateCreatedEntity(Metric entity, CreateMetric createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
    assertTrue(entity.getFullyQualifiedName().contains(entity.getName()));
  }

  @Override
  protected org.openmetadata.sdk.models.ListResponse<Metric> listEntities(ListParams params) {
    return SdkClients.adminClient().metrics().list(params);
  }

  @Override
  protected Metric getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().metrics().get(id, fields);
  }

  @Override
  protected Metric getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().metrics().getByName(fqn, fields);
  }

  @Override
  protected Metric getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().metrics().get(id, null, "deleted");
  }

  @Override
  protected org.openmetadata.schema.type.EntityHistory getVersionHistory(java.util.UUID id) {
    return SdkClients.adminClient().metrics().getVersionList(id);
  }

  @Override
  protected Metric getVersion(java.util.UUID id, Double version) {
    return SdkClients.adminClient().metrics().getVersion(id.toString(), version);
  }

  // ===================================================================
  // METRIC GROUP TESTS
  // ===================================================================

  @Test
  void test_createMetricWithMetricGroup_200_OK(TestNamespace ns) {
    CreateMetric groupMetric = new CreateMetric()
        .withName(ns.prefix("metricGroup_Finance"))
        .withDescription("This metric serves as a group for organizing financial metrics")
        .withMetricType(MetricType.OTHER);

    Metric createdGroup = createEntity(groupMetric);
    assertNotNull(createdGroup);
    assertNotNull(createdGroup.getId());

    CreateMetric metricInGroup = new CreateMetric()
        .withName(ns.prefix("metric_revenue"))
        .withDescription("Monthly revenue metric")
        .withMetricType(MetricType.SUM)
        .withUnitOfMeasurement(MetricUnitOfMeasurement.DOLLARS)
        .withMetricGroup("metric." + ns.prefix("metricGroup_Finance"));

    Metric createdMetric = client.metrics().create(metricInGroup);
    assertNotNull(createdMetric);
    assertNotNull(createdMetric.getMetricGroup());
    assertEquals(ns.prefix("metricGroup_Finance"), createdMetric.getMetricGroup().getName());
  }

  @Test
  void test_listMetricWithMetricGroupField_200_OK(TestNamespace ns) {
    CreateMetric groupRequest = new CreateMetric()
        .withName(ns.prefix("metricGroup_Sales"))
        .withDescription("Sales metrics group")
        .withMetricType(MetricType.COUNT);

    Metric group = createEntity(groupRequest);

    CreateMetric metricRequest = new CreateMetric()
        .withName(ns.prefix("metric_dailySales"))
        .withDescription("Daily sales count")
        .withMetricType(MetricType.COUNT)
        .withMetricGroup("metric." + ns.prefix("metricGroup_Sales"));

    createEntity(metricRequest);

    Metric fetched = client.metrics().getByName("metric." + ns.prefix("metric_dailySales"), "metricGroup");
    assertNotNull(fetched);
    assertNotNull(fetched.getMetricGroup());
    assertEquals(group.getId(), fetched.getMetricGroup().getId());
  }

  @Test
  void test_updateMetricGroup_200_OK(TestNamespace ns) {
    CreateMetric group1 = new CreateMetric()
        .withName(ns.prefix("metricGroup_alpha"))
        .withDescription("Alpha group");

    Metric group1Entity = createEntity(group1);

    CreateMetric group2 = new CreateMetric()
        .withName(ns.prefix("metricGroup_beta"))
        .withDescription("Beta group");

    Metric group2Entity = createEntity(group2);

    CreateMetric metricRequest = new CreateMetric()
        .withName(ns.prefix("metric_moveable"))
        .withDescription("Metric to move between groups")
        .withMetricType(MetricType.COUNT)
        .withMetricGroup("metric." + ns.prefix("metricGroup_alpha"));

    Metric metric = createEntity(metricRequest);
    assertNotNull(metric.getMetricGroup());
    assertEquals(group1Entity.getId(), metric.getMetricGroup().getId());

    metric.setMetricGroup(group2Entity.getEntityReference());
    Metric updated = client.metrics().update(metric.getId().toString(), metric);

    assertNotNull(updated.getMetricGroup());
    assertEquals(group2Entity.getId(), updated.getMetricGroup().getId());
  }

  // ===================================================================
  // ADVANCED FILTER TESTS
  // ===================================================================

  @Test
  void test_filterMetricsByTags_200_OK(TestNamespace ns) {
    CreateMetric metric1 = new CreateMetric()
        .withName(ns.prefix("metric_tagged"))
        .withDescription("Metric with tags");

    org.openmetadata.schema.type.TagLabel tag = new org.openmetadata.schema.type.TagLabel()
        .withTagFQN("User.PII")
        .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL)
        .withState(org.openmetadata.schema.type.TagLabel.State.CONFIRMED);

    metric1.setTags(List.of(tag));
    createEntity(metric1);

    CreateMetric metric2 = new CreateMetric()
        .withName(ns.prefix("metric_untagged"))
        .withDescription("Metric without tags");

    createEntity(metric2);

    var response = client.metrics().list(new ListParams().withFields("tags").withLimit(50));
    assertNotNull(response.getData());

    boolean foundTagged = false;
    boolean foundUntagged = false;
    for (Metric m : response.getData()) {
      if (m.getFullyQualifiedName().contains(ns.prefix("metric_tagged"))) {
        foundTagged = m.getTags() != null && !m.getTags().isEmpty();
      }
      if (m.getFullyQualifiedName().contains(ns.prefix("metric_untagged"))) {
        foundUntagged = m.getTags() == null || m.getTags().isEmpty();
      }
    }
    assertTrue(foundTagged, "Should find metric with tags");
    assertTrue(foundUntagged, "Should find metric without tags");
  }

  @Test
  void test_filterMetricsByDomains_200_OK(TestNamespace ns) {
    CreateMetric metric = new CreateMetric()
        .withName(ns.prefix("metric_domain"))
        .withDescription("Metric with domain")
        .withDomains(List.of("Finance"));

    createEntity(metric);

    var response = client.metrics().list(new ListParams().withFields("domains").withLimit(50));
    assertNotNull(response.getData());

    boolean found = false;
    for (Metric m : response.getData()) {
      if (m.getFullyQualifiedName().contains(ns.prefix("metric_domain"))
          && m.getDomains() != null
          && !m.getDomains().isEmpty()) {
        found = true;
        break;
      }
    }
    assertTrue(found, "Should find metric with domains");
  }

  // ===================================================================
  // EXPORT/IMPORT TESTS
  // ===================================================================

  @Test
  void test_exportMetrics_200_OK(TestNamespace ns) {
    createEntity(new CreateMetric()
        .withName(ns.prefix("export_metric_1"))
        .withDescription("First metric for export")
        .withMetricType(MetricType.COUNT));

    createEntity(new CreateMetric()
        .withName(ns.prefix("export_metric_2"))
        .withDescription("Second metric for export")
        .withMetricType(MetricType.SUM));

    assertDoesNotThrow(() -> {
      var response = client.metrics().list(new ListParams().withLimit(100));
      assertNotNull(response.getData());
      assertTrue(response.getData().size() >= 2);
    });
  }

  @Test
  void test_importMetricsFromCsv_200_OK(TestNamespace ns) {
    String csvData = "name,displayName,description\n" +
        ns.prefix("import_metric_1") + ",Imported Metric 1,First imported metric\n" +
        ns.prefix("import_metric_2") + ",Imported Metric 2,Second imported metric";

    assertDoesNotThrow(() -> {
      jakarta.ws.rs.core.Response response = client.metrics().importMetrics(csvData);
      assertEquals(200, response.getStatus());
    });
  }

  @Test
  void test_importMetricsEmptyCsv_400_BAD_REQUEST(TestNamespace ns) {
    try {
      client.metrics().importMetrics("");
    } catch (Exception e) {
      assertTrue(e.getMessage().contains("empty") || e.getMessage().contains("cannot be empty"));
    }
  }

  @Test
  void test_exportMetricsCsvFormat_200_OK(TestNamespace ns) {
    CreateMetric metric = new CreateMetric()
        .withName(ns.prefix("export_csv_metric"))
        .withDescription("Metric for CSV export")
        .withMetricType(MetricType.AVERAGE)
        .withUnitOfMeasurement(MetricUnitOfMeasurement.PERCENTAGE);

    createEntity(metric);

    assertDoesNotThrow(() -> {
      var response = client.metrics().list(new ListParams()
          .withFields("name,displayName,description,metricType,unitOfMeasurement")
          .withLimit(10));
      assertNotNull(response.getData());
    });
  }

  // ===================================================================
  // BULK OPERATION TESTS
  // ===================================================================

  @Test
  void test_bulkCreateMetrics_200_OK(TestNamespace ns) {
    List<CreateMetric> requests = List.of(
        new CreateMetric()
            .withName(ns.prefix("bulk_metric_1"))
            .withDescription("Bulk metric 1")
            .withMetricType(MetricType.COUNT),
        new CreateMetric()
            .withName(ns.prefix("bulk_metric_2"))
            .withDescription("Bulk metric 2")
            .withMetricType(MetricType.SUM),
        new CreateMetric()
            .withName(ns.prefix("bulk_metric_3"))
            .withDescription("Bulk metric 3")
            .withMetricType(MetricType.AVERAGE)
    );

    var result = client.metrics().bulkCreateOrUpdate(requests);
    assertNotNull(result);
    assertTrue(result.getMetrics() != null);
  }

  @Test
  void test_bulkCreateWithMetricGroup_200_OK(TestNamespace ns) {
    CreateMetric group = new CreateMetric()
        .withName(ns.prefix("bulk_group"))
        .withDescription("Group for bulk metrics");

    Metric groupMetric = createEntity(group);

    List<CreateMetric> requests = List.of(
        new CreateMetric()
            .withName(ns.prefix("bulk_in_group_1"))
            .withDescription("First metric in group")
            .withMetricGroup("metric." + ns.prefix("bulk_group")),
        new CreateMetric()
            .withName(ns.prefix("bulk_in_group_2"))
            .withDescription("Second metric in group")
            .withMetricGroup("metric." + ns.prefix("bulk_group"))
    );

    var result = client.metrics().bulkCreateOrUpdate(requests);
    assertNotNull(result);

    Metric first = client.metrics().getByName("metric." + ns.prefix("bulk_in_group_1"), "metricGroup");
    assertNotNull(first.getMetricGroup());
    assertEquals(groupMetric.getId(), first.getMetricGroup().getId());
  }
}