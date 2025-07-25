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

package org.openmetadata.service;

import io.dropwizard.core.setup.Environment;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import javax.naming.ConfigurationException;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.cache.CachedCollectionDAO;
import org.openmetadata.service.cache.RelationshipCache;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.AuthenticatorHandler;

@Slf4j
@Getter
public class ApplicationInitializer {
  private final OpenMetadataApplicationConfig config;
  private final Environment environment;

  private Jdbi jdbi;
  private Authorizer authorizer;
  private AuthenticatorHandler authenticatorHandler;
  private Limits limits;

  public ApplicationInitializer(OpenMetadataApplicationConfig config, Environment environment) {
    this.config = config;
    this.environment = environment;
  }

  public void initialize()
      throws ClassNotFoundException,
          IllegalAccessException,
          InstantiationException,
          NoSuchMethodException,
          InvocationTargetException,
          IOException,
          ConfigurationException,
          CertificateException,
          KeyStoreException,
          NoSuchAlgorithmException {

    // Phase 1: Configuration and Core Setup
    CoreSetupManager coreSetup = new CoreSetupManager(config, environment);
    coreSetup.setup();
    this.jdbi = coreSetup.getJdbi();

    // Phase 2: Security and Authentication
    SecurityManager securityManager = new SecurityManager(config, environment);
    securityManager.setup();
    this.authorizer = securityManager.getAuthorizer();
    this.authenticatorHandler = securityManager.getAuthenticatorHandler();
    this.limits = securityManager.getLimits();

    // Phase 3: Web Services and Resources
    WebServiceManager webServiceManager =
        new WebServiceManager(config, environment, jdbi, authorizer, authenticatorHandler, limits);
    webServiceManager.setup();

    // Phase 4: Background Services and Jobs
    BackgroundServiceManager backgroundManager =
        new BackgroundServiceManager(config, environment, jdbi);
    backgroundManager.setup();

    // Phase 5: Final Initialization
    finalizeInitialization();
  }

  private void finalizeInitialization() {
    limits.init(config, jdbi);
    authorizer.init(config);
    authenticatorHandler.init(config);
    LOG.info("Application initialization completed successfully");
  }

  protected CollectionDAO getDao(Jdbi jdbi) {
    CollectionDAO originalDAO = jdbi.onDemand(CollectionDAO.class);

    if (RelationshipCache.isAvailable()) {
      LOG.info("Wrapping CollectionDAO with caching support");
      return new CachedCollectionDAO(originalDAO);
    }

    LOG.info("Using original CollectionDAO without caching");
    return originalDAO;
  }
}
