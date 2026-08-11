/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security;

import java.security.SecureRandom;
import java.util.Base64;
import org.eclipse.jetty.http.HttpField;
import org.eclipse.jetty.http.HttpFields;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.openmetadata.service.config.web.CspHeaderFactory;

public final class CspNonceHandler extends Handler.Wrapper {
  public static final String CSP_NONCE_ATTRIBUTE = "cspNonce";
  public static final String CSP_NONCE_PLACEHOLDER = "__CSP_NONCE__";
  private static final int NONCE_SIZE_BYTES = 16;
  private static final SecureRandom RANDOM = new SecureRandom();

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    final String nonce = generateNonce();
    request.setAttribute(CSP_NONCE_ATTRIBUTE, nonce);

    Response.Wrapper wrappedResponse =
        new Response.Wrapper(request, response) {
          private HttpFields.Mutable wrappedHeaders;

          @Override
          public HttpFields.Mutable getHeaders() {
            if (wrappedHeaders == null) {
              final HttpFields.Mutable delegate = super.getHeaders();
              wrappedHeaders =
                  new HttpFields.Mutable.Wrapper(delegate) {
                    @Override
                    public HttpFields.Mutable put(HttpField field) {
                      if (field.getName().equals(CspHeaderFactory.CSP_HEADER)
                          || field.getName().equals(CspHeaderFactory.CSP_REPORT_ONLY_HEADER)) {
                        final String value = field.getValue();
                        if (value != null && value.contains(CSP_NONCE_PLACEHOLDER)) {
                          final String replaced = value.replace(CSP_NONCE_PLACEHOLDER, nonce);
                          super.put(new HttpField(field.getName(), replaced));
                          return this;
                        }
                      }
                      super.put(field);
                      return this;
                    }
                  };
            }
            return wrappedHeaders;
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
