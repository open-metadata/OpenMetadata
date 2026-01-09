package org.openmetadata.service.clients.pipeline.k8s;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class IngestionLogHandler {
  private static final Logger LOG = LoggerFactory.getLogger(IngestionLogHandler.class);

  private static final int MAX_MESSAGE_SIZE = 1_048_576; // 1MB
  private static final int JSON_BUFFER_SIZE = 65536; // 64KB buffer
  public static final int LOG_CHUNK_SIZE = MAX_MESSAGE_SIZE - JSON_BUFFER_SIZE;
  public static final Charset CHARSET = StandardCharsets.UTF_8;

  public static Map<String, String> buildLogResponse(String data, String after, String taskKey) {
    List<String> chunks;
    try {
      chunks = splitStringByByteSize(data, LOG_CHUNK_SIZE);
    } catch (Exception e) {
      LOG.error("Failed to split the logs due to [{}]", e.getMessage());
      return Map.of(taskKey, "Failed to process logs: " + e.getMessage());
    }

    int total = chunks.size();
    int afterIdx = after == null || after.isEmpty() ? 0 : Integer.parseInt(after);

    if (afterIdx >= total) {
      LOG.error("After index [{}] is out of bounds. Total pagination is [{}]", after, total);
      return Map.of(taskKey, "Invalid pagination index");
    }

    Map<String, String> logResponse = new HashMap<>();
    logResponse.put(taskKey, chunks.get(afterIdx));
    logResponse.put("total", Integer.toString(total));

    if (afterIdx < total - 1) {
      logResponse.put("after", String.valueOf(afterIdx + 1));
    }

    return logResponse;
  }

  public static List<String> splitStringByByteSize(String input, int maxBytesPerChunk)
      throws Exception {
    if (input == null || input.isEmpty()) {
      return List.of("");
    }

    List<String> chunks = new ArrayList<>();
    int strLen = input.length();
    int start = 0;

    while (start < strLen) {
      int newEnd = strLen;

      // Binary search for the max substring fitting into maxBytesPerChunk
      int low = start + 1, high = strLen;
      while (low <= high) {
        int mid = (low + high) / 2;
        String sub = input.substring(start, mid);
        int byteLen = sub.getBytes(CHARSET).length;
        if (byteLen <= maxBytesPerChunk) {
          newEnd = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (newEnd == start) {
        throw new Exception("Single character exceeds maxBytesPerChunk!");
      }

      chunks.add(input.substring(start, newEnd));
      start = newEnd;
    }

    return chunks;
  }
}
