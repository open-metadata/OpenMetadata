package org.openmetadata.mcp.server.auth.handlers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;

class McpCallbackServletTest {

  // ── existing test ────────────────────────────────────────────────────────

  @Test
  void bufferedResponseSendErrorSupportsExistingOutputStreamUsage() throws Exception {
    HttpServletResponse delegateResponse = mock(HttpServletResponse.class);
    ByteArrayOutputStream committedBody = new ByteArrayOutputStream();

    when(delegateResponse.getOutputStream())
        .thenReturn(new CapturingServletOutputStream(committedBody));

    HttpServletResponse bufferedResponse = newBufferedResponse(delegateResponse);
    bufferedResponse.getOutputStream().write("prefix:".getBytes(StandardCharsets.UTF_8));

    assertDoesNotThrow(
        () -> bufferedResponse.sendError(HttpServletResponse.SC_BAD_REQUEST, "invalid-request"));

    commitTo(bufferedResponse, delegateResponse);

    verify(delegateResponse).setStatus(HttpServletResponse.SC_BAD_REQUEST);
    assertThat(committedBody.toString(StandardCharsets.UTF_8)).isEqualTo("prefix:invalid-request");
  }

  // ── serveFragmentExtractionPage ──────────────────────────────────────────

  @Test
  void serveFragmentExtractionPage_setsHtmlContentTypeAndStatus200() throws Exception {
    StringWriter body = new StringWriter();
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(response.getWriter()).thenReturn(new PrintWriter(body));

    invokeServeFragmentExtractionPage(makeServlet(), response);

    verify(response).setContentType("text/html;charset=UTF-8");
    verify(response).setStatus(HttpServletResponse.SC_OK);
  }

  @Test
  void serveFragmentExtractionPage_htmlUsesFormPostNotGetRedirect() throws Exception {
    StringWriter body = new StringWriter();
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(response.getWriter()).thenReturn(new PrintWriter(body));

    invokeServeFragmentExtractionPage(makeServlet(), response);

    String html = body.toString();
    assertThat(html).contains("f.method = 'POST'");
    assertThat(html).doesNotContain("window.location.replace");
    assertThat(html).doesNotContain("?id_token=");
  }

  @Test
  void serveFragmentExtractionPage_errorHandlerUsesTextContent() throws Exception {
    StringWriter body = new StringWriter();
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(response.getWriter()).thenReturn(new PrintWriter(body));

    invokeServeFragmentExtractionPage(makeServlet(), response);

    String html = body.toString();
    assertThat(html).contains("document.body.textContent");
    assertThat(html).doesNotContain("innerHTML");
  }

  // ── CSRF: isOriginAllowed ─────────────────────────────────────────────────

  @Test
  void isOriginAllowed_noOriginHeader_allowed() {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getHeader("Origin")).thenReturn(null);

