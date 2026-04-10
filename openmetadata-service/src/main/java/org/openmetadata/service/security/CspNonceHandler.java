package org.openmetadata.service.security;

import java.nio.ByteBuffer;
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
  private static final int NONCE_SIZE_BYTES = 16;
  private static final SecureRandom RANDOM = new SecureRandom();

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    final String nonce = generateNonce();
    request.setAttribute(CSP_NONCE_ATTRIBUTE, nonce);

    Response.Wrapper wrappedResponse =
        new Response.Wrapper(request, response) {
          private boolean nonceReplaced = false;

          @Override
          public void write(boolean last, ByteBuffer content, Callback callback) {
            if (!nonceReplaced) {
              replaceNonceInCspHeader();
              nonceReplaced = true;
            }
            super.write(last, content, callback);
          }

          private void replaceNonceInCspHeader() {
            String cspField = getHeaders().get(CSP_HEADER_NAME);
            if (cspField != null && cspField.contains(CSP_NONCE_PLACEHOLDER)) {
              final String replaced = cspField.replace(CSP_NONCE_PLACEHOLDER, nonce);
              getHeaders().put(new HttpField(CSP_HEADER_NAME, replaced));
            }
          }
        };

    return super.handle(request, wrappedResponse, callback);
  }

  private static String generateNonce() {
    final byte[] nonceBytes = new byte[NONCE_SIZE_BYTES];
    RANDOM.nextBytes(nonceBytes);
    return Base64.getEncoder().encodeToString(nonceBytes);
  }
}
