package org.openmetadata.sdk.net;

import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.Accessors;
import lombok.experimental.NonFinal;

import static java.util.Objects.requireNonNull;

@Accessors(fluent = true)
public class AbstractOpenMetadataResponse<T> {
  int code;

  HttpHeaders headers;

  /** The body of the response. */
  T body;

  public final int code() {
    return this.code;
  }

  public final HttpHeaders headers() {
    return this.headers;
  }

  public final T body() {
    return this.body;
  }

  @NonFinal
  @Getter(AccessLevel.PACKAGE)
  @Setter(AccessLevel.PACKAGE)
  int numRetries;


  protected AbstractOpenMetadataResponse(int code, HttpHeaders headers, T body) {
    requireNonNull(headers);
    requireNonNull(body);

    this.code = code;
    this.headers = headers;
    this.body = body;
  }
}
