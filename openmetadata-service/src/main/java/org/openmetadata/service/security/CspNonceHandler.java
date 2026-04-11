package org.openmetadata.service.security;

import java.security.SecureRandom;
import java.util.Base64;
import org.eclipse.jetty.http.HttpField;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;

public final class CspNonceHandler extends Handler.Wrapper {
  public static final String CSP_NONCE_ATTRIBUTE = "cspNonce";
  private static final String CSP_NONCE_PLACEHOLDER = "__CSP_NONCE__";
  private static final String CSP_HEADER_NAME = "Content-Security-Policy";
  private static final String CSP_REPORT_ONLY_HEADER_NAME = "Content-Security-Policy-Report-Only";
  private static final int NONCE_SIZE_BYTES = 16;
  private static final SecureRandom RANDOM = new SecureRandom();

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    final String nonce = generateNonce();
    request.setAttribute(CSP_NONCE_ATTRIBUTE, nonce);

    Callback demandCallback =
        new Callback() {
          @Override
          public void succeeded() {
            replaceNonceInCspHeader(response, nonce);
            callback.succeeded();
          }

          @Override
          public void failed(Throwable x) {
            replaceNonceInCspHeader(response, nonce);
            callback.failed(x);
          }
        };

    return super.handle(request, response, demandCallback);
  }

  private void replaceNonceInCspHeader(Response response, String nonce) {
    replaceNonceInHeader(response, CSP_HEADER_NAME, nonce);
    replaceNonceInHeader(response, CSP_REPORT_ONLY_HEADER_NAME, nonce);
  }

  private void replaceNonceInHeader(Response response, String headerName, String nonce) {
    final String headerValue = response.getHeaders().get(headerName);
    if (headerValue != null && headerValue.contains(CSP_NONCE_PLACEHOLDER)) {
      final String replaced = headerValue.replace(CSP_NONCE_PLACEHOLDER, nonce);
      response.getHeaders().put(new HttpField(headerName, replaced));
    }
  }

  private static String generateNonce() {
    final byte[] nonceBytes = new byte[NONCE_SIZE_BYTES];
    RANDOM.nextBytes(nonceBytes);
    return Base64.getEncoder().encodeToString(nonceBytes);
  }
}
