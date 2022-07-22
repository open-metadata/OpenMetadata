package org.openmetadata.catalog.validators;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import javax.validation.Constraint;
import javax.validation.Payload;

@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = AirflowConfigValidationImpl.class)
public @interface AirflowConfigValidation {
  String message() default "This will be replaced by the validation";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};
}
