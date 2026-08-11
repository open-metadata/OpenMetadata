package org.openmetadata.mcp.server.auth.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.server.auth.util.ClientCredentialsExtractor.Credentials;
import org.openmetadata.mcp.server.auth.util.ClientCredentialsExtractor.InvalidClientCredentialsException;

class ClientCredentialsExtractorTest {

  private HttpServletRequest requestWithAuthHeader(String headerValue) {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getHeader("Authorization")).thenReturn(headerValue);
    return request;
  }

  private static String basicHeader(String clientId, String clientSecret) {
    String raw = clientId + ":" + clientSecret;
    return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }

  @Test
  void testBasicHeader_parsesCredentials() throws Exception {
    HttpServletRequest request = requestWithAuthHeader(basicHeader("my-client", "s3cret"));

    Credentials credentials = ClientCredentialsExtractor.extract(request, null, null);

    assertThat(credentials.clientId()).isEqualTo("my-client");
    assertThat(credentials.clientSecret()).isEqualTo("s3cret");
  }

  @Test
  void testBasicHeader_lowercaseScheme_accepted() throws Exception {
    String encoded = Base64.getEncoder().encodeToString("a:b".getBytes(StandardCharsets.UTF_8));
    HttpServletRequest request = requestWithAuthHeader("basic " + encoded);

    Credentials credentials = ClientCredentialsExtractor.extract(request, null, null);

    assertThat(credentials.clientId()).isEqualTo("a");
    assertThat(credentials.clientSecret()).isEqualTo("b");
  }

  @Test
  void testBasicHeader_urlEncodedCredentials_decoded() throws Exception {
    // RFC 6749 §2.3.1: client_id / client_secret are application/x-www-form-urlencoded
    // before Base64. Secret containing ':' is encoded as %3A.
    String encodedRaw = "client%2Fid:secret%3Awith%3Acolons";
    String header =
        "Basic " + Base64.getEncoder().encodeToString(encodedRaw.getBytes(StandardCharsets.UTF_8));
    HttpServletRequest request = requestWithAuthHeader(header);

    Credentials credentials = ClientCredentialsExtractor.extract(request, null, null);

    assertThat(credentials.clientId()).isEqualTo("client/id");
    assertThat(credentials.clientSecret()).isEqualTo("secret:with:colons");
  }

  @Test
  void testNoHeaderNoBody_returnsNullCredentials() throws Exception {
    HttpServletRequest request = requestWithAuthHeader(null);

    Credentials credentials = ClientCredentialsExtractor.extract(request, null, null);

    assertThat(credentials.clientId()).isNull();
    assertThat(credentials.clientSecret()).isNull();
  }

  @Test
  void testBodyOnly_returnsBodyValues() throws Exception {
    HttpServletRequest request = requestWithAuthHeader(null);

    Credentials credentials =
        ClientCredentialsExtractor.extract(request, "body-client", "body-secret");

    assertThat(credentials.clientId()).isEqualTo("body-client");
    assertThat(credentials.clientSecret()).isEqualTo("body-secret");
  }

  @Test
  void testHeaderAndBody_mismatchedClientId_throws() {
    HttpServletRequest request = requestWithAuthHeader(basicHeader("hdr-client", "hdr-secret"));

    assertThatThrownBy(
            () -> ClientCredentialsExtractor.extract(request, "body-client", "hdr-secret"))
        .isInstanceOf(InvalidClientCredentialsException.class)
        .hasMessageContaining("client_id");
  }

  @Test
  void testHeaderAndBody_mismatchedClientSecret_throws() {
    HttpServletRequest request = requestWithAuthHeader(basicHeader("hdr-client", "hdr-secret"));

    assertThatThrownBy(
            () -> ClientCredentialsExtractor.extract(request, "hdr-client", "body-secret"))
        .isInstanceOf(InvalidClientCredentialsException.class)
        .hasMessageContaining("client_secret");
  }

  @Test
  void testHeaderAndBody_matchingDuplicates_returnsHeaderCredentials() throws Exception {
    HttpServletRequest request = requestWithAuthHeader(basicHeader("hdr-client", "hdr-secret"));

    Credentials credentials =
        ClientCredentialsExtractor.extract(request, "hdr-client", "hdr-secret");

    assertThat(credentials.clientId()).isEqualTo("hdr-client");
    assertThat(credentials.clientSecret()).isEqualTo("hdr-secret");
  }

  @Test
  void testHeaderAndBody_clientIdOnlyAndMatching_returnsHeaderCredentials() throws Exception {
    HttpServletRequest request = requestWithAuthHeader(basicHeader("hdr-client", "hdr-secret"));

    Credentials credentials = ClientCredentialsExtractor.extract(request, "hdr-client", null);

    assertThat(credentials.clientId()).isEqualTo("hdr-client");
    assertThat(credentials.clientSecret()).isEqualTo("hdr-secret");
  }

  @Test
  void testHeaderAndBody_clientSecretOnlyAndMatching_returnsHeaderCredentials() throws Exception {
    HttpServletRequest request = requestWithAuthHeader(basicHeader("hdr-client", "hdr-secret"));

    Credentials credentials = ClientCredentialsExtractor.extract(request, null, "hdr-secret");

    assertThat(credentials.clientId()).isEqualTo("hdr-client");
    assertThat(credentials.clientSecret()).isEqualTo("hdr-secret");
  }

  @Test
  void testBasicHeader_missingColon_throws() {
    String header =
        "Basic " + Base64.getEncoder().encodeToString("nocolon".getBytes(StandardCharsets.UTF_8));
    HttpServletRequest request = requestWithAuthHeader(header);

    assertThatThrownBy(() -> ClientCredentialsExtractor.extract(request, null, null))
        .isInstanceOf(InvalidClientCredentialsException.class);
  }

  @Test
  void testBasicHeader_invalidBase64_throws() {
    HttpServletRequest request = requestWithAuthHeader("Basic !!!not-base64!!!");

    assertThatThrownBy(() -> ClientCredentialsExtractor.extract(request, null, null))
        .isInstanceOf(InvalidClientCredentialsException.class);
  }

  @Test
  void testBasicHeader_emptyValue_throws() {
    HttpServletRequest request = requestWithAuthHeader("Basic ");

    assertThatThrownBy(() -> ClientCredentialsExtractor.extract(request, null, null))
        .isInstanceOf(InvalidClientCredentialsException.class);
  }

  @Test
  void testBasicHeader_emptyClientId_throws() {
    String header =
        "Basic " + Base64.getEncoder().encodeToString(":secret".getBytes(StandardCharsets.UTF_8));
    HttpServletRequest request = requestWithAuthHeader(header);

    assertThatThrownBy(() -> ClientCredentialsExtractor.extract(request, null, null))
        .isInstanceOf(InvalidClientCredentialsException.class);
  }

  @Test
  void testBasicHeader_emptyClientSecret_allowed() throws Exception {
    String header =
        "Basic "
            + Base64.getEncoder().encodeToString("public-client:".getBytes(StandardCharsets.UTF_8));
    HttpServletRequest request = requestWithAuthHeader(header);

    Credentials credentials = ClientCredentialsExtractor.extract(request, null, null);

    assertThat(credentials.clientId()).isEqualTo("public-client");
    assertThat(credentials.clientSecret()).isEmpty();
  }

  @Test
  void testNonBasicScheme_fallsBackToBody() throws Exception {
    HttpServletRequest request = requestWithAuthHeader("Bearer abc.def.ghi");

    Credentials credentials =
        ClientCredentialsExtractor.extract(request, "body-client", "body-secret");

    assertThat(credentials.clientId()).isEqualTo("body-client");
    assertThat(credentials.clientSecret()).isEqualTo("body-secret");
  }
}
