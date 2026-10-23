package org.openmetadata.service.security;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkException;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.RateLimitReachedException;
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
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.jetbrains.annotations.NotNull;

/**
 * An identity provider's signing keys, found by key id in the key sets it publishes.
 *
 * <p>Each download of a key set is cached whole, for a fixed lifetime, and replaces the set's
 * previous download. A key id is looked up in the sets in their configured order, so when two sets
 * publish the same id the first one wins, as when the sets were asked in turn. Downloads are
 * rate limited per URL, because a token with a made-up key id costs one, and caching whole sets
 * means any download that is allowed, even one such a token triggered, also picks up a key the
 * provider has just rotated in. A set whose download fails with no cached copy is skipped by cached
 * lookups until a lookup of an unknown id downloads it again or a key lifetime passes, so an
 * unreachable set does not hold up the requests the cache can answer.
 * ADR:2026-10-20-identity-provider-key-sets-are-fetched-with-timeouts-and-a-rate-limit
 */
public final class IdentityProviderKeys implements JwkProvider {
  private static final int MAX_DISCOVERED_KEY_SETS = 10;
  private static final int MAX_CACHED_KEYS = 1_000;
  private static final int MAX_RESOLVED_KEY_IDS = 100;
  private static final int MAX_FAILED_KEY_SETS = 100;
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
  private final Cache<String, Map<String, Jwk>> downloadedSets;
  private final Cache<String, Boolean> failedDownloads;
  private final LoadingCache<String, Jwk> keysById;

  /**
   * The keys published at {@code keySetUrls}, downloaded with the default timeouts and budget, each
   * download of a set cached for {@code keyLifetime}.
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
    this.downloadedSets = downloadCache(keyLifetime, ticker);
    this.failedDownloads =
        CacheBuilder.newBuilder()
            .maximumSize(MAX_FAILED_KEY_SETS)
            .expireAfterWrite(keyLifetime)
            .ticker(ticker)
            .build();
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
  // A resolved key is reused only briefly: how long a key lives is decided by downloadedSets.
  private LoadingCache<String, Jwk> keyLookup(Ticker ticker) {
    return CacheBuilder.newBuilder()
        .maximumSize(MAX_RESOLVED_KEY_IDS)
        .expireAfterWrite(RESOLVED_KEY_REUSE)
        .ticker(ticker)
        .build(
            new CacheLoader<>() {
              @Override
              public @NotNull Jwk load(@NotNull String keyId) throws JwkException {
                return loadKey(keyId);
              }
            });
  }

  // Bounded by the number of keys across all sets. One segment, so a set of up to the whole bound
  // fits: Guava divides a weight bound between its segments.
  private static Cache<String, Map<String, Jwk>> downloadCache(
      Duration keyLifetime, Ticker ticker) {
    return CacheBuilder.newBuilder()
        .concurrencyLevel(1)
        .maximumWeight(MAX_CACHED_KEYS)
        .weigher((String keySetUrl, Map<String, Jwk> keys) -> Math.max(1, keys.size()))
        .expireAfterWrite(keyLifetime)
        .ticker(ticker)
        .build();
  }

  private Jwk loadKey(String keyId) throws SigningKeyNotFoundException {
    List<KeySetSource> sources = candidateSources();
    Optional<Jwk> cached = cachedKey(sources, keyId);
    return cached.isPresent() ? cached.get() : downloadedKey(sources, keyId);
  }

  // Cached sets answer only up to the first set nothing is known about: an earlier set may publish
  // the id too, and it must be asked before a later set's copy wins.
  private Optional<Jwk> cachedKey(List<KeySetSource> sources, String keyId) {
    return sources.stream()
        .map(this::knownKeys)
        .takeWhile(Objects::nonNull)
        .map(keys -> keys.get(keyId))
        .filter(Objects::nonNull)
        .findFirst();
  }

  // A set's cached download, no keys for a set marked as failed, or null when neither is known and
  // the set must be asked. A failed set is asked again only on a lookup of an unknown id, or once a
  // key lifetime has passed: asking it here would hold the request up for its timeouts.
  private Map<String, Jwk> knownKeys(KeySetSource source) {
    Map<String, Jwk> cached = downloadedSets.getIfPresent(source.url());
    boolean isMarkedFailed = failedDownloads.getIfPresent(source.url()) != null;
    return cached == null && isMarkedFailed ? Map.of() : cached;
  }

  // The sets are asked in order. One whose cached download holds the id answers without a download;
  // any other is downloaded, because an id it lacks may be newly rotated in.
  private Jwk downloadedKey(List<KeySetSource> sources, String keyId)
      throws SigningKeyNotFoundException {
    SigningKeyNotFoundException notFound = new SigningKeyNotFoundException(KEY_NOT_FOUND, null);
    return sources.stream()
        .map(source -> keyIn(source, keyId, notFound))
        .filter(Objects::nonNull)
        .findFirst()
        .orElseThrow(() -> notFound);
  }

  private Jwk keyIn(KeySetSource source, String keyId, SigningKeyNotFoundException notFound) {
    Map<String, Jwk> cached = downloadedSets.getIfPresent(source.url());
    return cached != null && cached.containsKey(keyId)
        ? cached.get(keyId)
        : download(source, notFound).get(keyId);
  }

  // The key is read from the download itself, never back from the bounded cache. A refused or
  // failed download falls back to the set's cached copy, which a concurrent download may fill.
  private Map<String, Jwk> download(KeySetSource source, SigningKeyNotFoundException notFound) {
    Map<String, Jwk> keys;
    try {
      keys = indexById(source.fetchAll());
      downloadedSets.put(source.url(), keys);
      failedDownloads.invalidate(source.url());
    } catch (RateLimitReachedException refused) {
      notFound.addSuppressed(refused);
      keys = cachedOrNone(source);
    } catch (JwkException failed) {
      notFound.addSuppressed(failed);
      markFailedUnlessCached(source);
      keys = cachedOrNone(source);
    }
    return keys;
  }

  // An answer with no keys counts as a failure; a refusal by the budget does not reach here. A set
  // that still has a cached copy keeps answering from it, and a mark would outlive that copy.
  private void markFailedUnlessCached(KeySetSource source) {
    if (downloadedSets.getIfPresent(source.url()) == null) {
      failedDownloads.put(source.url(), Boolean.TRUE);
    }
  }

  private Map<String, Jwk> cachedOrNone(KeySetSource source) {
    return Objects.requireNonNullElse(downloadedSets.getIfPresent(source.url()), Map.of());
  }

  private static Map<String, Jwk> indexById(List<Jwk> keySet) {
    return keySet.stream()
        .filter(key -> key.getId() != null)
        .collect(
            Collectors.toUnmodifiableMap(
                Jwk::getId, Function.identity(), (first, repeated) -> first));
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
