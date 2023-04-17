package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.ALL_RESOURCES;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;

class PolicyRepositoryTest {
  @Test
  void filterResourcesTest() {
    // Ensure with ALL_RESOURCES all the other resources are filtered
    List<String> resources = listOf(ALL_RESOURCES, Entity.TABLE, Entity.TAG);
    List<String> filteredResources = PolicyRepository.filterRedundantResources(resources);
    assertEquals(listOf(ALL_RESOURCES), filteredResources);

    // Ensure resources are returned unfiltered when ALL_RESOURCES does not exist
    resources = listOf(Entity.TABLE, Entity.TAG);
    filteredResources = PolicyRepository.filterRedundantResources(listOf(Entity.TABLE, Entity.TAG));
    assertEquals(resources, filteredResources);
  }

  @Test
  void filterOperationsTest() {
    // Ensure with VIEW_ALL and VIEW_EDIT all the other redundant operations are filtered
    List<MetadataOperation> operations =
        listOf(
            MetadataOperation.CREATE,
            MetadataOperation.VIEW_ALL,
            MetadataOperation.VIEW_BASIC,
            MetadataOperation.VIEW_QUERIES,
            MetadataOperation.EDIT_ALL,
            MetadataOperation.EDIT_TESTS,
            MetadataOperation.EDIT_TAGS,
            MetadataOperation.DELETE);
    List<MetadataOperation> filteredOperations = PolicyRepository.filterRedundantOperations(operations);
    assertEquals(
        listOf(
            MetadataOperation.CREATE, MetadataOperation.VIEW_ALL, MetadataOperation.EDIT_ALL, MetadataOperation.DELETE),
        filteredOperations);

    // Ensure operations are returned unfiltered when ALL operations do not exist
    operations =
        listOf(
            MetadataOperation.CREATE,
            MetadataOperation.VIEW_BASIC,
            MetadataOperation.VIEW_QUERIES,
            MetadataOperation.EDIT_TESTS,
            MetadataOperation.EDIT_TAGS,
            MetadataOperation.DELETE);
    filteredOperations = PolicyRepository.filterRedundantOperations(operations);
    assertEquals(operations, filteredOperations);
  }
}
