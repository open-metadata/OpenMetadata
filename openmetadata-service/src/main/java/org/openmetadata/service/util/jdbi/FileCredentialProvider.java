package org.openmetadata.service.util.jdbi;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.LongSupplier;

/**
 * Reads a database password from a file and re-reads it on a short TTL so an externally-rotated
 * value (for example a token an external process writes into a mounted Kubernetes Secret) is picked
 * up by new connections without restarting the service.
 */
public class FileCredentialProvider implements DatabaseAuthenticationProvider {

  static final long DEFAULT_TTL_NANOS = TimeUnit.SECONDS.toNanos(30);

  private final Path path;
  private final long ttlNanos;
  private final LongSupplier clock;
  private final AtomicReference<CachedToken> cache = new AtomicReference<>();

  private record CachedToken(String token, long readAtNanos) {}

  public FileCredentialProvider(String filePath) {
    this(filePath, DEFAULT_TTL_NANOS, System::nanoTime);
  }

  FileCredentialProvider(String filePath, long ttlNanos, LongSupplier clock) {
    if (nullOrEmpty(filePath)) {
      throw new DatabaseAuthenticationProviderException("Database password file path is empty");
    }
    this.path = Paths.get(filePath);
    this.ttlNanos = ttlNanos;
    this.clock = clock;
  }

  @Override
  public String authenticate(String jdbcUrl, String username, String password) {
    CachedToken current = cache.get();
    long now = clock.getAsLong();
    if (current == null || now - current.readAtNanos() >= ttlNanos) {
      current = refresh(now);
    }
    return current.token();
  }

  /** Forces the next {@link #authenticate} to re-read the file; used after an auth failure. */
  public void invalidate() {
    cache.set(null);
  }

  private synchronized CachedToken refresh(long now) {
    CachedToken result = cache.get();
    if (result == null || now - result.readAtNanos() >= ttlNanos) {
      result = new CachedToken(readFile(), now);
      cache.set(result);
    }
    return result;
  }

  private String readFile() {
    String token;
    try {
      token = Files.readString(path).strip();
    } catch (IOException e) {
      throw new DatabaseAuthenticationProviderException(
          String.format("Failed to read database password file '%s'", path), e);
    }
    if (nullOrEmpty(token)) {
      throw new DatabaseAuthenticationProviderException(
          String.format("Database password file '%s' is empty", path));
    }
    return token;
  }
}
