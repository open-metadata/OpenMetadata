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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;

/**
 * Unit tests for OpenMetadata DSL.
 */
class OpenMetadataDSLTest {

  private OpenMetadataDSL dsl;

  @BeforeEach
  void setUp() {
    dsl = new OpenMetadataDSL();
  }

  @Test
  void testSimpleBooleanExpression() {
    DSLExpression expr = DSLExpression.builder()
        .type(DSLExpression.ExpressionType.BOOLEAN)
        .booleanValue(true)
        .build();

    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("test", "table"))
        .build();

    boolean result = dsl.evaluateCondition("true", context);
    assertTrue(result);
  }

  @Test
  void testEqualsComparison() {
    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("users", "table"))
        .build();

    // entity.entityType == 'table'
    String expr = "entity.entityType == 'table'";
    boolean result = dsl.evaluateCondition(expr, context);
    assertTrue(result);
  }

  @Test
  void testEqualsComparisonFalse() {
    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("users", "table"))
        .build();

    String expr = "entity.entityType == 'dashboard'";
    boolean result = dsl.evaluateCondition(expr, context);
    assertFalse(result);
  }

  @Test
  void testAndOperator() {
    DSLContext context = DSLContext.builder()
        .entity(createMockEntityWithTag("users", "table", "PII"))
        .build();

    String expr = "entity.entityType == 'table' AND hasTag('PII')";
    boolean result = dsl.evaluateCondition(expr, context);
    assertTrue(result);
  }

  @Test
  void testOrOperator() {
    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("users", "table"))
        .build();

    String expr = "entity.entityType == 'dashboard' OR entity.entityType == 'table'";
    boolean result = dsl.evaluateCondition(expr, context);
    assertTrue(result);
  }

  @Test
  void testContainsFunction() {
    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("customer_data", "table"))
        .build();

    String expr = "contains(entity.name, 'customer')";
    boolean result = dsl.evaluateCondition(expr, context);
    assertTrue(result);
  }

  @Test
  void testNotOperator() {
    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("users", "table"))
        .build();

    String expr = "NOT entity.entityType == 'dashboard'";
    boolean result = dsl.evaluateCondition(expr, context);
    assertTrue(result);
  }

  @Test
  void testFieldAccess() {
    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("my_table", "table"))
        .build();

    String expr = "entity.name == 'my_table'";
    boolean result = dsl.evaluateCondition(expr, context);
    assertTrue(result);
  }

  @Test
  void testNumericComparison() {
    DSLContext context = DSLContext.builder()
        .entity(createMockEntity("users", "table"))
        .build();

    String expr = "length(entity.name) > 5";
    boolean result = dsl.evaluateCondition(expr, context);
    assertTrue(result);
  }

  @Test
  void testParserNotNull() {
    DSLExpressionParser parser = new DSLExpressionParser();
    assertNotNull(parser);
  }

  private EntityInterface createMockEntity(String name, String type) {
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
        return "Test description";
      }

      @Override
      public EntityReference getEntityReference() {
        return EntityReference.builder().id(UUID.randomUUID()).name(name).type(type).build();
      }

      @Override
      public EntityReference getService() {
        return EntityReference.builder().name("prod_mysql").type("databaseService").build();
      }

      @Override
      public List<TagLabel> getTags() {
        return List.of();
      }

      @Override
      public List<EntityReference> getOwners() {
        return List.of();
      }

      @Override
      public Long getUpdatedAt() {
        return System.currentTimeMillis();
      }

      @Override
      public String getId() {
        return UUID.randomUUID().toString();
      }

      @Override
      public EntityStatus getStatus() {
        return EntityStatus.ACTIVE;
      }

      @Override
      public Include getInclude() {
        return Include.ALL;
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

  private EntityInterface createMockEntityWithTag(String name, String type, String tag) {
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
        return "Test description";
      }

      @Override
      public EntityReference getEntityReference() {
        return EntityReference.builder().id(UUID.randomUUID()).name(name).type(type).build();
      }

      @Override
      public EntityReference getService() {
        return EntityReference.builder().name("prod_mysql").type("databaseService").build();
      }

      @Override
      public List<TagLabel> getTags() {
        return List.of(TagLabel.builder().tagFQN(tag).build());
      }

      @Override
      public List<EntityReference> getOwners() {
        return List.of();
      }

      @Override
      public Long getUpdatedAt() {
        return System.currentTimeMillis();
      }

      @Override
      public String getId() {
        return UUID.randomUUID().toString();
      }

      @Override
      public EntityStatus getStatus() {
        return EntityStatus.ACTIVE;
      }

      @Override
      public Include getInclude() {
        return Include.ALL;
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