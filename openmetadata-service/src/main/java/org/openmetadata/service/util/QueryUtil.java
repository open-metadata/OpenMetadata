package org.openmetadata.service.util;

import java.security.MessageDigest;
import lombok.SneakyThrows;
import org.apache.commons.codec.binary.Hex;

public class QueryUtil {

  @SneakyThrows
  public static String getCheckSum(String input) {
    byte[] checksum = MessageDigest.getInstance("MD5").digest(input.getBytes());
    return Hex.encodeHexString(checksum);
  }
}
