package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ImageList;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;

@Execution(ExecutionMode.CONCURRENT)
class UserProfileClaimsTest {

  private static final URI PICTURE =
      URI.create("https://lh3.googleusercontent.com/a/ACg8ocJ=s96-c");

  @Test
  void pictureFrom_readsTheStandardPictureClaim() {
    assertEquals(PICTURE, UserProfileClaims.pictureFrom(Map.of("picture", PICTURE.toString())));
  }

  @Test
  void pictureFrom_isNullWhenTheTokenCarriesNoPicture() {
    assertNull(UserProfileClaims.pictureFrom(Map.of("email", "jdoe@example.com")));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "",
        "javascript:alert(1)",
        "data:image/png;base64,iVBORw0KGgo=",
        "file:///etc/passwd",
        "/avatars/jdoe.png",
        "not a picture"
      })
  void pictureFrom_ignoresAnythingButAnAbsoluteWebAddress(String claim) {
    assertNull(UserProfileClaims.pictureFrom(Map.of("picture", claim)));
  }

  @Test
  void pictureFrom_ignoresAPictureClaimThatIsNotText() {
    assertNull(UserProfileClaims.pictureFrom(Map.of("picture", 42)));
  }

  @Test
  void syncPicture_setsThePictureOnAnAccountWithoutOne() {
    User user = new User().withName("jdoe");

    assertTrue(UserProfileClaims.syncPicture(user, PICTURE));
    assertEquals(PICTURE, user.getProfile().getImages().getImage());
  }

  @Test
  void syncPicture_dropsEverySizeOfThePreviousPicture() {
    URI previous = URI.create("https://lh3.googleusercontent.com/a/old=s96-c");
    User user =
        new User()
            .withName("jdoe")
            .withProfile(
                new Profile()
                    .withImages(
                        new ImageList()
                            .withImage(previous)
                            .withImage512(
                                URI.create("https://lh3.googleusercontent.com/a/old=s512-c"))));

    assertTrue(UserProfileClaims.syncPicture(user, PICTURE));
    assertEquals(new ImageList().withImage(PICTURE), user.getProfile().getImages());
  }

  @Test
  void syncPicture_keepsTheRestOfTheProfile() {
    SubscriptionConfig subscription =
        new SubscriptionConfig()
            .withSlack(new Webhook().withEndpoint(URI.create("https://hooks.slack.test/jdoe")));
    User user =
        new User().withName("jdoe").withProfile(new Profile().withSubscription(subscription));

    UserProfileClaims.syncPicture(user, PICTURE);

    assertEquals(subscription, user.getProfile().getSubscription());
  }

  @Test
  void syncPicture_leavesTheCurrentPictureAndItsSizesAlone() {
    ImageList current =
        new ImageList()
            .withImage(PICTURE)
            .withImage512(URI.create("https://lh3.googleusercontent.com/a/ACg8ocJ=s512-c"));
    User user = new User().withName("jdoe").withProfile(new Profile().withImages(current));

    assertFalse(UserProfileClaims.syncPicture(user, PICTURE));
    assertEquals(current, user.getProfile().getImages());
  }

  @Test
  void syncPicture_keepsTheStoredPictureWhenTheTokenHasNone() {
    User user =
        new User()
            .withName("jdoe")
            .withProfile(new Profile().withImages(new ImageList().withImage(PICTURE)));

    assertFalse(UserProfileClaims.syncPicture(user, null));
    assertEquals(PICTURE, user.getProfile().getImages().getImage());
  }

  @Test
  void fillDisplayName_setsTheProviderNameOnAnAccountWithoutOne() {
    User user = new User().withName("jdoe");

    assertTrue(UserProfileClaims.fillDisplayName(user, "Jane Doe"));
    assertEquals("Jane Doe", user.getDisplayName());
  }

  @Test
  void fillDisplayName_replacesADisplayNameThatOnlyRepeatsTheLoginName() {
    User user = new User().withName("jdoe").withDisplayName("jdoe");

    assertTrue(UserProfileClaims.fillDisplayName(user, "Jane Doe"));
    assertEquals("Jane Doe", user.getDisplayName());
  }

  @Test
  void fillDisplayName_keepsANameChosenInOpenMetadata() {
    User user = new User().withName("jdoe").withDisplayName("JD");

    assertFalse(UserProfileClaims.fillDisplayName(user, "Jane Doe"));
    assertEquals("JD", user.getDisplayName());
  }

  @Test
  void fillDisplayName_reportsNoChangeWhenTheProviderNameIsTheLoginName() {
    User user = new User().withName("jdoe").withDisplayName("jdoe");

    assertFalse(UserProfileClaims.fillDisplayName(user, "jdoe"));
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"   "})
  void fillDisplayName_ignoresAMissingProviderName(String providerName) {
    User user = new User().withName("jdoe");

    assertFalse(UserProfileClaims.fillDisplayName(user, providerName));
    assertNull(user.getDisplayName());
  }
}