    assertThat(makeServlet().isOriginAllowed(request)).isTrue();
  }

  // ── CSRF: resolveServerOrigin default-port stripping ─────────────────────

  @Test
  void resolveServerOrigin_stripsDefaultHttpsPort() throws Exception {
    // baseUrl with explicit :443 → origin must not include :443 (browsers omit default ports)
    String origin = invokeResolveServerOrigin("https://example.com:443");
    assertThat(origin).isEqualTo("https://example.com");
  }

  @Test
  void resolveServerOrigin_stripsDefaultHttpPort() throws Exception {
    String origin = invokeResolveServerOrigin("http://example.com:80");
    assertThat(origin).isEqualTo("http://example.com");
  }

  @Test
  void resolveServerOrigin_keepsNonDefaultPort() throws Exception {
    String origin = invokeResolveServerOrigin("https://example.com:8585");
    assertThat(origin).isEqualTo("https://example.com:8585");
  }

  @Test
  void resolveServerOrigin_noPort_returnsSchemePlusHost() throws Exception {
    String origin = invokeResolveServerOrigin("https://devrel.getcollate.io");
    assertThat(origin).isEqualTo("https://devrel.getcollate.io");
  }

  @Test
  void isOriginAllowed_matchingOrigin_allowed() {
    McpCallbackServlet servlet =
        new McpCallbackServlet(
            mock(UserSSOOAuthProvider.class), mock(McpPendingAuthRequestRepository.class)) {
          @Override
          String resolveServerOrigin() {
            return "https://example.getcollate.io";
          }
        };
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getHeader("Origin")).thenReturn("https://example.getcollate.io");

    assertThat(servlet.isOriginAllowed(request)).isTrue();
  }

  @Test
  void isOriginAllowed_mismatchedOrigin_rejected() {
    McpCallbackServlet servlet =
        new McpCallbackServlet(
            mock(UserSSOOAuthProvider.class), mock(McpPendingAuthRequestRepository.class)) {
          @Override
          String resolveServerOrigin() {
            return "https://example.getcollate.io";
          }
        };
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getHeader("Origin")).thenReturn("https://malicious.attacker.com");

    assertThat(servlet.isOriginAllowed(request)).isFalse();
  }

  @Test
  void isOriginAllowed_unknownServerOrigin_rejectsPresentOrigin() {
    // When server origin cannot be resolved (misconfiguration/startup race), a present
    // Origin header must be rejected — not silently allowed — to keep CSRF protection active.
    McpCallbackServlet servlet =
        new McpCallbackServlet(
            mock(UserSSOOAuthProvider.class), mock(McpPendingAuthRequestRepository.class)) {
          @Override
          String resolveServerOrigin() {
            return null;
          }
        };
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getHeader("Origin")).thenReturn("https://attacker.example.com");

    assertThat(servlet.isOriginAllowed(request)).isFalse();
  }

  @Test
  void doPost_mismatchedOrigin_sends403() throws Exception {
    McpCallbackServlet servlet =
        new McpCallbackServlet(
            mock(UserSSOOAuthProvider.class), mock(McpPendingAuthRequestRepository.class)) {
          @Override
          protected AuthenticationCodeFlowHandler resolveSsoHandler() {
            return mock(AuthenticationCodeFlowHandler.class);
          }

          @Override
          String resolveServerOrigin() {
            return "https://example.getcollate.io";
          }
        };
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(request.getHeader("Origin")).thenReturn("https://malicious.attacker.com");

    servlet.doPost(request, response);

    verify(response)
        .sendError(
            HttpServletResponse.SC_FORBIDDEN,
            "CSRF protection: request origin does not match server origin");
  }

  // ── doPost: null SSO handler → 503 ───────────────────────────────────────

  @Test
  void doPost_noSsoHandler_sends503() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);

    McpCallbackServlet servlet = makeServletWithHandler(null);
    servlet.doPost(request, response);

    verify(response)
        .sendError(
            HttpServletResponse.SC_SERVICE_UNAVAILABLE,
            "MCP SSO not available. Please restart the server.");
  }

  // ── doPost: missing id_token → 400 ───────────────────────────────────────

  @Test
  void doPost_nullIdToken_sends400() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(request.getParameter("id_token")).thenReturn(null);

    AuthenticationCodeFlowHandler handler = mock(AuthenticationCodeFlowHandler.class);
    McpCallbackServlet servlet = makeServletWithHandler(handler);
    servlet.doPost(request, response);

    verify(response)
        .sendError(
            HttpServletResponse.SC_BAD_REQUEST, "Invalid MCP OAuth callback - missing id_token");
  }

  @Test
  void doPost_emptyIdToken_sends400() throws Exception {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(request.getParameter("id_token")).thenReturn("");

    AuthenticationCodeFlowHandler handler = mock(AuthenticationCodeFlowHandler.class);
    McpCallbackServlet servlet = makeServletWithHandler(handler);
    servlet.doPost(request, response);

    verify(response)
        .sendError(
            HttpServletResponse.SC_BAD_REQUEST, "Invalid MCP OAuth callback - missing id_token");
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private static McpCallbackServlet makeServlet() {
    return new McpCallbackServlet(
        mock(UserSSOOAuthProvider.class), mock(McpPendingAuthRequestRepository.class));
  }

  /** Creates a servlet whose resolveSsoHandler() returns the given handler (null = no SSO). */
  private static McpCallbackServlet makeServletWithHandler(AuthenticationCodeFlowHandler handler) {
    return new McpCallbackServlet(
        mock(UserSSOOAuthProvider.class), mock(McpPendingAuthRequestRepository.class)) {
      @Override
      protected AuthenticationCodeFlowHandler resolveSsoHandler() {
        return handler;
      }
    };
  }

  /**
   * Invokes resolveServerOrigin() on a servlet subclass that has the port-stripping logic but
   * short-circuits the DB/config lookup, injecting the given baseUrl directly.
   */
  private static String invokeResolveServerOrigin(String baseUrl) throws Exception {
    McpCallbackServlet servlet =
        new McpCallbackServlet(
            mock(UserSSOOAuthProvider.class), mock(McpPendingAuthRequestRepository.class)) {
          @Override
          String resolveServerOrigin() {
            try {
              java.net.URI uri = java.net.URI.create(baseUrl);
              int port = uri.getPort();
              boolean isDefaultPort =
                  ("https".equals(uri.getScheme()) && port == 443)
                      || ("http".equals(uri.getScheme()) && port == 80);
              String portPart = (port != -1 && !isDefaultPort) ? ":" + port : "";
              return uri.getScheme() + "://" + uri.getHost() + portPart;
            } catch (Exception e) {
              return null;
            }
          }
        };
    return servlet.resolveServerOrigin();
  }

  private static void invokeServeFragmentExtractionPage(
      McpCallbackServlet servlet, HttpServletResponse response) throws Exception {
    Method m =
        McpCallbackServlet.class.getDeclaredMethod(
            "serveFragmentExtractionPage", HttpServletResponse.class);
    m.setAccessible(true);
    m.invoke(servlet, response);
  }

  private static HttpServletResponse newBufferedResponse(HttpServletResponse response)
      throws Exception {
    Class<?> wrapperClass =
        Class.forName(
            "org.openmetadata.mcp.server.auth.handlers.McpCallbackServlet$BufferedServletResponseWrapper");
    Constructor<?> constructor = wrapperClass.getDeclaredConstructor(HttpServletResponse.class);
    constructor.setAccessible(true);
    return (HttpServletResponse) constructor.newInstance(response);
  }

  private static void commitTo(HttpServletResponse bufferedResponse, HttpServletResponse response)
      throws Exception {
    Method method =
        bufferedResponse.getClass().getDeclaredMethod("commitTo", HttpServletResponse.class);
    method.setAccessible(true);
    method.invoke(bufferedResponse, response);
  }

  private static final class CapturingServletOutputStream extends ServletOutputStream {
    private final ByteArrayOutputStream outputStream;

    private CapturingServletOutputStream(ByteArrayOutputStream outputStream) {
      this.outputStream = outputStream;
    }

    @Override
    public void write(int b) {
      outputStream.write(b);
    }

    @Override
    public boolean isReady() {
      return true;
    }

    @Override
    public void setWriteListener(WriteListener writeListener) {}
  }
}
