package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.MetadataStatus;

class ColumnRepoTest {

  @Test
  void testMetadataStatusFilterComplete() {

    ColumnGridItem item1 = new ColumnGridItem();
    item1.setMetadataStatus(MetadataStatus.fromValue("COMPLETE"));

    ColumnGridItem item2 = new ColumnGridItem();
    item2.setMetadataStatus(MetadataStatus.fromValue("INCOMPLETE"));

    boolean result1 = ColumnRepository.matchesMetadataStatus(item1, "COMPLETE");

    boolean result2 = ColumnRepository.matchesMetadataStatus(item2, "COMPLETE");

    assertTrue(result1);
    assertFalse(result2);
  }

  @Test
  void testMetadataStatusFilterIncomplete() {

    ColumnGridItem item1 = new ColumnGridItem();
    item1.setMetadataStatus(MetadataStatus.fromValue("COMPLETE"));

    ColumnGridItem item2 = new ColumnGridItem();
    item2.setMetadataStatus(MetadataStatus.fromValue("INCOMPLETE"));

    boolean result1 = ColumnRepository.matchesMetadataStatus(item1, "INCOMPLETE");

    boolean result2 = ColumnRepository.matchesMetadataStatus(item2, "INCOMPLETE");

    assertFalse(result1);
    assertTrue(result2);
  }

  @Test
  void testMetadataStatusCaseInsensitive() {

    ColumnGridItem item = new ColumnGridItem();
    item.setMetadataStatus(MetadataStatus.fromValue("COMPLETE"));

    boolean result = ColumnRepository.matchesMetadataStatus(item, "complete");

    assertTrue(result); // case-insensitive check
  }

  @Test
  void testMetadataStatusNullOrBlankFilter() {

    ColumnGridItem item = new ColumnGridItem();
    item.setMetadataStatus(MetadataStatus.fromValue("INCOMPLETE"));

    assertTrue(ColumnRepository.matchesMetadataStatus(item, null));
    assertTrue(ColumnRepository.matchesMetadataStatus(item, ""));
    assertTrue(ColumnRepository.matchesMetadataStatus(item, "   "));
  }
}
