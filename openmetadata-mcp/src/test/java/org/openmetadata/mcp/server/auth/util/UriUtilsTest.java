package org.openmetadata.mcp.server.auth.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class UriUtilsTest {

  @Test
  void testConstructRedirectUri_addsQueryParams() {
    Map<String, String> params = new LinkedHashMap<>();
    params.put("code", "abc123");
    params.put("state", "xyz");

    String result = UriUtils.constructRedirectUri("https://example.com/callback", params);

    assertThat(result).contains("code=abc123");
    assertThat(result).contains("state=xyz");
    assertThat(result).startsWith("https://example.com/callback?");
  }

  @Test
  void testConstructRedirectUri_preservesExistingQueryParams() {
    Map<String, String> params = Map.of("code", "abc123");

    String result = UriUtils.constructRedirectUri("https://example.com/cb?existing=1", params);

    assertThat(result).contains("existing=1");
    assertThat(result).contains("code=abc123");
    assertThat(result).contains("&");
  }

  @Test
  void testConstructRedirectUri_encodesSpecialCharacters() {
    Map<String, String> params = Map.of("redirect", "https://other.com?a=1&b=2");

    String result = UriUtils.constructRedirectUri("https://example.com/cb", params);

    assertThat(result).doesNotContain("https://other.com?a=1&b=2");
    assertThat(result).contains("redirect=");
  }

  @Test
  void testConstructRedirectUri_opaqueStateRoundTripsWithSingleEncoding() {
    // Regression: a base64 state with '+' and '=' padding must survive byte-for-byte after a
    // single URL-decode. Previously the encoded query was re-quoted by the multi-arg URI
    // constructor ("a==" -> "a%3D%3D" -> "a%253D%253D"), breaking clients that compare state
    // exactly (e.g. VS Code's loopback redirect -> "State does not match").
    String state = "n+eBY2DPiNEk3xEe7rqmtg==";
    Map<String, String> params = new LinkedHashMap<>();
    params.put("code", "abc123");
    params.put("state", state);

    String result = UriUtils.constructRedirectUri("http://127.0.0.1:33418/", params);

    String returnedState =
        URLDecoder.decode(
            result.replaceAll(".*[?&]state=", "").replaceAll("&.*", ""), StandardCharsets.UTF_8);
    assertThat(returnedState).isEqualTo(state);
    assertThat(result).doesNotContain("%25");
  }

  @Test
  void testConstructRedirectUri_skipsNullValues() {
    Map<String, String> params = new LinkedHashMap<>();
    params.put("code", "abc123");
    params.put("state", null);

    String result = UriUtils.constructRedirectUri("https://example.com/cb", params);

    assertThat(result).contains("code=abc123");
    assertThat(result).doesNotContain("state");
  }

  @Test
  void testConstructRedirectUri_emptyParams() {
    String result = UriUtils.constructRedirectUri("https://example.com/cb", Map.of());

    assertThat(result).startsWith("https://example.com/cb");
  }

  @Test
  void testConstructRedirectUri_invalidUri_throwsIllegalArgument() {
    assertThatThrownBy(() -> UriUtils.constructRedirectUri("not a valid uri[", Map.of("k", "v")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void testValidateIssuerUrl_httpsAccepted() {
    UriUtils.validateIssuerUrl(URI.create("https://example.com"));
  }

  @Test
  void testValidateIssuerUrl_localhostHttpAccepted() {
    UriUtils.validateIssuerUrl(URI.create("http://localhost:8585"));
  }

  @Test
  void testValidateIssuerUrl_127001HttpAccepted() {
    UriUtils.validateIssuerUrl(URI.create("http://127.0.0.1:8585"));
  }

  @Test
  void testValidateIssuerUrl_httpNonLocalhostRejected() {
    assertThatThrownBy(() -> UriUtils.validateIssuerUrl(URI.create("http://example.com")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("HTTPS");
  }

  @Test
  void testValidateIssuerUrl_fragmentRejected() {
    assertThatThrownBy(() -> UriUtils.validateIssuerUrl(URI.create("https://example.com#frag")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("fragment");
  }

  @Test
  void testValidateIssuerUrl_queryRejected() {
    assertThatThrownBy(() -> UriUtils.validateIssuerUrl(URI.create("https://example.com?q=1")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("query");
  }

  @Test
  void testBuildEndpointUrl_appendsPath() {
    URI result = UriUtils.buildEndpointUrl(URI.create("https://example.com"), "/authorize");

    assertThat(result).isEqualTo(URI.create("https://example.com/authorize"));
  }

  @Test
  void testBuildEndpointUrl_trailingSlashHandled() {
    URI result = UriUtils.buildEndpointUrl(URI.create("https://example.com/"), "/authorize");

    assertThat(result).isEqualTo(URI.create("https://example.com/authorize"));
  }

  @Test
  void testModifyUriPath_transformsPath() {
    URI original = URI.create("https://example.com/old/path");

    URI result = UriUtils.modifyUriPath(original, p -> "/new/path");

    assertThat(result.getPath()).isEqualTo("/new/path");
    assertThat(result.getHost()).isEqualTo("example.com");
    assertThat(result.getScheme()).isEqualTo("https");
  }
}
