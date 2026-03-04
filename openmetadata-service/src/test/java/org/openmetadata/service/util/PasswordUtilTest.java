package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

public class PasswordUtilTest {

  @Test
  void testValidatePassword_ValidPassword() {
    assertDoesNotThrow(() -> PasswordUtil.validatePassword("ValidPass1!"));
  }

  @Test
  void testValidatePassword_TooShort() {
    assertThrows(IllegalArgumentException.class, () -> PasswordUtil.validatePassword("Short1!"));
  }

  @Test
  void testValidatePassword_TooLong() {
    String tooLong = "ThisPasswordIsWayTooLongAndExceedsTheMaximumLengthOf56Characters!1";
    assertThrows(IllegalArgumentException.class, () -> PasswordUtil.validatePassword(tooLong));
  }

  @Test
  void testValidatePassword_NoUpperCase() {
    assertThrows(
        IllegalArgumentException.class, () -> PasswordUtil.validatePassword("lowercase1!"));
  }

  @Test
  void testValidatePassword_NoLowerCase() {
    assertThrows(
        IllegalArgumentException.class, () -> PasswordUtil.validatePassword("UPPERCASE1!"));
  }

  @Test
  void testValidatePassword_NoDigit() {
    assertThrows(IllegalArgumentException.class, () -> PasswordUtil.validatePassword("NoDigits!"));
  }

  @Test
  void testValidatePassword_NoSpecialChar() {
    assertThrows(IllegalArgumentException.class, () -> PasswordUtil.validatePassword("NoSpecial1"));
  }

  @Test
  void testValidatePassword_WithWhitespace() {
    assertThrows(
        IllegalArgumentException.class, () -> PasswordUtil.validatePassword("Has Space1!"));
  }

  @Test
  void testGenerateRandomPassword_MeetsLengthRequirement() {
    String password = PasswordUtil.generateRandomPassword();
    assertTrue(password.length() >= 8);
  }

  @Test
  void testGenerateRandomPassword_PassesValidation() {
    String password = PasswordUtil.generateRandomPassword();
    assertDoesNotThrow(() -> PasswordUtil.validatePassword(password));
  }

  @Test
  void testGenerateRandomPassword_IsRandom() {
    String password1 = PasswordUtil.generateRandomPassword();
    String password2 = PasswordUtil.generateRandomPassword();
    assertNotEquals(password1, password2);
  }

  @Test
  void testGenerateRandomPassword_ContainsRequiredCharacterTypes() {
    String password = PasswordUtil.generateRandomPassword();

    boolean hasUpper = password.chars().anyMatch(Character::isUpperCase);
    boolean hasLower = password.chars().anyMatch(Character::isLowerCase);
    boolean hasDigit = password.chars().anyMatch(Character::isDigit);
    boolean hasSpecial = password.chars().anyMatch(c -> "!@#$%^&*()_+".indexOf(c) >= 0);

    assertTrue(hasUpper, "Password should contain uppercase");
    assertTrue(hasLower, "Password should contain lowercase");
    assertTrue(hasDigit, "Password should contain digit");
    assertTrue(hasSpecial, "Password should contain special character");
  }
}
