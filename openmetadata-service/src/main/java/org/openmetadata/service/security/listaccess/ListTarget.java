package org.openmetadata.service.security.listaccess;

import java.util.List;
import org.openmetadata.schema.type.MetadataOperation;

/** The rows of {@code listedType}, each read with {@code operations}, stored as {@code storage}. */
public record ListTarget(
    String listedType, List<MetadataOperation> operations, RowStorage storage) {
  public ListTarget {
    operations = List.copyOf(operations);
  }
}
