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

package org.openmetadata.service.util;

import com.unboundid.ldap.sdk.LDAPConnectionOptions;
import com.unboundid.util.ssl.HostNameSSLSocketVerifier;
import com.unboundid.util.ssl.HostNameTrustManager;
import com.unboundid.util.ssl.JVMDefaultTrustManager;
import com.unboundid.util.ssl.SSLSocketVerifier;
import com.unboundid.util.ssl.TrustAllSSLSocketVerifier;
import com.unboundid.util.ssl.TrustAllTrustManager;
import com.unboundid.util.ssl.TrustStoreTrustManager;
import javax.net.ssl.X509TrustManager;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.CustomTrustManagerConfig;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.HostNameConfig;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.JVMDefaultConfig;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.TrustAllConfig;
import org.openmetadata.schema.utils.JsonUtils;

public class LdapUtil {

  public X509TrustManager getLdapSSLConnection(
      LdapConfiguration ldapConfiguration, LDAPConnectionOptions connectionOptions) {
    X509TrustManager x509TrustManager;
    SSLSocketVerifier sslSocketVerifier;
    LdapConfiguration.TruststoreConfigType configType = requireTrustStore(ldapConfiguration);
    switch (configType) {
      case CUSTOM_TRUST_STORE -> {
        CustomTrustManagerConfig customTrustManagerConfig =
            trustStoreSettings(
                ldapConfiguration.getTrustStoreConfig().getCustomTrustManagerConfig(),
                CustomTrustManagerConfig.class,
                configType);
        x509TrustManager =
            new TrustStoreTrustManager(
                customTrustManagerConfig.getTrustStoreFilePath(),
                customTrustManagerConfig.getTrustStoreFilePassword().toCharArray(),
                customTrustManagerConfig.getTrustStoreFileFormat(),
                customTrustManagerConfig.getExamineValidityDates());
        sslSocketVerifier = hostNameVerifier(customTrustManagerConfig.getVerifyHostname());
        connectionOptions.setSSLSocketVerifier(sslSocketVerifier);
      }
      case HOST_NAME -> {
        HostNameConfig hostNameConfig =
            trustStoreSettings(
                ldapConfiguration.getTrustStoreConfig().getHostNameConfig(),
                HostNameConfig.class,
                configType);
        x509TrustManager =
            new HostNameTrustManager(
                hostNameConfig.getAllowWildCards(), hostNameConfig.getAcceptableHostNames());
      }
      case JVM_DEFAULT -> {
        JVMDefaultConfig jvmDefaultConfig =
            trustStoreSettings(
                ldapConfiguration.getTrustStoreConfig().getJvmDefaultConfig(),
                JVMDefaultConfig.class,
                configType);
        x509TrustManager = JVMDefaultTrustManager.getInstance();
        sslSocketVerifier = hostNameVerifier(jvmDefaultConfig.getVerifyHostname());
        connectionOptions.setSSLSocketVerifier(sslSocketVerifier);
      }
      case TRUST_ALL -> {
        TrustAllConfig trustAllConfig =
            trustStoreSettings(
                ldapConfiguration.getTrustStoreConfig().getTrustAllConfig(),
                TrustAllConfig.class,
                configType);
        x509TrustManager = new TrustAllTrustManager(trustAllConfig.getExamineValidityDates());
      }
      default -> throw new IllegalArgumentException("Invalid Truststore type.");
    }
    return x509TrustManager;
  }

  /**
   * The trust store type an SSL connection needs. Without one there is no way to trust the
   * directory's certificate, which used to surface as a NullPointerException when the
   * configuration was applied rather than as a reason at save.
   */
  private static LdapConfiguration.TruststoreConfigType requireTrustStore(
      LdapConfiguration ldapConfiguration) {
    LdapConfiguration.TruststoreConfigType configType = ldapConfiguration.getTruststoreConfigType();
    if (configType == null || ldapConfiguration.getTrustStoreConfig() == null) {
      throw new IllegalArgumentException(
          "SSL is on but no trust store is chosen: choose a trust store type and fill in its"
              + " settings, or turn SSL off");
    }
    return configType;
  }

  private static <T> T trustStoreSettings(
      Object settings, Class<T> type, LdapConfiguration.TruststoreConfigType configType) {
    T converted = JsonUtils.convertValue(settings, type);
    if (converted == null) {
      throw new IllegalArgumentException(
          String.format("The %s trust store type needs its trust store settings", configType));
    }
    return converted;
  }

  private SSLSocketVerifier hostNameVerifier(boolean verifyHostName) {
    return verifyHostName
        ? new HostNameSSLSocketVerifier(true)
        : TrustAllSSLSocketVerifier.getInstance();
  }
}
