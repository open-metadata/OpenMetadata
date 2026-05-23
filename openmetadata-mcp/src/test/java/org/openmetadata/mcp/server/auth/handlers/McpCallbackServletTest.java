package org.openmetadata.mcp.server.auth.handlers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class McpCallbackServletTest {

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
