package org.openmetadata.catalog.security;

import com.google.common.base.Strings;
import org.openmetadata.catalog.security.auth.CatalogSecurityContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.UriInfo;
import java.lang.invoke.MethodHandles;

public class OAuthProxyAuthFilter implements ContainerRequestFilter  {
  private static final Logger LOG = LoggerFactory.getLogger(MethodHandles.lookup().lookupClass());
  @Context
  private UriInfo uriInfo;
  private String authEmailHeader;
  private String sourceHeader;
  private static final String HEALTH_END_POINT = "health";

  @SuppressWarnings("unused")
  private OAuthProxyAuthFilter() {}

  public OAuthProxyAuthFilter(AuthenticationConfiguration authenticationConfiguration) {
    authEmailHeader = authenticationConfiguration.getAuthEmailHeader();
    sourceHeader = authenticationConfiguration.getSourceHeader();
  }


  public void filter(ContainerRequestContext containerRequestContext) {
    if (isHealthEndpoint(containerRequestContext)) {
      LOG.debug("Caller is health-agent, no authorization needed.");
      return;
    }
    MultivaluedMap<String, String> headers = containerRequestContext.getHeaders();
    String principal = null;
    principal = extractAuthorizedUserName(headers);
    LOG.debug("AuthorizedUserName:{}", principal);
    principal = extractAuthorizedUserName(headers);
    CatalogPrincipal catalogPrincipal = new CatalogPrincipal(principal);
    String scheme = containerRequestContext.getUriInfo().getRequestUri().getScheme();
    CatalogSecurityContext catalogSecurityContext =
        new CatalogSecurityContext(catalogPrincipal, scheme, CatalogSecurityContext.OPENID_AUTH);
    LOG.debug("SecurityContext {}", catalogSecurityContext);
    containerRequestContext.setSecurityContext(catalogSecurityContext);
  }

  protected boolean isHealthEndpoint(ContainerRequestContext containerRequestContext) {
    UriInfo uriInfo = containerRequestContext.getUriInfo();
    if (uriInfo.getPath().equalsIgnoreCase(HEALTH_END_POINT)) {
      return true;
    }
    return false;
  }

  protected String extractAuthorizedUserName(MultivaluedMap<String, String> headers) {
    LOG.debug("Request Headers:{}", headers);

    String openIdEmail = headers.getFirst(authEmailHeader);
    if (Strings.isNullOrEmpty(openIdEmail)) {
      throw new AuthenticationException("Not authorized");
    }
    String[] openIdEmailParts = openIdEmail.split("@");
    return openIdEmailParts[0];
  }

  protected String extractAuthorizedEmailAddress(MultivaluedMap<String, String> headers) {
    LOG.debug("Request Headers:{}", headers);

    String openIdEmail = headers.getFirst(authEmailHeader);
    if (Strings.isNullOrEmpty(openIdEmail)) {
      throw new AuthenticationException("Not authorized");
    }
    return openIdEmail;
  }
}
