package org.openmetadata.service.security.session;

import lombok.Builder;

/**
 * What a pending login session carries from the start of a login to the identity provider's
 * callback.
 *
 * @param redirectUri where the browser is sent once the login completes
 * @param idpRedirectUri the {@code redirect_uri} sent to the identity provider, recorded only when it
 *     differs from the configured primary callback URL — the token request must repeat it exactly
 */
@Builder
public record PendingLoginState(
    String redirectUri, String idpRedirectUri, String state, String nonce, String pkceVerifier) {}
