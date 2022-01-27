package org.openmetadata.catalog.slack;

import java.util.List;
import javax.validation.constraints.NotEmpty;
import org.openmetadata.catalog.type.EventFilter;

public class SlackPublisherConfiguration {
  @NotEmpty private String webhookUrl;

  @NotEmpty private String name;

  @NotEmpty private String openMetadataUrl;

  List<EventFilter> filters;

  private int batchSize = 10;

  public String getWebhookUrl() {
    return webhookUrl;
  }

  public void setWebhookUrl(String webhookUrl) {
    this.webhookUrl = webhookUrl;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public List<EventFilter> getFilters() {
    return filters;
  }

  public void setFilters(List<EventFilter> filters) {
    this.filters = filters;
  }

  public int getBatchSize() {
    return batchSize;
  }

  public void setBatchSize(int batchSize) {
    this.batchSize = batchSize;
  }

  public void setOpenMetadataUrl(String openMetadataUrl) {
    this.openMetadataUrl = openMetadataUrl;
  }

  public String getOpenMetadataUrl() {
    return openMetadataUrl;
  }
}
