package org.openmetadata.service.util;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Arrays;
import java.util.Set;
import org.apache.commons.csv.CSVRecord;

public class ValidatorUtil {
  public static final Validator VALIDATOR;
  public static final String NAME_EMAIL_VOILATION =
      "Name should be equal to the email prefix (before `@`)";

  static {
    ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
    VALIDATOR = factory.getValidator();
  }

  private ValidatorUtil() {
    // Private constructor for a utility class
  }

  public static <T> String validate(T entity) {
    Set<ConstraintViolation<T>> violations = VALIDATOR.validate(entity);
    return violations.isEmpty()
        ? null
        : Arrays.toString(
            violations.stream()
                .map(v -> String.format("%s %s", v.getPropertyPath(), v.getMessage()))
                .toArray());
  }

  public static String validateUserNameWithEmailPrefix(CSVRecord csvRecord) {
    // UserImportCsv : name(0), displayName(1), description(2), email(3), timezone(4), isAdmin(5)

    String name = csvRecord.get(0);
    String email = csvRecord.get(3);

    if (name != null && !name.isEmpty() && email != null && !email.isEmpty()) {
      String emailPrefix = "";
      int atIndex = email.indexOf('@');
      if (atIndex != -1) {
        emailPrefix = email.substring(0, atIndex);
      }

      return name.equals(emailPrefix) ? "" : NAME_EMAIL_VOILATION;
    } else {
      // Either name or email (or both) are null or empty, so validation cannot be performed
      // JSON schema validate method would have managed this case.
      return "";
    }
  }
}
