package org.openmetadata.common.utils;

import org.junit.jupiter.api.Test;

import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class CipherTextTest {
  @Test
  public void encryptDescryptTest() throws GeneralSecurityException, UnsupportedEncodingException {
    CipherText cipherText = CipherText.instance();
    String[] strings = {"test1", "test2", "service.dwh.fact_trip", "random text", "user@domain.com"};
    for (String str : strings) {
      String encryptedStr = cipherText.encrypt(str);
      assertEquals(str, cipherText.decrypt(encryptedStr));
    }
  }
}
