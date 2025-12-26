/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.resources.services.ingestionpipelines;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Log batch for pipeline log ingestion.
 * Supports both simple log strings and structured batches with metadata.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LogBatch {

  @JsonProperty("logs")
  @NotNull
  @Schema(description = "Log content - can be single or multiple lines")
  private String logs;

  @JsonProperty("timestamp")
  @Schema(description = "Timestamp when logs were generated (milliseconds since epoch)")
  private Long timestamp;

  @JsonProperty("connectorId")
  @Schema(description = "Unique identifier of the connector instance")
  private String connectorId;

  @JsonProperty("compressed")
  @Schema(description = "Whether the logs are gzip compressed and base64 encoded")
  private Boolean compressed = false;

  @JsonProperty("lineCount")
  @Schema(description = "Number of log lines in this batch")
  private Integer lineCount;

  // Constructor for backward compatibility with simple string
  public LogBatch(String logs) {
    this.logs = logs;
    this.timestamp = System.currentTimeMillis();
  }

  /**
   * Get logs, decompressing if needed
   */
  public String getDecompressedLogs() {
    if (Boolean.TRUE.equals(compressed)) {
      try {
        byte[] compressed = java.util.Base64.getDecoder().decode(logs);
        java.io.ByteArrayInputStream bis = new java.io.ByteArrayInputStream(compressed);
        java.util.zip.GZIPInputStream gis = new java.util.zip.GZIPInputStream(bis);
        return new String(gis.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
      } catch (Exception e) {
        // If decompression fails, return as-is
        return logs;
      }
    }
    return logs;
  }
}
