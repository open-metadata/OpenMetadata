/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.common.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import org.junit.jupiter.api.Test;

public class CipherTextTest {
  @Test
  void encryptDescryptTest() throws GeneralSecurityException, UnsupportedEncodingException {
    CipherText cipherText = CipherText.instance();
    String[] strings = {"test1", "test2", "service.dwh.fact_trip", "random text", "user@domain.com"};
    for (String str : strings) {
      String encryptedStr = cipherText.encrypt(str);
      assertEquals(str, cipherText.decrypt(encryptedStr));
    }
  }
}
