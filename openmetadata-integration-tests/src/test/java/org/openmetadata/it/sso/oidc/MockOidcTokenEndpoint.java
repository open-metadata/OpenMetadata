package org.openmetadata.it.sso.oidc;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.CLIENT_ID;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.CLIENT_SECRET;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.CODE;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.CODE_VERIFIER;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.GRANT_AUTHORIZATION_CODE;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.GRANT_CLIENT_CREDENTIALS;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.GRANT_REFRESH_TOKEN;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.GRANT_TYPE;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.INVALID_CLIENT;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.INVALID_GRANT;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.REDIRECT_URI;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.REFRESH_TOKEN;
import static org.openmetadata.it.sso.oidc.MockOidcProtocol.UNSUPPORTED_GRANT_TYPE;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.net.URLDecoder;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.it.sso.MockHttp;
import org.openmetadata.it.sso.MockRequestJournal;
import org.openmetadata.it.sso.MockResponseGate;
import org.openmetadata.it.sso.oidc.MockOidcProtocol.ErrorResponse;
import org.openmetadata.it.sso.oidc.MockOidcProtocol.TokenResponse;
import org.openmetadata.schema.utils.JsonUtils;

/** The token endpoint: code exchange, refresh and client credentials for one registered client. */
final class MockOidcTokenEndpoint implements HttpHandler {
  private static final String BASIC_PREFIX = "Basic ";
  private static final String CONTENT_TYPE = "Content-Type";
  private static final int OK = 200;
  private static final int BAD_REQUEST = 400;
  private static final int UNAUTHORIZED = 401;

  private final MockOidcTokens tokens;
  private final MockRequestJournal journal;
  private final String clientId;
  private final String clientSecret;
  private final AtomicReference<RefreshOutcome> refreshOutcome =
      new AtomicReference<>(RefreshOutcome.renew());
  private final Queue<MockResponseGate> pendingGates = new ConcurrentLinkedQueue<>();

  MockOidcTokenEndpoint(
      MockOidcTokens tokens, MockRequestJournal journal, String clientId, String clientSecret) {
    this.tokens = tokens;
    this.journal = journal;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  void answerRefreshesWith(RefreshOutcome outcome) {
    refreshOutcome.set(outcome);
  }

  /** Gates are taken in order: the first queued gate holds the next token request, and so on. */
  MockResponseGate holdNextResponse() {
    MockResponseGate gate = new MockResponseGate();
    pendingGates.add(gate);
    return gate;
  }

  @Override
  public void handle(HttpExchange exchange) throws IOException {
    Map<String, String> form = MockHttp.formParameters(exchange);
    journal.record(exchange, form);
    Optional.ofNullable(pendingGates.poll()).ifPresent(MockResponseGate::holdResponse);
    if (isRegisteredClient(exchange, form)) {
      respondToGrant(exchange, form);
    } else {
      respondError(exchange, UNAUTHORIZED, INVALID_CLIENT);
    }
  }

  private void respondToGrant(HttpExchange exchange, Map<String, String> form) throws IOException {
    switch (String.valueOf(form.get(GRANT_TYPE))) {
      case GRANT_AUTHORIZATION_CODE -> respondWithTokens(exchange, redeemCode(form));
      case GRANT_REFRESH_TOKEN -> respondToRefresh(exchange, form.get(REFRESH_TOKEN));
      case GRANT_CLIENT_CREDENTIALS -> respondJson(exchange, tokens.forClientCredentials());
      default -> respondError(exchange, BAD_REQUEST, UNSUPPORTED_GRANT_TYPE);
    }
  }

  private Optional<TokenResponse> redeemCode(Map<String, String> form) {
    return tokens
        .redeemCode(form.get(CODE))
        .filter(grant -> grant.isRedeemableBy(form.get(REDIRECT_URI), form.get(CODE_VERIFIER)))
        .map(tokens::forLogin);
  }

  private void respondToRefresh(HttpExchange exchange, String refreshToken) throws IOException {
    Optional<MockOidcIdentity> holder = tokens.holderOf(refreshToken);
    RefreshOutcome outcome = refreshOutcome.get();
    if (holder.isPresent() && outcome instanceof RefreshOutcome.Renew renew) {
      respondJson(exchange, tokens.forRefresh(holder.get(), refreshToken, renew));
    } else if (holder.isPresent()) {
      respondWith(exchange, outcome);
    } else {
      respondError(exchange, BAD_REQUEST, INVALID_GRANT);
    }
  }

  private static void respondWithTokens(HttpExchange exchange, Optional<TokenResponse> response)
      throws IOException {
    if (response.isPresent()) {
      respondJson(exchange, response.get());
    } else {
      respondError(exchange, BAD_REQUEST, INVALID_GRANT);
    }
  }

  private static void respondWith(HttpExchange exchange, RefreshOutcome outcome)
      throws IOException {
    switch (outcome) {
      case RefreshOutcome.Reject reject -> respondError(exchange, reject.status(), reject.error());
      case RefreshOutcome.Fail fail -> respondRaw(exchange, fail);
      case RefreshOutcome.Renew renew -> throw new IllegalStateException(
          "A renewal needs a refresh-token holder: " + renew);
    }
  }

  private boolean isRegisteredClient(HttpExchange exchange, Map<String, String> form) {
    String authorization = exchange.getRequestHeaders().getFirst(MockHttp.AUTHORIZATION);
    String[] credentials =
        authorization == null
            ? new String[] {form.get(CLIENT_ID), form.get(CLIENT_SECRET)}
            : basicCredentials(authorization);
    return clientId.equals(credentials[0]) && clientSecret.equals(credentials[1]);
  }

  // RFC 6749 2.3.1: the id and secret are form-encoded before being joined and base64-encoded.
  private static String[] basicCredentials(String authorization) {
    String encoded = authorization.substring(BASIC_PREFIX.length());
    String decoded = new String(Base64.getDecoder().decode(encoded), UTF_8);
    int separator = decoded.indexOf(':');
    return new String[] {
      URLDecoder.decode(decoded.substring(0, separator), UTF_8),
      URLDecoder.decode(decoded.substring(separator + 1), UTF_8)
    };
  }

  private static void respondJson(HttpExchange exchange, TokenResponse response)
      throws IOException {
    MockHttp.respondJson(exchange, OK, JsonUtils.pojoToJson(response));
  }

  private static void respondError(HttpExchange exchange, int status, String error)
      throws IOException {
    MockHttp.respondJson(exchange, status, JsonUtils.pojoToJson(new ErrorResponse(error, null)));
  }

  private static void respondRaw(HttpExchange exchange, RefreshOutcome.Fail fail)
      throws IOException {
    exchange.getResponseHeaders().set(CONTENT_TYPE, fail.contentType());
    MockHttp.respond(exchange, fail.status(), fail.body());
  }
}
