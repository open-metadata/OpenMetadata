package org.openmetadata.mcp.server.auth.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.TokenAudience;

class McpResourceUriTest {

  private static final URI CANONICAL_HTTPS = URI.create("https://om.example/mcp");
  private static final URI CANONICAL_HTTP = URI.create("http://om.example/mcp");
  private static final URI CANONICAL_SUBPATH = URI.create("https://om.example/data-catalog/mcp");
  private static final URI CANONICAL_IPV6 = URI.create("https://[::1]/mcp");
  private static final URI CANONICAL_IPV6_CUSTOM_PORT =
      URI.create("https://[2001:db8::1]:8443/mcp");

  @Test
  void exactAndEquivalentCanonicalFormsMatch() {
    assertThat(McpResourceUri.matches("https://om.example/mcp", CANONICAL_HTTPS)).isTrue();
    assertThat(McpResourceUri.matches("https://om.example/mcp/", CANONICAL_HTTPS)).isTrue();
    assertThat(McpResourceUri.matches("HTTPS://OM.EXAMPLE/mcp", CANONICAL_HTTPS)).isTrue();
    assertThat(McpResourceUri.matches("https://om.example:443/mcp", CANONICAL_HTTPS)).isTrue();
    assertThat(McpResourceUri.matches("HTTPS://OM.EXAMPLE:443/mcp/", CANONICAL_HTTPS)).isTrue();
    assertThat(McpResourceUri.matches("http://om.example:80/mcp/", CANONICAL_HTTP)).isTrue();
    assertThat(McpResourceUri.matches("https://om.example/data-catalog/mcp", CANONICAL_SUBPATH))
        .isTrue();
    assertThat(McpResourceUri.matches("https://om.example/data-catalog/mcp/", CANONICAL_SUBPATH))
        .isTrue();
  }

  @Test
  void ipv6LiteralHostsAndPortsNormalizeProperly() {
    assertThat(McpResourceUri.matches("https://[::1]/mcp", CANONICAL_IPV6)).isTrue();
    assertThat(McpResourceUri.matches("https://[::1]:443/mcp/", CANONICAL_IPV6)).isTrue();
    assertThat(
            McpResourceUri.matches("HTTPS://[2001:DB8::1]:8443/mcp/", CANONICAL_IPV6_CUSTOM_PORT))
        .isTrue();
    assertThat(McpResourceUri.matches("https://[2001:db8::1]/mcp", CANONICAL_IPV6_CUSTOM_PORT))
        .isFalse();
  }

  @Test
  void caseFoldingUsesLocaleRootUnderTurkishLocale() {
    Locale previous = Locale.getDefault();
    try {
      Locale.setDefault(Locale.forLanguageTag("tr-TR"));
      assertThat(McpResourceUri.parseValid("HTTPS://API.EXAMPLE/mcp"))
          .contains(URI.create("https://api.example/mcp"));
      assertThat(
              McpResourceUri.matches(
                  "HTTPS://API.EXAMPLE:443/mcp/", URI.create("https://api.example/mcp")))
          .isTrue();
    } finally {
      Locale.setDefault(previous);
    }
  }

  @Test
  void nonDotPathSegmentsContainingDotsAreAccepted() {
    URI versioned = URI.create("https://om.example/v1.0/mcp");
    assertThat(McpResourceUri.matches("https://om.example/v1.0/mcp/", versioned)).isTrue();
    assertThat(McpResourceUri.parseValid("https://om.example:65535/mcp"))
        .contains(URI.create("https://om.example:65535/mcp"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "https://om.example/MCP",
        "https://om.example/Mcp",
        "https://om.example/%6dcp",
        "https://om.example/%6Dcp",
        "https://om.example/mcp/sub",
        "https://om.example/mcp2",
        "https://om.example/",
        "https://om.example",
        "http://om.example/mcp",
        "https://om.example:8443/mcp",
        "https://om.example:80/mcp",
        "http://om.example:443/mcp",
        "https://other.example/mcp"
      })
  void mismatchedSchemeHostPortOrPathIsRejected(String candidate) {
    assertThat(McpResourceUri.matches(candidate, CANONICAL_HTTPS)).isFalse();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "",
        "   ",
        " https://om.example/mcp",
        "https://om.example/mcp ",
        "\thttps://om.example/mcp",
        "https://om.example/mcp\n",
        "\u00A0https://om.example/mcp",
        "https://om.example/mc p",
        "https://om.example/mcp#frag",
        "https://om.example/mcp#",
        "https://om.example/mcp?a=1",
        "https://om.example/mcp?",
        "https://user@om.example/mcp",
        "https://user:pass@om.example/mcp",
        "https://@om.example/mcp",
        "https://om.example:/mcp",
        "https://[::1]:/mcp",
        "https://om.example:0/mcp",
        "https://om.example:65536/mcp",
        "https://om.example:70000/mcp",
        "https://om.example:-1/mcp",
        "https://om.example:abc/mcp",
        "https://om.example/mcp//",
        "https://om.example//mcp",
        "https://om.example/data-catalog//mcp",
        "https://om.example/./mcp",
        "https://om.example/foo/../mcp",
        "https://om.example/mcp/.",
        "https://om.example/mcp/..",
        "https://om.example/mcp/./",
        "https://om.example/..",
        "/mcp",
        "mcp",
        "urn:example:mcp",
        "mailto:user@om.example",
        "https:om.example/mcp",
        "ftp://om.example/mcp",
        "ws://om.example/mcp",
        "javascript:alert(1)",
        "file:///mcp",
        "https:///mcp",
        "https://a_b.example/mcp",
        "https://om.example/mcp\\sub"
      })
  void invalidSyntaxOrForbiddenComponentsAreRejected(String raw) {
    assertThat(McpResourceUri.parseValid(raw)).isEmpty();
    assertThat(McpResourceUri.matches(raw, CANONICAL_HTTPS)).isFalse();
  }

