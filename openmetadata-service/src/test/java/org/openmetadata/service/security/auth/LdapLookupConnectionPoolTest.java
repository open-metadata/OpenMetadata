/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.security.auth;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import com.unboundid.ldap.listener.InMemoryDirectoryServer;
import com.unboundid.ldap.listener.InMemoryDirectoryServerConfig;
import com.unboundid.ldap.listener.InMemoryListenerConfig;
import com.unboundid.ldap.sdk.Filter;
import com.unboundid.ldap.sdk.LDAPConnectionPool;
import com.unboundid.ldap.sdk.LDAPException;
import com.unboundid.ldap.sdk.LDAPSearchException;
import com.unboundid.ldap.sdk.SearchScope;
import com.unboundid.ldif.LDIFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.auth.LdapConfiguration;

/**
 * Runs the LDAP lookup pool against a real, in-process directory reached through a relay that can
 * go silent on the connections it holds, the way a firewall or load balancer does when it drops an
 * idle connection without closing it (#14601).
 */
class LdapLookupConnectionPoolTest {
  private static final String BASE_DN = "dc=example,dc=com";
  private static final String USERS_DN = "ou=users," + BASE_DN;
  private static final String LOOKUP_DN = "cn=Directory Manager";
  private static final String LOOKUP_PASSWORD = "lookup-password";
  private static final String ALICE_DN = "uid=alice," + USERS_DN;
  private static final String ALICE_EMAIL = "alice@example.com";

  private static InMemoryDirectoryServer directory;
  private SilenceableRelay relay;

  @BeforeAll
  static void startDirectory() throws LDAPException, LDIFException {
    InMemoryDirectoryServerConfig config = new InMemoryDirectoryServerConfig(BASE_DN);
    config.addAdditionalBindCredentials(LOOKUP_DN, LOOKUP_PASSWORD);
    config.setListenerConfigs(
        InMemoryListenerConfig.createLDAPConfig(
            "default", InetAddress.getLoopbackAddress(), 0, null));
    config.setSchema(null);
    directory = new InMemoryDirectoryServer(config);
    directory.add("dn: " + BASE_DN, "objectClass: domain", "dc: example");
    directory.add("dn: " + USERS_DN, "objectClass: organizationalUnit", "ou: users");
    directory.add(
        "dn: " + ALICE_DN,
        "objectClass: inetOrgPerson",
        "uid: alice",
        "cn: Alice",
        "sn: Liddell",
        "mail: " + ALICE_EMAIL);
    directory.startListening();
  }

  @AfterAll
  static void stopDirectory() {
    directory.shutDown(true);
  }

  @BeforeEach
  void startRelay() throws IOException {
    relay = new SilenceableRelay(directory.getListenPort());
  }

  @AfterEach
  void stopRelay() {
    relay.close();
  }

  @Test
  void aLookupIsNotStalledByAPooledConnectionThatStoppedAnswering() throws LDAPSearchException {
    LDAPConnectionPool pool = LdapAuthenticator.createLookupConnectionPool(lookupThroughRelay());
    try {
      assertEquals(ALICE_DN, findAlice(pool));
      relay.silenceOpenConnections();

      // Unchecked, the search would wait out the SDK's five-minute search response timeout.
      String foundDn = assertTimeoutPreemptively(Duration.ofSeconds(30), () -> findAlice(pool));

      assertEquals(ALICE_DN, foundDn);
    } finally {
      pool.close();
    }
  }

  @Test
  void aRejectedLookupBindDoesNotLeaveItsConnectionOpen() {
    LdapConfiguration wrongPassword =
        lookupThroughRelay().withDnAdminPassword("not-the-lookup-password");

    assertThrows(
        IllegalStateException.class,
        () -> LdapAuthenticator.createLookupConnectionPool(wrongPassword));

    assertEquals(1, relay.acceptedConnections());
    await().atMost(Duration.ofSeconds(10)).until(() -> relay.openConnections() == 0);
  }

