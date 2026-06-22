package org.openmetadata.service.socket;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SocketAddressFilterTest {

  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private FilterChain chain;

  @Test
  void handshakeWithoutQueryStringDoesNotFail() throws Exception {
    SocketAddressFilter filter = new SocketAddressFilter();
    when(request.getQueryString()).thenReturn(null);
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");

    filter.doFilter(request, response, chain);

    verify(chain).doFilter(any(), eq(response));
    verify(response, never()).getWriter();
  }
}
