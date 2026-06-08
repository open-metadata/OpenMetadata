package org.openmetadata.service.util.jdbi;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileCredentialProviderTest {

  // Arbitrary unit for the injected fake clock so tests never sleep.
  private static final long TTL = 1000L;

  @Test
  void readsAndTrimsTokenFromFile(@TempDir Path dir) throws IOException {
    Path file = dir.resolve("token");
    Files.writeString(file, "  secret-token\n");
    FileCredentialProvider provider = newProvider(file, new AtomicLong(0));
    assertEquals("secret-token", provider.authenticate(null, null, null));
  }

  @Test
  void cachesWithinTtl(@TempDir Path dir) throws IOException {
    Path file = dir.resolve("token");
    Files.writeString(file, "token-1");
    AtomicLong clock = new AtomicLong(0);
    FileCredentialProvider provider = newProvider(file, clock);
    assertEquals("token-1", provider.authenticate(null, null, null));

    Files.writeString(file, "token-2");
    clock.set(TTL - 1);
    assertEquals("token-1", provider.authenticate(null, null, null));
  }

  @Test
  void refreshesAfterTtl(@TempDir Path dir) throws IOException {
    Path file = dir.resolve("token");
    Files.writeString(file, "token-1");
    AtomicLong clock = new AtomicLong(0);
    FileCredentialProvider provider = newProvider(file, clock);
    assertEquals("token-1", provider.authenticate(null, null, null));

    Files.writeString(file, "token-2");
    clock.set(TTL);
    assertEquals("token-2", provider.authenticate(null, null, null));
  }

  @Test
  void invalidateForcesReRead(@TempDir Path dir) throws IOException {
    Path file = dir.resolve("token");
    Files.writeString(file, "token-1");
    FileCredentialProvider provider = newProvider(file, new AtomicLong(0));
    assertEquals("token-1", provider.authenticate(null, null, null));

    Files.writeString(file, "token-2");
    provider.invalidate();
    assertEquals("token-2", provider.authenticate(null, null, null));
  }

  @Test
  void emptyFileThrows(@TempDir Path dir) throws IOException {
    Path file = dir.resolve("token");
    Files.writeString(file, "   \n");
    FileCredentialProvider provider = newProvider(file, new AtomicLong(0));
    assertThrows(
        DatabaseAuthenticationProviderException.class,
        () -> provider.authenticate(null, null, null));
  }

  @Test
  void missingFileThrows(@TempDir Path dir) {
    Path file = dir.resolve("does-not-exist");
    FileCredentialProvider provider = newProvider(file, new AtomicLong(0));
    assertThrows(
        DatabaseAuthenticationProviderException.class,
        () -> provider.authenticate(null, null, null));
  }

  @Test
  void emptyPathThrows() {
    assertThrows(
        DatabaseAuthenticationProviderException.class, () -> new FileCredentialProvider(""));
  }

  private FileCredentialProvider newProvider(Path file, AtomicLong clock) {
    return new FileCredentialProvider(file.toString(), TTL, clock::get);
  }
}
