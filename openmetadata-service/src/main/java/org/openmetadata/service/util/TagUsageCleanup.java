/*
 *  Copyright 2021 Collate
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

import static org.openmetadata.service.util.OpenMetadataOperations.printToAsciiTable;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.TagRepository;

@Slf4j
public class TagUsageCleanup {

  private final CollectionDAO collectionDAO;
  private final TagRepository tagRepository;
  private final GlossaryTermRepository glossaryTermRepository;
  private final boolean dryRun;

  public TagUsageCleanup(CollectionDAO collectionDAO, boolean dryRun) {
    this.collectionDAO = collectionDAO;
    this.tagRepository = new TagRepository();
    this.glossaryTermRepository = new GlossaryTermRepository();
    this.dryRun = dryRun;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class OrphanedTagUsage {
    private String tagFQN;
    private String tagFQNHash;
    private String targetFQNHash;
    private int source;
    private String sourceName;
    private String reason;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class TagCleanupResult {
    private int totalTagUsagesScanned;
    private int orphanedTagUsagesFound;
    private int tagUsagesDeleted;
    private List<OrphanedTagUsage> orphanedTagUsages;
    private Map<String, Integer> orphansBySource;
  }

  public TagCleanupResult performCleanup(int batchSize) {
    LOG.info("Starting tag usage cleanup. Dry run: {}, Batch size: {}", dryRun, batchSize);

    TagCleanupResult result =
        TagCleanupResult.builder()
            .orphanedTagUsages(new ArrayList<>())
            .orphansBySource(new HashMap<>())
            .build();

    try {
      long totalTagUsages = collectionDAO.tagUsageDAO().getTotalTagUsageCount();
      result.setTotalTagUsagesScanned((int) totalTagUsages);

      LOG.info(
          "Found {} total tag usages to scan. Processing in batches of {}",
          totalTagUsages,
          batchSize);

      long offset = 0;
      int processedCount = 0;
      int batchNumber = 1;

      while (offset < totalTagUsages) {
        LOG.info("Processing batch {} (offset: {}, limit: {})", batchNumber, offset, batchSize);

        List<CollectionDAO.TagUsageObject> tagUsageBatch =
            collectionDAO.tagUsageDAO().getAllTagUsagesPaginated(offset, batchSize);

        if (tagUsageBatch.isEmpty()) {
          LOG.info("No more tag usages to process");
          break;
        }

        for (CollectionDAO.TagUsageObject tagUsage : tagUsageBatch) {
          OrphanedTagUsage orphan = validateTagUsage(tagUsage);
          if (orphan != null) {
            result.getOrphanedTagUsages().add(orphan);
            result.getOrphansBySource().merge(orphan.getSourceName(), 1, Integer::sum);
          }
          processedCount++;
        }

        offset += tagUsageBatch.size();
        batchNumber++;

        if (processedCount % (batchSize * 10) == 0 || offset >= totalTagUsages) {
          LOG.info(
              "Progress: {}/{} tag usages processed, {} orphaned tag usages found",
              processedCount,
              totalTagUsages,
              result.getOrphanedTagUsages().size());
        }
      }

      result.setOrphanedTagUsagesFound(result.getOrphanedTagUsages().size());

      LOG.info(
          "Completed scanning {} tag usages. Found {} orphaned tag usages",
          processedCount,
          result.getOrphanedTagUsagesFound());

      displayOrphanedTagUsages(result);
      if (!dryRun && !result.getOrphanedTagUsages().isEmpty()) {
        result.setTagUsagesDeleted(deleteOrphanedTagUsages(result.getOrphanedTagUsages()));
      }

      LOG.info(
          "Tag usage cleanup completed. Scanned: {}, Found: {}, Deleted: {}",
          processedCount,
          result.getOrphanedTagUsagesFound(),
          result.getTagUsagesDeleted());

    } catch (Exception e) {
      LOG.error("Error during tag usage cleanup", e);
      throw new RuntimeException("Tag usage cleanup failed", e);
    }

    return result;
  }

  private OrphanedTagUsage validateTagUsage(CollectionDAO.TagUsageObject tagUsage) {
    try {
      int source = tagUsage.getSource();
      String tagFQNHash = tagUsage.getTagFQNHash();
      String tagFQN = tagUsage.getTagFQN();

      boolean tagExists = checkTagExists(source, tagFQN);

      if (tagExists) {
        return null;
      }

      return OrphanedTagUsage.builder()
          .tagFQN(tagFQN)
          .tagFQNHash(tagFQNHash)
          .targetFQNHash(tagUsage.getTargetFQNHash())
          .source(source)
          .sourceName(getSourceName(source))
          .reason(
              String.format(
                  "%s does not exist in %s table",
                  tagFQN,
                  source == TagLabel.TagSource.CLASSIFICATION.ordinal()
                      ? "tag"
                      : "glossary_term_entity"))
          .build();

    } catch (Exception e) {
      LOG.debug("Error validating tag usage for tag {}: {}", tagUsage.getTagFQN(), e.getMessage());
      return null;
    }
  }

  private boolean checkTagExists(int source, String tagFQNHash) {
    if (source == TagLabel.TagSource.CLASSIFICATION.ordinal()) {
      return collectionDAO
          .tagDAO()
          .existsByName(
              collectionDAO.tagDAO().getTableName(),
              collectionDAO.tagDAO().getNameHashColumn(),
              tagFQNHash);
    } else if (source == TagLabel.TagSource.GLOSSARY.ordinal()) {
      return collectionDAO
          .glossaryTermDAO()
          .existsByName(
              collectionDAO.glossaryTermDAO().getTableName(),
              collectionDAO.glossaryTermDAO().getNameHashColumn(),
              tagFQNHash);
    }
    LOG.warn("Unknown tag source: {}", source);
    return true;
  }

  private int deleteOrphanedTagUsages(List<OrphanedTagUsage> orphanedTagUsages) {
    LOG.info("Deleting {} orphaned tag usages", orphanedTagUsages.size());
    int deletedCount = 0;

    for (OrphanedTagUsage orphan : orphanedTagUsages) {
      try {
        int deleted =
            collectionDAO
                .tagUsageDAO()
                .deleteTagUsage(
                    orphan.getSource(), orphan.getTagFQNHash(), orphan.getTargetFQNHash());

        if (deleted > 0) {
          deletedCount++;
          LOG.debug(
              "Deleted orphaned tag usage: {} (source: {}) -> target: {}",
              orphan.getTagFQN(),
              orphan.getSourceName(),
              orphan.getTargetFQNHash());
        }
      } catch (Exception e) {
        LOG.error(
            "Failed to delete orphaned tag usage: {} (source: {}) -> target: {}: {}",
            orphan.getTagFQN(),
            orphan.getSourceName(),
            orphan.getTargetFQNHash(),
            e.getMessage());
      }
    }

    LOG.info(
        "Successfully deleted {} out of {} orphaned tag usages",
        deletedCount,
        orphanedTagUsages.size());
    return deletedCount;
  }

  private void displayOrphanedTagUsages(TagCleanupResult result) {
    if (result.getOrphanedTagUsages().isEmpty()) {
      LOG.info("No orphaned tag usages found. All tag usages are valid.");
      return;
    }

    LOG.info("Found {} orphaned tag usages", result.getOrphanedTagUsagesFound());

    List<String> columns =
        Arrays.asList("Tag FQN", "Tag FQN Hash", "Target FQN Hash", "Source", "Reason");

    List<List<String>> rows = new ArrayList<>();
    for (OrphanedTagUsage orphan : result.getOrphanedTagUsages()) {
      rows.add(
          Arrays.asList(
              orphan.getTagFQN(),
              orphan.getTagFQNHash(),
              orphan.getTargetFQNHash(),
              orphan.getSourceName(),
              orphan.getReason()));
    }

    printToAsciiTable(columns, rows, "No orphaned tag usages found");

    displaySummaryStatistics(result);
  }

  private void displaySummaryStatistics(TagCleanupResult result) {
    if (!result.getOrphansBySource().isEmpty()) {
      LOG.info("Orphaned tag usages by source:");
      List<String> sourceColumns = Arrays.asList("Source", "Count");
      List<List<String>> sourceRows = new ArrayList<>();

      result.getOrphansBySource().entrySet().stream()
          .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
          .forEach(
              entry -> sourceRows.add(Arrays.asList(entry.getKey(), entry.getValue().toString())));

      printToAsciiTable(sourceColumns, sourceRows, "No source statistics");
    }
  }

  private String getSourceName(int source) {
    if (source == TagLabel.TagSource.CLASSIFICATION.ordinal()) {
      return "Classification";
    } else if (source == TagLabel.TagSource.GLOSSARY.ordinal()) {
      return "Glossary";
    }
    return "Unknown";
  }
}
