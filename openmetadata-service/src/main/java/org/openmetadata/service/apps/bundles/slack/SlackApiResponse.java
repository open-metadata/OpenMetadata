package org.openmetadata.service.apps.bundles.slack;

import lombok.Getter;

@Getter
public class SlackApiResponse<T> {
  private int statusCode;
  private String message;
  private T data;

  public SlackApiResponse(int statusCode, String message, T data) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}
