/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.common.utils;

import javax.crypto.Cipher;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.spec.SecretKeySpec;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Base64;
import java.util.Random;

/**
 * Class that uses AEC encryption to encrypt and decrypt plain text
 */
public final class CipherText {
  private static CipherText instance = null;
  private static SecretKeySpec secretKey;

  private CipherText() throws NoSuchAlgorithmException, InvalidKeyException, NoSuchPaddingException {
    // Generate random set of bytes to be used as secret key
    byte[] bytes = new byte[16];
    new Random().nextBytes(bytes);

    // Generate secret key from random bytes
    bytes = MessageDigest.getInstance("SHA-1").digest(bytes);
    secretKey = new SecretKeySpec(Arrays.copyOf(bytes, 16), "AES");
  }

  public static CipherText instance() throws NoSuchPaddingException, NoSuchAlgorithmException, InvalidKeyException {
    if (instance == null) {
      instance = new CipherText();
    }
    return instance;
  }


  public String encrypt(String strToEncrypt) throws GeneralSecurityException, UnsupportedEncodingException {
    if (strToEncrypt == null) {
      return null;
    }
    // Initialize Cipher with the secret key
    Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
    cipher.init(Cipher.ENCRYPT_MODE, secretKey);
    return Base64.getUrlEncoder().encodeToString(cipher.doFinal(strToEncrypt.getBytes("UTF-8")));
  }

  public String decrypt(String strToDecrypt) throws GeneralSecurityException {
    if (strToDecrypt == null) {
      return null;
    }
    Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5PADDING");
    cipher.init(Cipher.DECRYPT_MODE, secretKey);
    return new String(cipher.doFinal(Base64.getUrlDecoder().decode(strToDecrypt)));
  }
}
