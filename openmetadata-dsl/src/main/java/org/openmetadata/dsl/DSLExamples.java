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
package org.openmetadata.dsl;

import lombok.extern.slf4j.Slf4j;

/**
 * Examples demonstrating OpenMetadata DSL usage.
 */
@Slf4j
public class DSLExamples {

  public static void main(String[] args) {
    log.info("=== OpenMetadata DSL Examples ===\n");

    OpenMetadataDSL dsl = new OpenMetadataDSL();

    // Example 1: Basic entity check
    exampleBasicEntityCheck(dsl);

    // Example 2: Data quality monitoring
    exampleDataQualityMonitoring(dsl);

    // Example 3: Compliance check
    exampleComplianceCheck(dsl);

    // Example 4: Security monitoring
    exampleSecurityMonitoring(dsl);

    log.info("\n=== Examples Complete ===");
  }

  private static void exampleBasicEntityCheck(OpenMetadataDSL dsl) {
    log.info("--- Example 1: Basic Entity Check ---");

    String rule = "entity.entityType == 'table' AND hasTag('Business-Critical')";

    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("users", "table"))
        .build();

    boolean result = dsl.evaluateCondition(rule, context);
    log.info("Rule: {}", rule);
    log.info("Result: {}", result);
    log.info("");
  }

  private static void exampleDataQualityMonitoring(OpenMetadataDSL dsl) {
    log.info("--- Example 2: Data Quality Monitoring ---");

    String rule = "entity.entityType == 'table' " +
        "AND contains(entity.service.name, 'prod') " +
        "AND (isEmpty(entity.description) OR length(entity.owners) == 0)";

    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("orders", "table"))
        .build();

    boolean result = dsl.evaluateCondition(rule, context);
    log.info("Rule: {}", rule);
    log.info("Result: {}", result);
    log.info("");
  }

  private static void exampleComplianceCheck(OpenMetadataDSL dsl) {
    log.info("--- Example 3: Compliance & Governance ---");

    String rule = "contains(entity.name, 'customer') " +
        "AND NOT hasTag('GDPR-Compliant') " +
        "AND entity.entityType == 'table'";

    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("customer_data", "table"))
        .build();

    boolean result = dsl.evaluateCondition(rule, context);
    log.info("Rule: {}", rule);
    log.info("Result: {}", result);
    log.info("");
  }

  private static void exampleSecurityMonitoring(OpenMetadataDSL dsl) {
    log.info("--- Example 4: Security Monitoring ---");

    String rule = "contains(entity.name, 'ssn') " +
        "AND NOT hasTag('Security-Classified') " +
        "AND entity.entityType == 'table'";

    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("employee_ssn", "table"))
        .build();

    boolean result = dsl.evaluateCondition(rule, context);
    log.info("Rule: {}", rule);
    log.info("Result: {}", result);
    log.info("");
  }

  private static EntityInterface createMockEntity(String name, String type) {
    return new EntityInterface() {
      @Override
      public String getName() {
        return name;
      }

      @Override
      public String getFullyQualifiedName() {
        return "prod." + name;
      }

      @Override
      public String getDescription() {
        return null;
      }

      @Override
      public org.openmetadata.schema.type.EntityReference getEntityReference() {
        return org.openmetadata.schema.type.EntityReference.builder()
            .id(java.util.UUID.randomUUID())
            .name(name)
            .type(type)
            .build();
      }

      @Override
      public org.openmetadata.schema.type.EntityReference getService() {
        return org.openmetadata.schema.type.EntityReference.builder()
            .name("prod_mysql")
            .type("databaseService")
            .build();
      }

      @Override
      public java.util.List<org.openmetadata.schema.type.TagLabel> getTags() {
        return java.util.List.of(
            org.openmetadata.schema.type.TagLabel.builder()
                .tagFQN("Business-Critical")
                .build()
        );
      }

      @Override
      public java.util.List<org.openmetadata.schema.type.EntityReference> getOwners() {
        return null;
      }

      @Override
      public Long getUpdatedAt() {
        return System.currentTimeMillis();
      }

      @Override
      public String getId() {
        return java.util.UUID.randomUUID().toString();
      }

      @Override
      public org.openmetadata.schema.type.EntityStatus getStatus() {
        return org.openmetadata.schema.type.EntityStatus.ACTIVE;
      }

      @Override
      public org.openmetadata.schema.type.Include getInclude() {
        return org.openmetadata.schema.type.Include.ALL;
      }

      @Override
      public java.util.Map<String, Object> getExtension() {
        return null;
      }

      @Override
      public void setExtension(java.util.Map<String, Object> extension) {}

      @Override
      public org.openmetadata.schema.type.ChangeDescription getChangeDescription() {
        return null;
      }

      @Override
      public void setChangeDescription(org.openmetadata.schema.type.ChangeDescription changeDescription) {}

      @Override
      public org.openmetadata.schema.type.Domain getDomain() {
        return null;
      }

      @Override
      public void setDomain(org.openmetadata.schema.type.Domain domain) {}

      @Override
      public java.util.List<org.openmetadata.schema.type.DataProduct> getDataProducts() {
        return null;
      }
    };
  }
}