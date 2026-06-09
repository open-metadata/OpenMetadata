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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.api.data.ColumnMetadataGroup;
import org.openmetadata.schema.api.data.MetadataStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.search.ColumnAggregator;
import org.openmetadata.service.security.Authorizer;

class ColumnRepositoryTest {

  @Test
  void testGetColumnGridPaginated_filtersCompleteStatusAndUsesStableFilteredCursor()
      throws Exception {
    ColumnAggregator aggregator = mock(ColumnAggregator.class);
    ColumnRepository repository = new ColumnRepository(mock(Authorizer.class), aggregator);

    List<ColumnGridItem> firstScanBatch =
        List.of(
            createGridItem("customer_id", MetadataStatus.COMPLETE, false, 1, "id", true),
            createGridItem("region", MetadataStatus.INCOMPLETE, false, 1, "region", false),
            createGridItem("email", MetadataStatus.COMPLETE, false, 2, "email", true));

    List<ColumnGridItem> secondScanBatch =
        List.of(
            createGridItem("status", MetadataStatus.INCONSISTENT, true, 4, "status", true),
            createGridItem("order_id", MetadataStatus.COMPLETE, false, 3, "order", true));

    when(aggregator.aggregateColumns(any()))
        .thenAnswer(
            invocation -> {
              ColumnAggregator.ColumnAggregationRequest request = invocation.getArgument(0);
              assertNull(request.getMetadataStatus());

              if (request.getCursor() == null) {
                return createResponse(firstScanBatch, "scan-2");
              }
              if ("scan-2".equals(request.getCursor())) {
                return createResponse(secondScanBatch, null);
              }

              fail("Unexpected scan cursor: " + request.getCursor());
              return null;
            });

    ColumnAggregator.ColumnAggregationRequest firstPageRequest =
        new ColumnAggregator.ColumnAggregationRequest();
    firstPageRequest.setSize(2);
    firstPageRequest.setMetadataStatus("COMPLETE");

    ColumnGridResponse firstPage = repository.getColumnGridPaginated(null, firstPageRequest);

    assertEquals(2, firstPage.getColumns().size());
    assertTrue(
        firstPage.getColumns().stream()
            .allMatch(item -> MetadataStatus.COMPLETE.equals(item.getMetadataStatus())));
    assertEquals(3, firstPage.getTotalUniqueColumns());
    assertEquals(6, firstPage.getTotalOccurrences());
    assertNotNull(firstPage.getCursor());

    ColumnAggregator.ColumnAggregationRequest secondPageRequest =
        new ColumnAggregator.ColumnAggregationRequest();
    secondPageRequest.setSize(2);
    secondPageRequest.setMetadataStatus("COMPLETE");
    secondPageRequest.setCursor(firstPage.getCursor());

    ColumnGridResponse secondPage = repository.getColumnGridPaginated(null, secondPageRequest);

    assertEquals(1, secondPage.getColumns().size());
    assertEquals("order_id", secondPage.getColumns().getFirst().getColumnName());
    assertEquals(3, secondPage.getTotalUniqueColumns());
    assertEquals(6, secondPage.getTotalOccurrences());
    assertNull(secondPage.getCursor());
  }

  @Test
  void testGetColumnGridPaginated_filtersMissingMetadataAndRecomputesTotals() throws Exception {
    ColumnAggregator aggregator = mock(ColumnAggregator.class);
    ColumnRepository repository = new ColumnRepository(mock(Authorizer.class), aggregator);

    List<ColumnGridItem> scanBatch =
        List.of(
            createGridItem("customer_id", MetadataStatus.COMPLETE, false, 1, "id", true),
            createGridItem("region", MetadataStatus.INCOMPLETE, false, 2, "", false),
            createGridItem("status", MetadataStatus.INCONSISTENT, true, 3, "status", false));

    when(aggregator.aggregateColumns(any()))
        .thenAnswer(
            invocation -> {
              ColumnAggregator.ColumnAggregationRequest request = invocation.getArgument(0);
              assertNull(request.getMetadataStatus());
              assertFalse(Boolean.TRUE.equals(request.getHasMissingMetadata()));

              return createResponse(scanBatch, null);
            });

    ColumnAggregator.ColumnAggregationRequest request =
        new ColumnAggregator.ColumnAggregationRequest();
    request.setSize(10);
    request.setHasMissingMetadata(true);

    ColumnGridResponse response = repository.getColumnGridPaginated(null, request);

    assertEquals(2, response.getColumns().size());
    assertEquals(2, response.getTotalUniqueColumns());
    assertEquals(5, response.getTotalOccurrences());
    assertNull(response.getCursor());
    assertTrue(
        response.getColumns().stream()
            .allMatch(item -> !"customer_id".equals(item.getColumnName())));
  }

  private ColumnGridResponse createResponse(List<ColumnGridItem> columns, String cursor) {
    ColumnGridResponse response = new ColumnGridResponse();
    response.setColumns(columns);
    response.setCursor(cursor);
    response.setTotalUniqueColumns(columns.size());
    response.setTotalOccurrences(
        columns.stream().mapToInt(ColumnGridItem::getTotalOccurrences).sum());

    return response;
  }

  private ColumnGridItem createGridItem(
      String columnName,
      MetadataStatus status,
      boolean hasVariations,
      int totalOccurrences,
      String description,
      boolean hasTags) {
    ColumnMetadataGroup group = new ColumnMetadataGroup();
    group.setGroupId(columnName + "-group");
    group.setDescription(description);
    group.setOccurrenceCount(1);
    group.setOccurrences(new ArrayList<>());
    if (hasTags) {
      TagLabel tagLabel = new TagLabel();
      tagLabel.setTagFQN("Tier.Tier1");
      group.setTags(List.of(tagLabel));
    } else {
      group.setTags(new ArrayList<>());
    }

    ColumnGridItem item = new ColumnGridItem();
    item.setColumnName(columnName);
    item.setMetadataStatus(status);
    item.setHasVariations(hasVariations);
    item.setTotalOccurrences(totalOccurrences);
    item.setGroups(List.of(group));

    return item;
  }
}
