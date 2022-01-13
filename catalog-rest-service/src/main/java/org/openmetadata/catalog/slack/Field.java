package org.openmetadata.catalog.slack;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Field {
  private String title;
  private String value;

  @JsonProperty("short_enough")
  private boolean shortEnough;

  @JsonProperty("short")
  private boolean shortField;

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getValue() {
    return value;
  }

  public void setValue(String value) {
    this.value = value;
  }

  public boolean isShortEnough() {
    return shortEnough;
  }

  public void setShortEnough(boolean shortEnough) {
    this.shortEnough = shortEnough;
  }

  public boolean isShort() {
    return shortField;
  }

  public void setShort(boolean shortField) {
    this.shortField = shortField;
  }
}
