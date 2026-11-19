package org.openmetadata.service.security.auth.validator;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.parser.Parser;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Reads the reason out of the page an identity provider returns when it rejects a SAML sign-in
 * request, so the configuration check can show the provider's own explanation instead of a bare
 * HTTP status.
 */
final class IdpErrorResponse {
  /** Visible page text is a best effort and can carry page chrome, so only its start is kept. */
  static final int MAX_PAGE_TEXT_LENGTH = 300;

  /** Entra's reason is a single message; this only bounds a malformed or hostile page. */
  static final int MAX_ENTRA_REASON_LENGTH = 1000;

  /**
   * Microsoft Entra ID renders its error page in the browser from a {@code $Config} script object,
   * so the page has no visible text: the AADSTS code and message exist only in this field, as a
   * JSON string whose text is also HTML-escaped ({@code Tenant &#39;…&#39; not found}).
   */
  private static final Pattern ENTRA_SERVICE_EXCEPTION =
      Pattern.compile("\"strServiceExceptionMessage\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*+)\"");

  private static final String ELLIPSIS = "…";

  private IdpErrorResponse() {}

  static Optional<String> reasonOf(String body) {
    return Optional.ofNullable(body)
        .filter(text -> !text.isBlank())
        .flatMap(text -> entraReason(text).or(() -> visibleText(text)));
  }

  /** Only a reason in Entra's error format, for callers that must not pass on a page's text. */
  static Optional<String> entraReasonOf(String body) {
    return Optional.ofNullable(body)
        .filter(text -> !text.isBlank())
        .flatMap(IdpErrorResponse::entraReason);
  }

  private static Optional<String> entraReason(String body) {
    Matcher matcher = ENTRA_SERVICE_EXCEPTION.matcher(body);
    return matcher.find()
        ? nonBlank(Parser.unescapeEntities(unescapeJsonString(matcher.group(1)), false))
            .map(reason -> shorten(reason, MAX_ENTRA_REASON_LENGTH))
        : Optional.empty();
  }

  private static String unescapeJsonString(String escaped) {
    try {
      return JsonUtils.readValue("\"" + escaped + "\"", String.class);
    } catch (JsonParsingException e) {
      return escaped;
    }
  }

  private static Optional<String> visibleText(String body) {
    return nonBlank(Jsoup.parse(body).body().text())
        .map(text -> shorten(text, MAX_PAGE_TEXT_LENGTH));
  }

  private static Optional<String> nonBlank(String text) {
    return text.isBlank() ? Optional.empty() : Optional.of(text);
  }

  private static String shorten(String reason, int maxLength) {
    String singleLine = reason.strip().replaceAll("\\s+", " ");
    return singleLine.length() <= maxLength
        ? singleLine
        : singleLine.substring(0, maxLength) + ELLIPSIS;
  }
}
