package org.openmetadata.service.security;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkException;
import com.auth0.jwk.RateLimitReachedException;
import com.auth0.jwk.UrlJwkProvider;
import com.google.common.base.Ticker;
import java.net.URL;
import java.util.List;

/** One key-set URL: downloaded whole, with timeouts, no more often than its budget allows. */
final class KeySetSource {
  private final String url;
  private final UrlJwkProvider keySet;
  private final FetchBudget budget;

  KeySetSource(URL url, KeySetFetchPolicy policy, Ticker ticker) {
    this.url = url.toExternalForm();
    this.keySet =
        new UrlJwkProvider(
            url, (int) policy.connectTimeout().toMillis(), (int) policy.readTimeout().toMillis());
    this.budget = new FetchBudget(policy.fetchBurst(), policy.refillInterval(), ticker::read);
  }

  String url() {
    return url;
  }

  /** Every key the set publishes; {@link RateLimitReachedException} when the budget is spent. */
  List<Jwk> fetchAll() throws JwkException {
    if (!budget.tryAcquire()) {
      throw new RateLimitReachedException(budget.millisUntilNextFetch());
    }
    return keySet.getAll();
  }
}
