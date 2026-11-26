# A refresh ends sessions issued by a provider that is no longer configured

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial) · v2 2026-11-20 (push-feed sockets follow the rule)
- **Deciders:** Mohit Yadav
- **Guard:** `SessionServiceTest` (`acquireRefreshLease_revokesASessionIssuedByAProviderNoLongerConfigured`,
  `acquireRefreshLease_leasesANativePasswordSessionUnderEitherNativeProviderName`);
  `SessionProvidersTest`; `BasicAuthServletHandlerTest` and `LdapAuthServletHandlerTest`
  (`handleRefresh_revokedSession_answersSessionRevoked`); `SsoTokenRenewalIT` (RN-16);
  `SocketAddressFilterTest` (`cookieHandshakeIsRejectedWhenItsSessionsProviderIsNoLongerConfigured`,
  `handshakeIsStampedWithTheProviderOfTheFilterThatValidatedIt`,
  `validatingProviderNamesTheProviderTheFilterValidatesUnder`);
  `WebSocketManagerTest` (`disconnectInactiveSessions_closesSocketsWhoseSessionProviderIsNoLongerConfigured`,
  `disconnectInactiveSessions_keepsSocketsWhileAReloadHasNotAppliedItsProvider`,
  `disconnectAll_closesSessionBoundAndSessionlessSockets`,
  `onConnection_closesASocketValidatedUnderTheOldProviderThatRegistersAfterTheSwitch`,
  `onConnection_keepsASocketThatRegisteredDuringAReloadThatFailed`); `OpenMetadataApplicationAuthReloadTest`
  (`closeSocketsOnProviderSwitch_closesOnlyOnAProviderSwitch`,
  `pushFeedReloadListener_closesSocketsOnlyWhenAReloadChangesTheProvider`,
  `buildPushFeedSockets_sweepsAgainstTheProviderTheHandshakeFilterValidatesUnder`); `SessionMultiNodeIT`
  (`pushFeedHandshakeRejectsASessionIssuedByAProviderNoLongerConfigured`)
- **Related:** EPIC #34298

## Context
`JwtFilter` already rejects a session-bound token whose session was issued by a provider other than
the configured one ("Session was issued by a provider that is no longer configured."). The refresh
endpoint did not apply the same rule. After an administrator switched provider, the new provider's
handler leased the old session, rotated its refresh token and minted a token that every API call
then refused. The browser answered each 401 by refreshing again, in a loop.

## Decision
- `SessionService.acquireRefreshLease`, which every provider's refresh goes through, revokes a
  session whose provider is not the configured one. Every provider's refresh then answers 401
  `Session revoked`, which the single-page app signs out on. Any other 401 makes a tab that signed
  in through SSO re-authenticate silently, at a login endpoint the new provider may not serve.
- Whether two providers are the same is decided in one place, `SessionProviders.isSameProvider`,
  shared with `JwtFilter`. `basic` and `openmetadata` name the same native-password authenticator,
  so renaming one to the other ends no session.

## Consequences
Switching provider signs users out of their old sessions at their next refresh, instead of leaving
them looping. Sessions survive a switch only between the two native-password names.

Pods that share sessions through the database learn of a switch at their next settings poll, up to
10 seconds later. In that window a refresh that lands on a pod still on the old configuration ends
a session the new provider has just issued, and that user signs in again. Comparing the session with
the stored setting before revoking would close the window.

## Amendment

v2 (2026-11-20): push-feed sockets follow the same rule (#36608). A security reload that changes
the configured provider closes every socket on the server that applies it, with or without a
session: a socket opened with a provider token has no session to re-check. A rename between `basic`
and `openmetadata` closes nothing. The handshake rejects a session issued by a provider that is no
longer configured (401), and the socket sweep closes such sockets at its next pass. None of these
revoke the session, as `JwtFilter` does not, so a pod still on the old configuration cannot end
sessions the new provider issued. `SessionProviders.isFromAnotherProvider` is the one predicate.
`JwtFilter` passes its own configured provider; `SessionService.isFromAnotherProvider` passes this
server's current one for refresh and the handshake; the sweep passes the provider the push-feed
handshake filter validates under; and the reload compares the previous provider with the new one.

A socket registers one round trip after its handshake, when the client's CONNECT arrives, so a
handshake validated just before a switch can register after the reload has closed every socket.
The handshake therefore stamps the provider of the filter that validated it, and registration
compares that stamp with the provider the filter validates under now, closing the socket on a
mismatch. The socket is registered before the comparison and the reload rebuilds the filter before
it closes sockets, so whichever runs second catches it.

Registration and the sweep read the filter, not the published configuration or `SessionService`'s.
A reload publishes the new configuration and hands it to `SessionService` before it initializes the
new authenticator, and rolls everything back if that fails (an unreachable LDAP server, say). The
filter is rebuilt only by the reload listener, which runs only for a reload that succeeded, so a
failed reload closes no socket; the UI does not reconnect after a server close.