  @Test
  void closingTheAuthenticatorReleasesItsDirectoryConnections() throws Exception {
    LdapAuthenticator authenticator = new LdapAuthenticator();
    setField(
        authenticator,
        "ldapLookupConnectionPool",
        LdapAuthenticator.createLookupConnectionPool(lookupThroughRelay()));
    assertEquals(1, relay.openConnections());

    authenticator.close();

    await().atMost(Duration.ofSeconds(10)).until(() -> relay.openConnections() == 0);
  }

  private LdapConfiguration lookupThroughRelay() {
    return new LdapConfiguration()
        .withHost(InetAddress.getLoopbackAddress().getHostAddress())
        .withPort(relay.port())
        .withMaxPoolSize(1)
        .withDnAdminPrincipal(LOOKUP_DN)
        .withDnAdminPassword(LOOKUP_PASSWORD)
        .withUserBaseDN(USERS_DN)
        .withMailAttributeName("mail");
  }

  private static String findAlice(LDAPConnectionPool pool) throws LDAPSearchException {
    return pool.search(
            USERS_DN, SearchScope.SUB, Filter.createEqualityFilter("mail", ALICE_EMAIL), "mail")
        .getSearchEntries()
        .getFirst()
        .getDN();
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  /** Relays TCP to the directory; {@link #silenceOpenConnections} drops their traffic for good. */
  private static final class SilenceableRelay implements AutoCloseable {
    private final ServerSocket listener;
    private final int directoryPort;
    private final List<RelayedConnection> connections = new CopyOnWriteArrayList<>();
    private final ExecutorService threads =
        Executors.newCachedThreadPool(
            task -> {
              Thread thread = new Thread(task, "ldap-test-relay");
              thread.setDaemon(true);
              return thread;
            });

    SilenceableRelay(int directoryPort) throws IOException {
      this.directoryPort = directoryPort;
      this.listener = new ServerSocket(0, 50, InetAddress.getLoopbackAddress());
      threads.execute(this::acceptConnections);
    }

    int port() {
      return listener.getLocalPort();
    }

    void silenceOpenConnections() {
      connections.forEach(RelayedConnection::silence);
    }

    long openConnections() {
      return connections.stream().filter(RelayedConnection::isOpen).count();
    }

    int acceptedConnections() {
      return connections.size();
    }

    private void acceptConnections() {
      while (!listener.isClosed()) {
        try {
          Socket client = listener.accept();
          Socket upstream = new Socket(InetAddress.getLoopbackAddress(), directoryPort);
          RelayedConnection connection = new RelayedConnection(client, upstream);
          connections.add(connection);
          threads.execute(() -> connection.relay(client, upstream));
          threads.execute(() -> connection.relay(upstream, client));
        } catch (IOException e) {
          // The listener was closed by close(); the loop condition ends accepting.
        }
      }
    }

    @Override
    public void close() {
      closeQuietly(listener);
      connections.forEach(RelayedConnection::close);
      threads.shutdownNow();
    }
  }

  private static final class RelayedConnection {
    private final Socket client;
    private final Socket upstream;
    private volatile boolean silenced;

    RelayedConnection(Socket client, Socket upstream) {
      this.client = client;
      this.upstream = upstream;
    }

    void silence() {
      silenced = true;
    }

    boolean isOpen() {
      return !client.isClosed();
    }

    void relay(Socket from, Socket to) {
      byte[] buffer = new byte[8192];
      try {
        InputStream in = from.getInputStream();
        OutputStream out = to.getOutputStream();
        for (int read = in.read(buffer); read != -1; read = in.read(buffer)) {
          if (!silenced) {
            out.write(buffer, 0, read);
          }
        }
      } catch (IOException e) {
        // One side went away; closing both below propagates that to the other side.
      } finally {
        close();
      }
    }

    void close() {
      closeQuietly(client);
      closeQuietly(upstream);
    }
  }

  private static void closeQuietly(AutoCloseable closeable) {
    try {
      closeable.close();
    } catch (Exception e) {
      // Teardown of a test relay; there is nothing useful to do with a failed close.
    }
  }
}
