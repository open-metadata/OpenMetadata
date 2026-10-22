package org.openmetadata.it.sso.browser;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import org.openmetadata.it.sso.MockHttp;
import org.openmetadata.it.sso.browser.SsoNavigation.Hop;

/**
 * A headless browser for SSO round trips: it keeps cookies, follows redirects between the server
 * under test and the mock identity providers one hop at a time, and stops where a real browser
 * would hand control to the single-page app.
 */
public final class SsoBrowser {
  private static final int MAX_REDIRECTS = 10;
  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
  private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);
  private static final String COOKIE = "Cookie";
  private static final String SET_COOKIE = "set-cookie";
  private static final String CONTENT_TYPE = "Content-Type";
  private static final String FORM = "application/x-www-form-urlencoded";
  private static final String JSON = "application/json";
  private static final String BEARER = "Bearer ";

  private final HttpClient http =
      HttpClient.newBuilder()
          .followRedirects(HttpClient.Redirect.NEVER)
          .connectTimeout(CONNECT_TIMEOUT)
          .build();
  private final SsoCookieJar cookies = new SsoCookieJar();

  public SsoCookieJar cookies() {
    return cookies;
  }

  /** Requests {@code url} and follows its redirects until the single-page app takes over. */
  public SsoNavigation navigate(String url) {
    return navigate(url, next -> false);
  }

  /**
   * As {@link #navigate(String)}, but stops before requesting any URL {@code stopBefore} accepts,
   * leaving it as the navigation's {@link SsoNavigation#pendingUrl()} for the test to tamper with.
   */
  public SsoNavigation navigate(String url, Predicate<URI> stopBefore) {
    List<Hop> hops = new ArrayList<>();
    URI next = URI.create(url);
    while (next != null && !stopBefore.test(next)) {
      Hop hop = requestHop(next);
      hops.add(hop);
      next = nextHopAfter(hop, hops.size());
    }
    return new SsoNavigation(hops, next);
  }

  /** Stops before the request whose path is {@code path}, e.g. the server's OIDC callback. */
  public static Predicate<URI> pathIs(String path) {
    return uri -> path.equals(uri.getPath());
  }

  public HttpResponse<String> get(String url) {
    return send(requestTo(url).GET().build());
  }

  public HttpResponse<String> getWithBearer(String url, String token) {
    return send(requestTo(url).header(MockHttp.AUTHORIZATION, BEARER + token).GET().build());
  }

  public HttpResponse<String> getWithHeaders(String url, Map<String, String> headers) {
    HttpRequest.Builder request = requestTo(url);
    headers.forEach(request::header);
    return send(request.GET().build());
  }

  public HttpResponse<String> postJsonWithBearer(String url, String json, String token) {
    HttpRequest.Builder request =
        requestTo(url).header(CONTENT_TYPE, JSON).header(MockHttp.AUTHORIZATION, BEARER + token);
    return send(request.POST(HttpRequest.BodyPublishers.ofString(json)).build());
  }

  public HttpResponse<String> post(String url) {
    return send(requestTo(url).POST(HttpRequest.BodyPublishers.noBody()).build());
  }

  private Hop requestHop(URI url) {
    HttpResponse<String> response = send(requestTo(url.toString()).GET().build());
    return new Hop(
        url,
        response.statusCode(),
        locationOf(url, response),
        response.headers().allValues(SET_COOKIE),
        response.body());
  }

  // A redirect carrying a fragment targets the single-page app, which reads it in JavaScript.
  private static URI nextHopAfter(Hop hop, int hopsSoFar) {
    if (hopsSoFar > MAX_REDIRECTS) {
      throw new AssertionError("More than " + MAX_REDIRECTS + " redirects, last at " + hop.url());
    }
    boolean endsHere = hop.location() == null || hop.location().getRawFragment() != null;
    return endsHere ? null : hop.location();
  }

  private static URI locationOf(URI requested, HttpResponse<?> response) {
    return response.headers().firstValue(MockHttp.LOCATION).map(requested::resolve).orElse(null);
  }

  private HttpRequest.Builder requestTo(String url) {
    HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url)).timeout(REQUEST_TIMEOUT);
    cookies.headerValue().ifPresent(value -> builder.header(COOKIE, value));
    return builder;
  }

  private HttpResponse<String> send(HttpRequest request) {
    try {
      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      cookies.capture(response);
      return response;
    } catch (IOException e) {
      throw new UncheckedIOException("Request to " + request.uri() + " failed", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while requesting " + request.uri(), e);
    }
  }
}
