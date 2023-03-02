package org.openmetadata.service.secrets.masker;

public class NoopEntityMaskerTest extends TestEntityMasker {

  public NoopEntityMaskerTest() {
    config.setAlwaysMaskPasswordsUI(false);
  }
}
