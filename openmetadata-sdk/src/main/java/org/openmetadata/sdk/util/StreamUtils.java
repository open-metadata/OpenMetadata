package org.openmetadata.sdk.util;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.Charset;
import lombok.Cleanup;

import static java.util.Objects.requireNonNull;

public final class StreamUtils {
  private static final int DEFAULT_BUF_SIZE = 1024;

  /**
   * Reads the provided stream until the end and returns a string encoded with the provided charset.
   *
   * @param stream the stream to read
   * @param charset the charset to use
   * @return a string with the contents of the input stream
   * @throws NullPointerException if {@code stream} or {@code charset} is {@code null}
   * @throws IOException if an I/O error occurs
   */
  public static String readToEnd(InputStream stream, Charset charset) throws IOException {
    requireNonNull(stream);
    requireNonNull(charset);

    final StringBuilder sb = new StringBuilder();
    final char[] buffer = new char[DEFAULT_BUF_SIZE];
    @Cleanup final Reader in = new InputStreamReader(stream, charset);
    int charsRead = 0;
    while ((charsRead = in.read(buffer, 0, buffer.length)) > 0) {
      sb.append(buffer, 0, charsRead);
    }
    return sb.toString();
  }
}
