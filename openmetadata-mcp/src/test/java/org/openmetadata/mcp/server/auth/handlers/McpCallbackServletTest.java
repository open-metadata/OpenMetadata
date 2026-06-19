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
