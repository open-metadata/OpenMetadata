package org.openmetadata.service.secrets.masker;

public class NoopEntityMaskerTest extends TestEntityMasker {

  public NoopEntityMaskerTest() {
    CONFIG.setMaskPasswordsAPI(false);
  }
}
