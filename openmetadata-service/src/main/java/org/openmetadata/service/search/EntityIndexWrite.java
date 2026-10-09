package org.openmetadata.service.search;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * One live write of an entity's search document: the scripted upsert of {@code params} by {@code
 * script} into document {@code docId} of {@code index}. The index is the one live writes go to: the
 * staged copy while a reindex builds one.
 */
public record EntityIndexWrite(
    String index, String docId, String script, Map<String, Object> params) {

  /** Items in one bulk request of live writes. */
  public static final int BULK_ITEMS = 100;

  private static final long BULK_ITEM_OVERHEAD_BYTES = 256;

  /**
   * Splits {@code writes} into bulk requests of at most {@link #BULK_ITEMS} items and {@code
   * maxPayloadBytes}. A write larger than the cap goes in a request of its own.
   */
  public static List<List<EntityIndexWrite>> bulkRequests(
      List<EntityIndexWrite> writes, long maxPayloadBytes) {
    List<List<EntityIndexWrite>> requests = new ArrayList<>();
    List<EntityIndexWrite> current = new ArrayList<>();
    long currentBytes = 0;
    for (EntityIndexWrite write : writes) {
      long size = write.estimatedBytes();
      boolean full =
          current.size() >= BULK_ITEMS
              || (!current.isEmpty() && currentBytes + size > maxPayloadBytes);
      if (full) {
        requests.add(current);
        current = new ArrayList<>();
        currentBytes = 0;
      }
      current.add(write);
      currentBytes += size;
    }
    if (!current.isEmpty()) {
      requests.add(current);
    }
    return requests;
  }

  long estimatedBytes() {
    return JsonUtils.pojoToJson(params).getBytes(StandardCharsets.UTF_8).length
        + script.getBytes(StandardCharsets.UTF_8).length
        + BULK_ITEM_OVERHEAD_BYTES;
  }
}
