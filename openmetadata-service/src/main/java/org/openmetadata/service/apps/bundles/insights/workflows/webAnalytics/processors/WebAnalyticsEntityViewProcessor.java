package org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.processors;

import static org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow.ENTITY_VIEW_REPORT_DATA_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.analytics.WebAnalyticEntityViewReportData;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class WebAnalyticsEntityViewProcessor
    implements Processor<
        Map<String, WebAnalyticEntityViewReportData>, ResultList<WebAnalyticEventData>> {
  private final StepStats stats = new StepStats();
  private final List<String> entities =
      List.of(
          "chart",
          "dashboard",
          "database",
          "databaseSchema",
          "mlmodel",
          "pipeline",
          "table",
          "topic");

  private record ProcessedUrl(String entityType, String entityFqn) {}

  public WebAnalyticsEntityViewProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public Map<String, WebAnalyticEntityViewReportData> process(
      ResultList<WebAnalyticEventData> input, Map<String, Object> contextData)
      throws SearchIndexException {
    try {
      for (WebAnalyticEventData event : input.getData()) {
        processEvent(event, contextData);
      }
      updateStats(input.getData().size(), 0);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.getData().size())
              .withFailedCount(input.getData().size())
              .withSuccessCount(0)
              .withMessage(
                  String.format(
                      "WebAnalytics Entity View Processor Encounter Failure: %s", e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(
          "[WebAnalyticsEntityViewProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.getData().size());
      throw new SearchIndexException(error);
    }
    return (HashMap<String, WebAnalyticEntityViewReportData>)
        contextData.get(ENTITY_VIEW_REPORT_DATA_KEY);
  }

  private void processEvent(WebAnalyticEventData event, Map<String, Object> contextData) {
    Map<String, WebAnalyticEntityViewReportData> entityViewData =
        (HashMap<String, WebAnalyticEntityViewReportData>)
            contextData.get(ENTITY_VIEW_REPORT_DATA_KEY);
    Map<String, Object> eventData = JsonUtils.getMap(event.getEventData());

    Optional<ProcessedUrl> oProcessedUrl = processUrl((String) eventData.get("url"));

    if (oProcessedUrl.isPresent()) {
      String entityType = oProcessedUrl.get().entityType();
      String entityFqn = oProcessedUrl.get().entityFqn();
      String fullUrl = (String) eventData.get("fullUrl");

      if (!entityViewData.containsKey(entityFqn)) {
        // Create a new WebAnalyticEntityViewReportData based on the Event data.
        try {
          EntityInterface entity =
              Entity.getEntityByName(
                  URLDecoder.decode(entityType, StandardCharsets.UTF_8),
                  URLDecoder.decode(entityFqn, StandardCharsets.UTF_8),
                  "*",
                  Include.NON_DELETED,
                  true);
          WebAnalyticEntityViewReportData webAnalyticEntityViewReportData =
              new WebAnalyticEntityViewReportData()
                  .withEntityType(entityType)
                  .withEntityFqn(entityFqn);

          Optional<List<EntityReference>> oEntityOwners = Optional.ofNullable(entity.getOwners());

          // Fill Owner.
          if (oEntityOwners.isPresent() && !oEntityOwners.get().isEmpty()) {
            EntityReference entityOwner = oEntityOwners.get().get(0);

            // Skip the Event if Entity Owner is the same as the User from the Event since we are
            // not counting
            // the owner page views.
            if (entityOwner.getId().equals(UUID.fromString((String) eventData.get("userId")))) {
              return;
            }

            webAnalyticEntityViewReportData.setOwnerId(entityOwner.getId().toString());
            webAnalyticEntityViewReportData.setOwner(entityOwner.getName());
          }

          // Fill Tags and Tier.
          List<String> entityTags = entity.getTags().stream().map(TagLabel::getTagFQN).toList();
          webAnalyticEntityViewReportData.setTagsFQN(entityTags);

          Optional<String> entityTier = getEntityTier(entityTags);
          entityTier.ifPresent(webAnalyticEntityViewReportData::setEntityTier);

          // Fill Entity Href.
          Optional<String> oEntityHref = findEntityHref(entityType, entityFqn, fullUrl);
          oEntityHref.ifPresent(webAnalyticEntityViewReportData::setEntityHref);

          // Fill the View count
          webAnalyticEntityViewReportData.setViews(1);

          entityViewData.put(entityFqn, webAnalyticEntityViewReportData);
        } catch (EntityNotFoundException rx) {
          LOG.debug("Entity {} Not Found", entityFqn);
        }

      } else {
        WebAnalyticEntityViewReportData webAnalyticEntityViewReportData =
            entityViewData.get(entityFqn);

        // If we couldn't match the EntityHref for any reason, we try again.
        if (Optional.ofNullable(webAnalyticEntityViewReportData.getEntityHref()).isEmpty()) {
          Optional<String> oEntityHref = findEntityHref(entityType, entityFqn, fullUrl);
          oEntityHref.ifPresent(webAnalyticEntityViewReportData::setEntityHref);
        }

        // Since we already have seen the Entity, we just need to update the view count.
        webAnalyticEntityViewReportData.setViews(webAnalyticEntityViewReportData.getViews() + 1);

        entityViewData.put(entityFqn, webAnalyticEntityViewReportData);
      }
    }
  }

  private Optional<ProcessedUrl> processUrl(String url) {
    Optional<ProcessedUrl> processedUrl = Optional.empty();
    List<String> splitUrl = List.of(url.split("/"));

    if (!splitUrl.isEmpty() && entities.contains(splitUrl.get(1))) {
      processedUrl = Optional.of(new ProcessedUrl(splitUrl.get(1), splitUrl.get(2)));
    }

    return processedUrl;
  }

  private Optional<String> findEntityHref(String entityType, String entityFqn, String fullUrl) {
    Optional<String> entityHref = Optional.empty();

    Pattern hRefPattern =
        Pattern.compile(
            String.format("(.*%s/%s)", Pattern.quote(entityType), Pattern.quote(entityFqn)),
            Pattern.CASE_INSENSITIVE);
    Matcher matcher = hRefPattern.matcher(fullUrl);

    if (matcher.find()) {
      entityHref = Optional.of(matcher.group(0));
    }
    return entityHref;
  }

  private Optional<String> getEntityTier(List<String> entityTags) {
    Optional<String> entityTier = Optional.empty();

    List<String> tierTags = entityTags.stream().filter(tag -> tag.startsWith("Tier")).toList();

    // We can directly get the first element if the list is not empty since there can only be ONE
    // Tier tag.
    if (!tierTags.isEmpty()) {
      entityTier = Optional.of(tierTags.get(0));
    }

    return entityTier;
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }
}
