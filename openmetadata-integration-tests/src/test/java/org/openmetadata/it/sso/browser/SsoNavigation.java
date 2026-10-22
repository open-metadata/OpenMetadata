package org.openmetadata.it.sso.browser;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.it.sso.MockHttp;

/**
 * The redirects one navigation went through. It ends at the first response that is not a redirect,
 * or at a redirect into the single-page app (a URL with a fragment), which a browser would hand to
 * JavaScript instead of requesting.
 */
public record SsoNavigation(List<Hop> hops, URI pendingUrl) {
  public SsoNavigation {
    hops = List.copyOf(hops);
  }

  /** The URL the navigation stopped before requesting; present only for a stopped navigation. */
  public URI requirePendingUrl() {
    if (pendingUrl == null) {
      throw new AssertionError("The navigation did not stop early: " + describe());
    }
    return pendingUrl;
  }

  /** Every hop as {@code status url -> location}, for assertion messages. */
  public String describe() {
    StringBuilder description = new StringBuilder();
    for (Hop hop : hops) {
      description.append(hop.status()).append(' ').append(hop.url());
      if (hop.location() != null) {
        description.append(" -> ").append(hop.location());
      }
      description.append('\n');
    }
    return description.toString();
  }

  public Hop last() {
    return hops.getLast();
  }

  /** The URL the navigation ended on: the final redirect target, or the last URL requested. */
  public URI finalUrl() {
    Hop last = last();
    return last.location() == null ? last.url() : last.location();
  }

  /** A parameter of the final URL's fragment, e.g. {@code id_token} after an SSO login. */
  public Optional<String> fragmentParameter(String name) {
    return Optional.ofNullable(fragmentParameters().get(name));
  }

  public Map<String, String> fragmentParameters() {
    return MockHttp.decode(finalUrl().getRawFragment());
  }

  /** The first hop whose request went to {@code path}, e.g. the server's {@code /callback}. */
  public Optional<Hop> hopTo(String path) {
    return hops.stream().filter(hop -> path.equals(hop.url().getPath())).findFirst();
  }

  /** One request and the response that answered it. */
  public record Hop(URI url, int status, URI location, List<String> setCookies, String body) {
    public Hop {
      setCookies = List.copyOf(setCookies);
    }
  }
}
