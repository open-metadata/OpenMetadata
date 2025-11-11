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

package org.openmetadata.service.security.saml;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.PASSWORD_RESET_TOKEN_EXPIRED;
import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.getErrorMessage;
import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.BadRequestException;
import java.io.BufferedReader;
import java.io.IOException;
import java.time.Instant;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.TokenUtil;
import org.pac4j.core.exception.TechnicalException;

/**
 * This Servlet also known as Assertion Consumer Service URL handles the SamlResponse the IDP send in response to the
 * SamlRequest. After a successful processing it redirects user to the relayState which is the callback setup in the
 * config.
 */
@WebServlet("/api/v1/saml/refresh")
@Slf4j
public class SamlTokenRefreshServlet extends HttpServlet {
  private final TokenRepository tokenRepository;

  public SamlTokenRefreshServlet() {
    this.tokenRepository = Entity.getTokenRepository();
  }

  @Override
  protected void doPost(HttpServletRequest request, HttpServletResponse response) {
    try {
      TokenRefreshRequest tokenRefreshRequest = getTokenRefreshRequest(request);

      if (CommonUtil.nullOrEmpty(tokenRefreshRequest.getRefreshToken())) {
        throw new BadRequestException("Token Cannot be Null or Empty String");
      }
      TokenInterface tokenInterface =
          tokenRepository.findByToken(tokenRefreshRequest.getRefreshToken());
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      User storedUser =
          userRepository.get(
              null, tokenInterface.getUserId(), userRepository.getFieldsWithUserAuth("*"));
      if (storedUser.getIsBot() != null && storedUser.getIsBot()) {
        throw new IllegalArgumentException("User are only allowed to refresh");
      }
      RefreshToken refreshToken =
          validateAndReturnNewRefresh(storedUser.getId(), tokenRefreshRequest);
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  storedUser.getName(),
                  getRoleListFromUser(storedUser),
                  !nullOrEmpty(storedUser.getIsAdmin()) && storedUser.getIsAdmin(),
                  storedUser.getEmail(),
                  3600,
                  false,
                  ServiceTokenType.OM_USER);
      JwtResponse jwtResponse = new JwtResponse();
      jwtResponse.setTokenType("Bearer");
      jwtResponse.setAccessToken(jwtAuthMechanism.getJWTToken());
      jwtResponse.setRefreshToken(refreshToken.getToken().toString());
      jwtResponse.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());

      // Write the response as json
      writeJsonResponse(response, JsonUtils.pojoToJson(jwtResponse));
    } catch (Exception e) {
      getErrorMessage(response, new TechnicalException(e));
    }
  }

  private TokenRefreshRequest getTokenRefreshRequest(HttpServletRequest request)
      throws IOException {
    StringBuilder sb = new StringBuilder();
    BufferedReader reader = request.getReader();
    String line;
    while ((line = reader.readLine()) != null) {
      sb.append(line);
    }

    return JsonUtils.readValue(sb.toString(), TokenRefreshRequest.class);
  }

  public RefreshToken validateAndReturnNewRefresh(
      UUID currentUserId, TokenRefreshRequest tokenRefreshRequest) {
    String requestRefreshToken = tokenRefreshRequest.getRefreshToken();
    RefreshToken storedRefreshToken =
        (RefreshToken) tokenRepository.findByToken(requestRefreshToken);
    if (storedRefreshToken.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new CustomExceptionMessage(
          BAD_REQUEST,
          PASSWORD_RESET_TOKEN_EXPIRED,
          "Expired token. Please login again : " + storedRefreshToken.getToken().toString());
    }
    // just delete the existing token
    tokenRepository.deleteToken(requestRefreshToken);
    // we use rotating refresh token , generate new token
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
    // save Refresh Token in Database
    tokenRepository.insertToken(newRefreshToken);
    return newRefreshToken;
  }
}
