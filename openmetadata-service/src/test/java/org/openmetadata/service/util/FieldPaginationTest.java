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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;

public class FieldPaginationTest {

  @Test
  void test_addAndGetFieldPagination() {
    FieldPagination pagination = new FieldPagination();

    pagination.addFieldPagination("assets", 20, 10);

    assertEquals(20, pagination.getLimit("assets"));
    assertEquals(10, pagination.getOffset("assets"));
  }

  @Test
  void test_defaultValues() {
    FieldPagination pagination = new FieldPagination();

    assertEquals(FieldPagination.DEFAULT_LIMIT, pagination.getLimit("nonexistent"));
    assertEquals(FieldPagination.DEFAULT_OFFSET, pagination.getOffset("nonexistent"));
  }

  @Test
  void test_hasPagination() {
    FieldPagination pagination = new FieldPagination();

    assertFalse(pagination.hasPagination("assets"));

    pagination.addFieldPagination("assets", 15, 5);

    assertTrue(pagination.hasPagination("assets"));
    assertFalse(pagination.hasPagination("nonexistent"));
  }

  @Test
  void test_multipleFields() {
    FieldPagination pagination = new FieldPagination();

    pagination.addFieldPagination("assets", 20, 10);
    pagination.addFieldPagination("children", 30, 15);

    assertEquals(20, pagination.getLimit("assets"));
    assertEquals(10, pagination.getOffset("assets"));
    assertEquals(30, pagination.getLimit("children"));
    assertEquals(15, pagination.getOffset("children"));

    assertTrue(pagination.hasPagination("assets"));
    assertTrue(pagination.hasPagination("children"));
  }

  @Test
  void test_updateExistingPagination() {
    FieldPagination pagination = new FieldPagination();

    pagination.addFieldPagination("assets", 20, 10);
    assertEquals(20, pagination.getLimit("assets"));
    assertEquals(10, pagination.getOffset("assets"));

    pagination.addFieldPagination("assets", 50, 25);
    assertEquals(50, pagination.getLimit("assets"));
    assertEquals(25, pagination.getOffset("assets"));
  }

  @Test
  void test_zeroValuesAllowed() {
    FieldPagination pagination = new FieldPagination();

    pagination.addFieldPagination("assets", 0, 0);

    assertEquals(0, pagination.getLimit("assets"));
    assertEquals(0, pagination.getOffset("assets"));
    assertTrue(pagination.hasPagination("assets"));
  }

  @Test
  void test_integrationWithFields() {
    Set<String> allowedFields = Set.of("assets", "children", "owners");
    EntityUtil.Fields fields = new EntityUtil.Fields(allowedFields, "assets,children");
    FieldPagination pagination = new FieldPagination();

    pagination.addFieldPagination("assets", 25, 5);
    fields.setFieldPagination(pagination);

    FieldPagination retrievedPagination = fields.getFieldPagination();
    assertEquals(25, retrievedPagination.getLimit("assets"));
    assertEquals(5, retrievedPagination.getOffset("assets"));
  }
}
