package org.openmetadata.service.security.auth;

import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.AuthenticationConfigDAO;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class AuthenticationConfigurationManager {
    private static AuthenticationConfigurationManager instance;
    private final SystemRepository systemRepository;
    private final AuthenticationConfigDAO authConfigDAO;
    private final OpenMetadataApplication application;
    private AuthenticationConfiguration currentConfig;
    private AuthenticationConfiguration previousConfig;

    private AuthenticationConfigurationManager(SystemRepository systemRepository, AuthenticationConfigDAO authConfigDAO, OpenMetadataApplication application) {
        this.systemRepository = systemRepository;
        this.authConfigDAO = authConfigDAO;
        this.application = application;
    }

    public static void initialize(SystemRepository systemRepository, AuthenticationConfigDAO authConfigDAO, OpenMetadataApplication application) {
        if (instance != null) {
            throw new RuntimeException("AuthenticationConfigurationManager already initialized");
        }
        instance = new AuthenticationConfigurationManager(systemRepository, authConfigDAO, application);
    }

    public static AuthenticationConfigurationManager getInstance() {
        if (instance == null) {
            throw new RuntimeException("AuthenticationConfigurationManager not initialized");
        }
        return instance;
    }

    public AuthenticationConfiguration getCurrentConfig() {
        return currentConfig;
    }

    public void loadConfig() {
        // Try to load from database first
        String configJson = authConfigDAO.getConfigByProvider(currentConfig != null ? currentConfig.getProvider() : "basic");
        
        if (configJson != null) {
            try {
                currentConfig = JsonUtils.readValue(configJson, AuthenticationConfiguration.class);
                LOG.info("Loaded authentication configuration from database");
            } catch (JsonProcessingException e) {
                LOG.error("Failed to parse authentication config from database", e);
                // Fall back to YAML/env config
                currentConfig = application.getConfiguration().getAuthenticationConfiguration();
                LOG.info("Using default authentication configuration from YAML/environment");
            }
        } else {
            // Fall back to YAML/env config
            currentConfig = application.getConfiguration().getAuthenticationConfiguration();
            LOG.info("Using default authentication configuration from YAML/environment");
            
            // Store initial config in database
            try {
                saveConfig(currentConfig, "system");
            } catch (Exception e) {
                LOG.error("Failed to store initial authentication config in database", e);
            }
        }
    }

    public void saveConfig(AuthenticationConfiguration newConfig, String updatedBy) throws JsonProcessingException {
        String configJson = JsonUtils.writeValueAsString(newConfig);
        String encryptedFields = JsonUtils.writeValueAsString(newConfig.getEncryptedFields());
        
        if (authConfigDAO.exists(newConfig.getProvider())) {
            authConfigDAO.update(newConfig.getProvider(), configJson, encryptedFields, updatedBy);
        } else {
            authConfigDAO.insert(
                UUID.randomUUID(),
                newConfig.getProvider(),
                newConfig.getClass().getSimpleName(),
                configJson,
                encryptedFields,
                updatedBy
            );
        }
    }

    public void reloadAuthenticationSystem(AuthenticationConfiguration newConfig) {
        try {
            LOG.info("Reloading authentication system with new configuration");
            
            // Store the current config for rollback
            previousConfig = currentConfig;
            
            // Save new config to database
            saveConfig(newConfig, "system");
            
            // Update current config
            currentConfig = newConfig;
            
            // Create new application config with updated auth config
            OpenMetadataApplicationConfig appConfig = application.getConfiguration();
            appConfig.setAuthenticationConfiguration(newConfig);
            
            // Reinitialize authentication handlers
            application.reinitializeAuthHandlers(appConfig);
            
            LOG.info("Successfully reloaded authentication system");
        } catch (Exception e) {
            LOG.error("Failed to reload authentication system", e);
            rollbackConfiguration();
            throw new AuthenticationException("Failed to reload authentication configuration", e);
        }
    }

    private void rollbackConfiguration() {
        if (previousConfig != null) {
            LOG.info("Rolling back to previous authentication configuration");
            try {
                currentConfig = previousConfig;
                OpenMetadataApplicationConfig appConfig = application.getConfiguration();
                appConfig.setAuthenticationConfiguration(previousConfig);
                application.reinitializeAuthHandlers(appConfig);
                saveConfig(previousConfig, "system");
                LOG.info("Successfully rolled back authentication configuration");
            } catch (Exception e) {
                LOG.error("Failed to rollback authentication configuration", e);
                throw new AuthenticationException("Failed to rollback authentication configuration", e);
            }
        }
    }
} 