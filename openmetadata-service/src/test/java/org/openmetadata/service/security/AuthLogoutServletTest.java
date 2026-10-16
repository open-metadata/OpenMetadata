package org.openmetadata.service.security;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;

class AuthLogoutServletTest {

  @Test
  void doGetRejectsLogoutRequests() {
    AuthLogoutServlet servlet = new AuthLogoutServlet();
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);

    servlet.doGet(request, response);

    verify(response).setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
    verify(response).setHeader("Allow", "POST");
    verifyNoInteractions(request);
  }
}
