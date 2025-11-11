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
    LdapConfiguration.TruststoreConfigType configType = ldapConfiguration.getTruststoreConfigType();
    switch (configType) {
      case CUSTOM_TRUST_STORE -> {
        CustomTrustManagerConfig customTrustManagerConfig =
            JsonUtils.convertValue(
                ldapConfiguration.getTrustStoreConfig().getCustomTrustManagerConfig(),
                CustomTrustManagerConfig.class);
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
            JsonUtils.convertValue(
                ldapConfiguration.getTrustStoreConfig().getHostNameConfig(), HostNameConfig.class);
        x509TrustManager =
            new HostNameTrustManager(
                hostNameConfig.getAllowWildCards(), hostNameConfig.getAcceptableHostNames());
      }
      case JVM_DEFAULT -> {
        JVMDefaultConfig jvmDefaultConfig =
            JsonUtils.convertValue(
                ldapConfiguration.getTrustStoreConfig().getJvmDefaultConfig(),
                JVMDefaultConfig.class);
        x509TrustManager = JVMDefaultTrustManager.getInstance();
        sslSocketVerifier = hostNameVerifier(jvmDefaultConfig.getVerifyHostname());
        connectionOptions.setSSLSocketVerifier(sslSocketVerifier);
      }
      case TRUST_ALL -> {
        TrustAllConfig trustAllConfig =
            JsonUtils.convertValue(
                ldapConfiguration.getTrustStoreConfig().getTrustAllConfig(), TrustAllConfig.class);
        x509TrustManager = new TrustAllTrustManager(trustAllConfig.getExamineValidityDates());
      }
      default -> throw new IllegalArgumentException("Invalid Truststore type.");
    }
    return x509TrustManager;
  }

  private SSLSocketVerifier hostNameVerifier(boolean verifyHostName) {
    return verifyHostName
        ? new HostNameSSLSocketVerifier(true)
        : TrustAllSSLSocketVerifier.getInstance();
  }
}
