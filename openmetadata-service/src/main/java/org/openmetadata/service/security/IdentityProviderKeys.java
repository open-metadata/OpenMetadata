package org.openmetadata.service.security;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkException;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.SigningKeyNotFoundException;
import com.google.common.base.Ticker;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.net.URL;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.jetbrains.annotations.NotNull;

/**
 * An identity provider's signing keys, found by key id in the key sets it publishes.
 *
 * <p>A fetch caches every key of the set it downloads, not only the one asked for, and keeps each
 * key for its lifetime after the last fetch that carried it. Fetches are rate limited per URL, because a
 * token with a made-up key id costs a fetch, and caching whole sets means any fetch that is
 * allowed, even one such a token triggered, also picks up a key the provider has just rotated in.
 * ADR:2026-10-20-identity-provider-key-sets-are-fetched-with-timeouts-and-a-rate-limit
 */
public final class IdentityProviderKeys implements JwkProvider {
  private static final int MAX_DISCOVERED_KEY_SETS = 10;
  private static final int MAX_CACHED_KEYS = 100;
  private static final Duration RESOLVED_KEY_REUSE = Duration.ofMinutes(1);
  private static final String KEY_NOT_FOUND =
      "JWT Token keyID doesn't match the configured keyID. This usually happens if you didn't"
          + " configure proper publicKeyUrls under authentication configuration.";

  private final KeySetFetchPolicy fetchPolicy;
  private final Ticker ticker;
  private final List<KeySetSource> configuredSources;
  private final Set<String> configuredUrls;
  private final Supplier<List<URL>> discoveredKeySetUrls;
  private final Cache<String, KeySetSource> discoveredSources =
      CacheBuilder.newBuilder().maximumSize(MAX_DISCOVERED_KEY_SETS).build();
  private final Cache<String, Jwk> fetchedKeys;
  private final LoadingCache<String, Jwk> keysById;

  /**
   * The keys published at {@code keySetUrls}, fetched with the default timeouts and budget, each
   * kept for {@code keyLifetime} after the last fetch that carried it.
   */
  public static IdentityProviderKeys forUrls(List<URL> keySetUrls, Duration keyLifetime) {
    return new IdentityProviderKeys(
        keySetUrls, List::of, KeySetFetchPolicy.DEFAULT, keyLifetime, Ticker.systemTicker());
  }

  /**
   * {@code discoveredKeySetUrls} adds key sets known only at lookup time, such as the {@code
   * jwks_uri} of the provider's discovery document, to the configured {@code keySetUrls}.
   */
  IdentityProviderKeys(
      List<URL> keySetUrls,
      Supplier<List<URL>> discoveredKeySetUrls,
      KeySetFetchPolicy fetchPolicy,
      Duration keyLifetime,
      Ticker ticker) {
    this.fetchPolicy = fetchPolicy;
    this.ticker = ticker;
    this.configuredSources =
        keySetUrls.stream().map(url -> new KeySetSource(url, fetchPolicy, ticker)).toList();
    this.configuredUrls =
        keySetUrls.stream().map(URL::toExternalForm).collect(Collectors.toUnmodifiableSet());
    this.discoveredKeySetUrls = discoveredKeySetUrls;
    this.fetchedKeys = keyCache(keyLifetime, ticker).build();
    this.keysById = keyLookup(ticker);
  }

  @Override
  public Jwk get(String keyId) throws JwkException {
    try {
      return keysById.get(requireKeyId(keyId));
    } catch (ExecutionException | UncheckedExecutionException e) {
      throw asJwkException(e.getCause());
    }
  }

  // A token that names no key cannot select one, and the cache would turn the null into a server
  // error instead of a refusal.
  private static String requireKeyId(String keyId) throws SigningKeyNotFoundException {
    if (keyId == null) {
      throw new SigningKeyNotFoundException("Token names no signing key", null);
    }
    return keyId;
  }

  private static JwkException asJwkException(Throwable loadFailure) {
    return loadFailure instanceof JwkException jwkException
        ? jwkException
        : new JwkException("Could not look up the signing key", loadFailure);
  }

  // One load per key id at a time, so the requests that arrive with a newly rotated key share it.
  // A resolved key is reused only briefly: its lifetime is counted in fetchedKeys alone.
  private LoadingCache<String, Jwk> keyLookup(Ticker ticker) {
    return keyCache(RESOLVED_KEY_REUSE, ticker)
        .build(
            new CacheLoader<>() {
              @Override
              public @NotNull Jwk load(@NotNull String keyId) throws JwkException {
                return loadKey(keyId);
              }
            });
  }

  private static CacheBuilder<Object, Object> keyCache(Duration lifetime, Ticker ticker) {
    return CacheBuilder.newBuilder()
        .maximumSize(MAX_CACHED_KEYS)
        .expireAfterWrite(lifetime)
        .ticker(ticker);
  }

  private Jwk loadKey(String keyId) throws SigningKeyNotFoundException {
    Jwk fetched = fetchedKeys.getIfPresent(keyId);
    return fetched != null ? fetched : fetchKey(keyId);
  }

  private Jwk fetchKey(String keyId) throws SigningKeyNotFoundException {
    SigningKeyNotFoundException notFound = new SigningKeyNotFoundException(KEY_NOT_FOUND, null);
    return candidateSources().stream()
        .map(source -> fetchFrom(source, keyId, notFound))
        .filter(Objects::nonNull)
        .findFirst()
        .orElseThrow(() -> notFound);
  }

  // A refused or failed fetch still checks the cache: a concurrent fetch may have filled it.
  private Jwk fetchFrom(KeySetSource source, String keyId, SigningKeyNotFoundException notFound) {
    try {
      source.fetchAll().stream()
          .filter(key -> key.getId() != null)
          .forEach(key -> fetchedKeys.put(key.getId(), key));
    } catch (JwkException e) {
      notFound.addSuppressed(e);
    }
    return fetchedKeys.getIfPresent(keyId);
  }

  private List<KeySetSource> candidateSources() {
    List<KeySetSource> candidates = new ArrayList<>(configuredSources);
    discoveredKeySetUrls.get().stream()
        .filter(url -> !configuredUrls.contains(url.toExternalForm()))
        .map(this::discoveredSource)
        .forEach(candidates::add);
    return candidates;
  }

  // A discovered key set keeps one source, so its fetch budget holds across lookups.
  private KeySetSource discoveredSource(URL url) {
    return discoveredSources
        .asMap()
        .computeIfAbsent(
            url.toExternalForm(), unused -> new KeySetSource(url, fetchPolicy, ticker));
  }
}
