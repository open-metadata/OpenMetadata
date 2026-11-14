package org.openmetadata.it.sso.browser;

import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Cookies as a browser holds them, applied in the order the server set them. A hand-rolled jar
 * because {@link java.net.CookieManager} sends Max-Age cookies back in RFC 2965 form ({@code
 * $Version="1"; OM_SESSION="..."}), which the server rejects, so every login would loop back to the
 * sign-in page. Cookies are not scoped by port, exactly as in a browser: the server under test and
 * the mock identity providers all live on {@code localhost}.
 */
public final class SsoCookieJar {
  private static final String SET_COOKIE = "set-cookie";
  private static final String EXPIRED = "max-age=0";

  private final Map<String, String> values = new LinkedHashMap<>();

  public synchronized void capture(HttpResponse<?> response) {
    response.headers().allValues(SET_COOKIE).forEach(this::apply);
  }

  public synchronized Optional<String> value(String name) {
    return Optional.ofNullable(values.get(name));
  }

  synchronized Optional<String> headerValue() {
    return values.isEmpty()
        ? Optional.empty()
        : Optional.of(
            values.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining("; ")));
  }

  private void apply(String setCookie) {
    String pair = setCookie.split(";", 2)[0];
    int separator = pair.indexOf('=');
    if (separator > 0) {
      String name = pair.substring(0, separator).trim();
      String value = pair.substring(separator + 1).trim();
      if (isDeletion(setCookie, value)) {
        values.remove(name);
      } else {
        values.put(name, value);
      }
    }
  }

  private static boolean isDeletion(String setCookie, String value) {
    return value.isEmpty() || setCookie.toLowerCase(Locale.ROOT).contains(EXPIRED);
  }
}