  @Test
  void nullAndMaxLengthBoundaryAreEnforced() {
    assertThat(McpResourceUri.parseValid(null)).isEmpty();
    assertThat(McpResourceUri.matches(null, CANONICAL_HTTPS)).isFalse();

    String prefix = "https://om.example/";
    String exactMax = prefix + "a".repeat(McpResourceUri.MAX_RESOURCE_LENGTH - prefix.length());
    assertThat(exactMax).hasSize(McpResourceUri.MAX_RESOURCE_LENGTH);
    assertThat(McpResourceUri.parseValid(exactMax)).contains(URI.create(exactMax));

    String overMax = exactMax + "a";
    assertThat(overMax).hasSize(McpResourceUri.MAX_RESOURCE_LENGTH + 1);
    assertThat(McpResourceUri.parseValid(overMax)).isEmpty();
  }

  @Test
  void nullOrInvalidExpectedCanonicalFailsClosed() {
    assertThat(McpResourceUri.matches("https://om.example/mcp", null)).isFalse();
    assertThat(
            McpResourceUri.matches(
                "https://om.example/mcp", URI.create("https://om.example/mcp#frag")))
        .isFalse();
    assertThat(McpResourceUri.validateRequested(List.of("https://om.example/mcp"), null)).isFalse();
    assertThat(
            McpResourceUri.validateRequested(
                List.of("https://om.example/mcp"), URI.create("https://om.example/mcp?q=1")))
        .isFalse();
  }

  @Test
  void validateRequestedHandlesOmittedSingleAndMultiValueParams() {
    assertThat(McpResourceUri.validateRequested(null, CANONICAL_HTTPS)).isTrue();
    assertThat(McpResourceUri.validateRequested(List.of(), CANONICAL_HTTPS)).isTrue();
    assertThat(McpResourceUri.validateRequested(null, null)).isTrue();

    assertThat(
            McpResourceUri.validateRequested(
                List.of("https://om.example/mcp", "https://om.example/mcp/"), CANONICAL_HTTPS))
        .isTrue();
    assertThat(
            McpResourceUri.validateRequested(
                List.of("https://om.example/mcp", "https://evil.example/mcp"), CANONICAL_HTTPS))
        .isFalse();
    assertThat(
            McpResourceUri.validateRequested(
                List.of("https://om.example/mcp", ""), CANONICAL_HTTPS))
        .isFalse();
    assertThat(
            McpResourceUri.validateRequested(
                Arrays.asList("https://om.example/mcp", null), CANONICAL_HTTPS))
        .isFalse();
    assertThat(McpResourceUri.validateRequested(List.of(""), CANONICAL_HTTPS)).isFalse();
  }

  /** The MCP endpoint's audience rule compares {@code aud} with the resource it serves now. */
  @Test
  void tokenAudienceAcceptsEquivalentFormsOfTheCurrentResourceOnly() {
    AtomicReference<URI> served = new AtomicReference<>(CANONICAL_HTTPS);
    TokenAudience audience = McpResourceUri.tokenAudienceOf(served::get);

    assertThatCode(() -> audience.requireAddressedHere(tokenFor("HTTPS://OM.EXAMPLE:443/mcp/")))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> audience.requireAddressedHere(tokenFor("https://evil.example/mcp")))
        .isInstanceOf(AuthenticationException.class);

    served.set(CANONICAL_SUBPATH);

    assertThatThrownBy(() -> audience.requireAddressedHere(tokenFor("https://om.example/mcp")))
        .isInstanceOf(AuthenticationException.class);
    assertThatCode(
            () -> audience.requireAddressedHere(tokenFor("https://om.example/data-catalog/mcp")))
        .doesNotThrowAnyException();
  }

  @Test
  void tokenAudienceOfAnUnresolvedResourceFailsClosed() {
    TokenAudience audience = McpResourceUri.tokenAudienceOf(() -> null);

    assertThatThrownBy(() -> audience.requireAddressedHere(tokenFor("https://om.example/mcp")))
        .isInstanceOf(AuthenticationException.class);
  }

  private static DecodedJWT tokenFor(String audience) {
    return JWT.decode(JWT.create().withAudience(audience).sign(Algorithm.none()));
  }
}
