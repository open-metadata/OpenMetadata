package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ImageList;
import org.openmetadata.schema.type.Profile;

/**
 * Keeps how an account is presented, its display name and picture, in step with what the identity
 * provider asserts at sign-in. Only values the provider actually sent are applied: a claim the
 * token leaves out never clears what the account already has.
 */
@Slf4j
public final class UserProfileClaims {
  private static final String PICTURE_CLAIM = "picture";
  private static final Set<String> WEB_SCHEMES = Set.of("http", "https");

  private UserProfileClaims() {}

  /**
   * The standard OIDC {@code picture} claim, when it is an absolute http(s) address. The address
   * becomes an image source in the browser, so anything else is dropped rather than stored.
   */
  public static URI pictureFrom(Map<String, ?> claims) {
    String claim = SecurityUtil.getClaimOrObject(claims.get(PICTURE_CLAIM));
    return nullOrEmpty(claim) ? null : parseWebAddress(claim.trim());
  }

  /**
   * Points the account's picture at the provider's. A new picture replaces every stored size, since
   * sizes derived from the previous picture would otherwise keep showing it.
   *
   * @return whether the account changed
   */
  public static boolean syncPicture(User user, URI picture) {
    boolean changes = picture != null && !picture.equals(currentPicture(user));
    if (changes) {
      Profile profile = Optional.ofNullable(user.getProfile()).orElseGet(Profile::new);
      user.setProfile(profile.withImages(new ImageList().withImage(picture)));
    }
    return changes;
  }

  /**
   * Fills the display name from the provider when the account has none of its own. A name chosen in
   * OpenMetadata is kept.
   *
   * @return whether the account changed
   */
  public static boolean fillDisplayName(User user, String displayName) {
    boolean fills =
        !nullOrEmpty(displayName)
            && !displayName.isBlank()
            && lacksOwnDisplayName(user)
            && !displayName.equals(user.getDisplayName());
    if (fills) {
      user.setDisplayName(displayName);
    }
    return fills;
  }

  /**
   * A display name that only repeats the login name says nothing the name does not. The browser
   * wrote exactly that on sign-in while the provider's name was being dropped.
   */
  private static boolean lacksOwnDisplayName(User user) {
    String current = user.getDisplayName();
    return nullOrEmpty(current) || current.equals(user.getName());
  }

  private static URI currentPicture(User user) {
    return Optional.ofNullable(user.getProfile())
        .map(Profile::getImages)
        .map(ImageList::getImage)
        .orElse(null);
  }

  private static URI parseWebAddress(String claim) {
    URI address = toUri(claim);
    return address != null && isWebAddress(address) ? address : null;
  }

  private static URI toUri(String claim) {
    try {
      return new URI(claim);
    } catch (URISyntaxException e) {
      LOG.debug("Ignoring a picture claim that is not a valid URI: {}", e.getReason());
      return null;
    }
  }

  private static boolean isWebAddress(URI address) {
    return address.isAbsolute()
        && address.getHost() != null
        && WEB_SCHEMES.contains(address.getScheme().toLowerCase(Locale.ROOT));
  }
}
