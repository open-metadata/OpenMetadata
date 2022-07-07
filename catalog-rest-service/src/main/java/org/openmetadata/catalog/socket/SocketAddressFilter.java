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

package org.openmetadata.catalog.socket;

import com.auth0.jwt.interfaces.Claim;
import com.auth0.jwt.interfaces.DecodedJWT;
import io.socket.engineio.server.utils.ParseQS;
import java.io.IOException;
import java.util.Map;
import java.util.TreeMap;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import org.openmetadata.catalog.security.AuthenticationConfiguration;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import org.openmetadata.catalog.security.JwtFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SocketAddressFilter implements Filter {
  private static final Logger LOG = LoggerFactory.getLogger(SocketAddressFilter.class);
  private JwtFilter jwtFilter;

  private final boolean enableSecureSocketConnection;

  public SocketAddressFilter(
      AuthenticationConfiguration authenticationConfiguration, AuthorizerConfiguration authorizerConf) {
    enableSecureSocketConnection = authorizerConf.getEnableSecureSocketConnection();
    if (enableSecureSocketConnection) {
      jwtFilter = new JwtFilter(authenticationConfiguration, authorizerConf);
    }
  }

  public SocketAddressFilter() {
    enableSecureSocketConnection = false;
  }

  @Override
  public void destroy() {}

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    HttpServletRequest httpServletRequest = (HttpServletRequest) request;
    Map<String, String> query = ParseQS.decode(httpServletRequest.getQueryString());

    HeaderRequestWrapper requestWrapper = new HeaderRequestWrapper(httpServletRequest);
    requestWrapper.addHeader("RemoteAddress", httpServletRequest.getRemoteAddr());
    requestWrapper.addHeader("UserId", query.get("userId"));

    if (enableSecureSocketConnection) {
      String tokenWithType = httpServletRequest.getHeader("Authorization");
      requestWrapper.addHeader("Authorization", tokenWithType);
      String token = JwtFilter.extractToken(tokenWithType);
      // validate token
      DecodedJWT jwt = jwtFilter.validateAndReturnDecodedJwtToken(token);
      // validate Domain and Username
      Map<String, Claim> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
      claims.putAll(jwt.getClaims());
      jwtFilter.validateAndReturnUsername(claims);
    }
    // Goes to default servlet.
    chain.doFilter(requestWrapper, response);
  }

  @Override
  public void init(FilterConfig filterConfig) throws ServletException {}
}
