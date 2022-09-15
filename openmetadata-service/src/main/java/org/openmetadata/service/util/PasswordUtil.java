package org.openmetadata.service.util;

import java.util.ArrayList;
import java.util.List;
import org.passay.CharacterData;
import org.passay.CharacterRule;
import org.passay.EnglishCharacterData;
import org.passay.LengthRule;
import org.passay.PasswordData;
import org.passay.PasswordGenerator;
import org.passay.PasswordValidator;
import org.passay.Rule;
import org.passay.RuleResult;
import org.passay.WhitespaceRule;

public class PasswordUtil {

  private static PasswordValidator validator;

  static {
    List<Rule> rules = new ArrayList<>();
    // 8 and 16 characters
    rules.add(new LengthRule(8, 16));
    // No whitespace allowed
    rules.add(new WhitespaceRule());
    // At least one Upper-case character
    rules.add(new CharacterRule(EnglishCharacterData.UpperCase, 1));
    // At least one Lower-case character
    rules.add(new CharacterRule(EnglishCharacterData.LowerCase, 1));
    // Rule 3.c: At least one digit
    rules.add(new CharacterRule(EnglishCharacterData.Digit, 1));
    // Rule 3.d: At least one special character
    rules.add(new CharacterRule(EnglishCharacterData.Special, 1));
    validator = new PasswordValidator(rules);
  }

  public static void validatePassword(String pwd) {
    PasswordData password = new PasswordData(pwd);
    RuleResult result = validator.validate(password);
    if (!result.isValid()) {
      throw new RuntimeException(
          "Password must be of minimum 8 characters, with one special, one Upper, one lower case character, and one Digit.");
    }
  }

  public static String generateRandomPassword() {
    PasswordGenerator gen = new PasswordGenerator();
    CharacterData lowerCaseChars = EnglishCharacterData.LowerCase;
    CharacterRule lowerCaseRule = new CharacterRule(lowerCaseChars);
    lowerCaseRule.setNumberOfCharacters(2);

    CharacterData upperCaseChars = EnglishCharacterData.UpperCase;
    CharacterRule upperCaseRule = new CharacterRule(upperCaseChars);
    upperCaseRule.setNumberOfCharacters(2);

    CharacterData digitChars = EnglishCharacterData.Digit;
    CharacterRule digitRule = new CharacterRule(digitChars);
    digitRule.setNumberOfCharacters(2);

    CharacterData specialChars =
        new CharacterData() {
          public String getErrorCode() {
            return "Invalid Special Char";
          }

          public String getCharacters() {
            return "!@#$%^&*()_+";
          }
        };
    CharacterRule splCharRule = new CharacterRule(specialChars);
    splCharRule.setNumberOfCharacters(2);

    String password = gen.generatePassword(8, splCharRule, lowerCaseRule, upperCaseRule, digitRule);
    return password;
  }
}
