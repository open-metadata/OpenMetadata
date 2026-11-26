package org.openmetadata.service.security;

import com.nimbusds.jose.util.Resource;
import com.nimbusds.oauth2.sdk.ParseException;
import com.nimbusds.oauth2.sdk.http.HTTPRequest;
import com.nimbusds.oauth2.sdk.http.HTTPResponse;
import com.nimbusds.oauth2.sdk.id.Issuer;
import com.nimbusds.openid.connect.sdk.op.OIDCProviderMetadata;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.time.Duration;
import java.util.function.LongSupplier;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.util.OutboundUrlBlockedException;
import org.openmetadata.service.util.OutboundUrlPolicy;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.oidc.config.OidcConfiguration;
import org.pac4j.oidc.metadata.IOidcOpMetadataResolver;
import org.pac4j.oidc.metadata.OidcOpMetadataResolver;

/** The public MCP flow contacts provider endpoints learned from a public-client authority. */
final class PublicOidcConfiguration extends OidcConfiguration {
  static final long DISCOVERY_INTERVAL_NANOS = Duration.ofMinutes(1).toNanos();
  private final AuthProvider provider;
  private final LongSupplier nanoTime;

  PublicOidcConfiguration(AuthProvider provider) {
    this(provider, System::nanoTime);
  }

  PublicOidcConfiguration(AuthProvider provider, LongSupplier nanoTime) {
    this.provider = provider;
    this.nanoTime = nanoTime;
  }

  @Override
  public void configureHttpRequest(HTTPRequest request) {
    super.configureHttpRequest(request);
    OutboundUrlPolicy.getInstance().checkForConnect(request.getURI());
    request.setFollowRedirects(false);
  }

  @Override
  protected IOidcOpMetadataResolver createNewOpMetadataResolver() {
    setResourceRetriever(url -> fetch(URI.create(url.toExternalForm())));
    final var resolver = new ProviderMetadataResolver();
    resolver.init();
    return resolver;
  }

  private final class ProviderMetadataResolver extends OidcOpMetadataResolver {
    private Issuer issuer;
    private long lastAttempt;
    private RuntimeException failure;

    ProviderMetadataResolver() {
      super(PublicOidcConfiguration.this);
      // Our monotonic refresh interval replaces Spring's last-modified HTTP probe.
      setMinimumDelayBetweenChangeDetectionInMilliseconds(0);
    }

    @Override
    public boolean hasChanged() {
      final boolean refreshDue = nanoTime.getAsLong() - lastAttempt >= DISCOVERY_INTERVAL_NANOS;
      if (!refreshDue && failure != null) {
        throw failure;
      }
      return refreshDue;
    }

    @Override
    protected OIDCProviderMetadata retrieveMetadata() {
      lastAttempt = nanoTime.getAsLong();
      try {
        final Resource document = fetch(URI.create(getDiscoveryURI()));
        final var metadata =
            PublicOidcAuthServletHandler.parseDiscovery(document.getContent(), provider);
        if (issuer != null && !issuer.equals(metadata.getIssuer())) {
          throw new TechnicalException("Public OIDC discovery changed the provider issuer");
        }
        issuer = metadata.getIssuer();
        failure = null;
        return metadata;
      } catch (IOException | ParseException e) {
        failure = new TechnicalException("Unable to read the public OIDC provider metadata", e);
        throw failure;
      } catch (RuntimeException e) {
        failure = e;
        throw e;
      }
    }
  }

  private Resource fetch(URI uri) throws IOException {
    final HTTPRequest request = new HTTPRequest(HTTPRequest.Method.GET, uri);
    configureHttpRequest(request);
    final HTTPResponse response = request.send();
    if (!response.indicatesSuccess()) {
      throw new IOException("OIDC provider returned HTTP " + response.getStatusCode());
    }
    return new Resource(response.getBody(), response.getHeaderValue("Content-Type"));
  }

  /** Auth0 opens this URL on each cache miss, after checking the per-key-set fetch budget. */
  static URL checkedKeySetUrl(URL configured) {
    final URI uri = URI.create(configured.toExternalForm());
    try {
      return URL.of(
          uri,
          new URLStreamHandler() {
            @Override
            protected URLConnection openConnection(URL url) throws IOException {
              try {
                OutboundUrlPolicy.getInstance().checkForConnect(uri);
              } catch (OutboundUrlBlockedException denied) {
                // Auth0 reports IO failures per key set, allowing lookup to try the next source.
                throw new IOException("Key-set URL was denied by the outbound policy", denied);
              }
              final HttpURLConnection connection = (HttpURLConnection) configured.openConnection();
              connection.setInstanceFollowRedirects(false);
              return connection;
            }
          });
    } catch (MalformedURLException e) {
      throw new IllegalArgumentException("Invalid key-set URL", e);
    }
  }
}
