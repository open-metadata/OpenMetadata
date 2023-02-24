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

public class LdapUtil {

  public X509TrustManager getLdapSSLConnection(
      LdapConfiguration ldapConfiguration, LDAPConnectionOptions connectionOptions) {
    X509TrustManager x509TrustManager;
    SSLSocketVerifier sslSocketVerifier;
    connectionOptions = new LDAPConnectionOptions();
    LdapConfiguration.TruststoreConfigType configType = ldapConfiguration.getTruststoreConfigType();
    switch (configType) {
      case CUSTOM_TRUST_STORE:
        CustomTrustManagerConfig customTrustManagerConfig =
            JsonUtils.convertValue(
                ldapConfiguration.getTrustStoreConfig().getCustomTrustManagerConfig(), CustomTrustManagerConfig.class);
        x509TrustManager =
            new TrustStoreTrustManager(
                customTrustManagerConfig.getTrustStoreFilePath(),
                customTrustManagerConfig.getTrustStoreFilePassword().toCharArray(),
                customTrustManagerConfig.getTrustStoreFileFormat(),
                customTrustManagerConfig.getExamineValidityDates());
        sslSocketVerifier = hostNameVerifier(customTrustManagerConfig.getVerifyHostname());
        connectionOptions.setSSLSocketVerifier(sslSocketVerifier);
        break;
      case HOST_NAME:
        HostNameConfig hostNameConfig =
            JsonUtils.convertValue(ldapConfiguration.getTrustStoreConfig().getHostNameConfig(), HostNameConfig.class);
        x509TrustManager =
            new HostNameTrustManager(hostNameConfig.getAllowWildCards(), hostNameConfig.getAcceptableHostNames());
        break;
      case JVM_DEFAULT:
        JVMDefaultConfig jvmDefaultConfig =
            JsonUtils.convertValue(
                ldapConfiguration.getTrustStoreConfig().getJvmDefaultConfig(), JVMDefaultConfig.class);
        x509TrustManager = JVMDefaultTrustManager.getInstance();
        sslSocketVerifier = hostNameVerifier(jvmDefaultConfig.getVerifyHostname());
        connectionOptions.setSSLSocketVerifier(sslSocketVerifier);
        break;
      case TRUST_ALL:
        TrustAllConfig trustAllConfig =
            JsonUtils.convertValue(ldapConfiguration.getTrustStoreConfig().getTrustAllConfig(), TrustAllConfig.class);
        x509TrustManager = new TrustAllTrustManager(trustAllConfig.getExamineValidityDates());
        break;
      default:
        throw new IllegalArgumentException("Invalid Truststore type.");
    }
    return x509TrustManager;
  }

  private SSLSocketVerifier hostNameVerifier(boolean verifyHostName) {
    return verifyHostName ? new HostNameSSLSocketVerifier(true) : TrustAllSSLSocketVerifier.getInstance();
  }
}
