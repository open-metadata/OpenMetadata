package org.openmetadata.service.util;

import io.dropwizard.jersey.validation.DropwizardConfiguredValidator;
import java.util.Arrays;
import java.util.Set;
import javax.validation.ConstraintViolation;
import javax.validation.Validation;
import javax.validation.Validator;
import javax.validation.ValidatorFactory;

public class ValidatorUtil {
  public static final Validator VALIDATOR;

  static {
    ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
    VALIDATOR = new DropwizardConfiguredValidator(factory.getValidator());
  }

  private ValidatorUtil() {
    // Private constructor for a utility class
  }

  public static <T> String validate(T entity) {
    Set<ConstraintViolation<T>> violations = VALIDATOR.validate(entity);
    return violations.isEmpty()
        ? null
        : Arrays.toString(
            violations.stream().map(v -> String.format("%s %s", v.getPropertyPath(), v.getMessage())).toArray());
  }
}
