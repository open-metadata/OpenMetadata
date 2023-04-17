package org.openmetadata.service.secrets.masker;

public class PasswordEntityMaskerTest extends TestEntityMasker {
  public PasswordEntityMaskerTest() {
    CONFIG.setMaskPasswordsAPI(true);
  }

  @Override
  protected String getMaskedPassword() {
    return PasswordEntityMasker.PASSWORD_MASK;
  }
}
