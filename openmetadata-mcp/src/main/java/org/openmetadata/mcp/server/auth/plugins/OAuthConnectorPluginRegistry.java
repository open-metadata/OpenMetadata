package org.openmetadata.mcp.server.auth.plugins;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.services.connections.common.OAuthCredentials;

/**
 * Central registry for OAuth connector plugins.
 *
 * <p>This registry manages all registered {@link OAuthConnectorPlugin} implementations, providing
 * thread-safe plugin registration, lookup by connector type, and auto-detection based on
 * configuration objects.
 *
 * <p><b>Design Pattern:</b> Singleton registry with lazy plugin initialization
 *
 * <p><b>Thread Safety:</b> All methods are thread-safe using ConcurrentHashMap
 *
 * <p><b>Usage Example:</b>
 *
 * <pre>{@code
 * // Register plugins at application startup
 * OAuthConnectorPluginRegistry.registerPlugin(new SnowflakeOAuthPlugin());
 * OAuthConnectorPluginRegistry.registerPlugin(new DatabricksOAuthPlugin());
 * OAuthConnectorPluginRegistry.registerPlugin(new BigQueryOAuthPlugin());
 *
 * // Lookup plugin by connector type
 * OAuthConnectorPlugin plugin = OAuthConnectorPluginRegistry.getPlugin("Snowflake");
 * if (plugin != null) {
 *     OAuthCredentials oauth = plugin.extractCredentials(config);
 * }
 *
 * // Auto-detect plugin from config object
 * SnowflakeConnection config = new SnowflakeConnection();
 * OAuthConnectorPlugin plugin = OAuthConnectorPluginRegistry.getPluginForConfig(config);
 * }</pre>
 *
 * <p><b>Automatic Plugin Registration:</b>
 *
 * <p>Plugins are automatically registered via static initializer block. This ensures plugins are
 * available as soon as the registry is first accessed.
 *
 * @see OAuthConnectorPlugin
 * @see org.openmetadata.mcp.server.auth.provider.ConnectorOAuthProvider
 * @since 1.12.0
 */
@Slf4j
public final class OAuthConnectorPluginRegistry {

  /**
   * Thread-safe map of connector type to plugin implementation.
   *
   * <p>Key: Connector type string (e.g., "Snowflake", "Databricks") Value: Plugin implementation
   */
  private static final Map<String, OAuthConnectorPlugin> PLUGINS = new ConcurrentHashMap<>();

  /**
   * Thread-safe map of configuration class to plugin implementation.
   *
   * <p>Enables fast lookup by config class without string comparison. Key: Configuration class
   * (e.g., SnowflakeConnection.class) Value: Plugin implementation
   */
  private static final Map<Class<?>, OAuthConnectorPlugin> CLASS_TO_PLUGIN =
      new ConcurrentHashMap<>();

  // Prevent instantiation - this is a utility class
  private OAuthConnectorPluginRegistry() {
    throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
  }

  /**
   * Registers an OAuth connector plugin.
   *
   * <p>This method is thread-safe and can be called multiple times. If a plugin for the same
   * connector type is already registered, it will be replaced with a warning log.
   *
   * <p><b>Registration Timing:</b> Plugins should be registered at application startup, typically in
   * a configuration class or initialization method.
   *
   * @param plugin the plugin to register
   * @throws IllegalArgumentException if plugin is null or getConnectorType() returns null/empty
   */
  public static void registerPlugin(OAuthConnectorPlugin plugin) {
    if (plugin == null) {
      throw new IllegalArgumentException("Plugin cannot be null");
    }

    String connectorType = plugin.getConnectorType();
    if (connectorType == null || connectorType.trim().isEmpty()) {
      throw new IllegalArgumentException(
          "Plugin connector type cannot be null or empty. Plugin class: "
              + plugin.getClass().getName());
    }

    OAuthConnectorPlugin existing = PLUGINS.putIfAbsent(connectorType, plugin);
    if (existing != null && existing != plugin) {
      LOG.warn(
          "OAuth plugin for connector type '{}' was already registered (class: {}). "
              + "Replacing with new plugin (class: {}). This may indicate duplicate plugin registration.",
          connectorType,
          existing.getClass().getName(),
          plugin.getClass().getName());
      PLUGINS.put(connectorType, plugin); // Replace with new plugin
    } else if (existing == null) {
      LOG.info(
          "Registered OAuth plugin for connector type '{}' (class: {})",
          connectorType,
          plugin.getClass().getName());
    }
  }

  /**
   * Retrieves an OAuth connector plugin by connector type.
   *
   * <p><b>Connector Type Matching:</b> The lookup is case-sensitive. Ensure the connector type
   * string matches exactly with the plugin's getConnectorType() return value.
   *
   * @param connectorType the connector type (e.g., "Snowflake", "Databricks")
   * @return the registered plugin, or null if no plugin is registered for this type
   */
  public static OAuthConnectorPlugin getPlugin(String connectorType) {
    if (connectorType == null || connectorType.trim().isEmpty()) {
      LOG.warn("Cannot retrieve plugin for null or empty connector type");
      return null;
    }

    OAuthConnectorPlugin plugin = PLUGINS.get(connectorType);
    if (plugin == null) {
      LOG.debug(
          "No OAuth plugin registered for connector type '{}'. "
              + "Available types: {}. OAuth may not be supported for this connector.",
          connectorType,
          PLUGINS.keySet());
    }
    return plugin;
  }

  /**
   * Auto-detects and retrieves the appropriate OAuth plugin for a configuration object.
   *
   * <p>This method uses the configuration object's class to determine which plugin to use. It first
   * checks a cache of known config class to plugin mappings for performance, then falls back to
   * asking each plugin if it can handle the config.
   *
   * <p><b>Performance:</b> First call for a config type is O(n) where n = number of plugins.
   * Subsequent calls for the same config type are O(1) due to caching.
   *
   * <p><b>Supported Config Types:</b>
   *
   * <ul>
   *   <li>SnowflakeConnection → SnowflakeOAuthPlugin
   *   <li>DatabricksConnection → DatabricksOAuthPlugin
   *   <li>BigQueryConnection → BigQueryOAuthPlugin
   *   <li>... and all other registered plugins
   * </ul>
   *
   * @param config connector configuration object
   * @return matching OAuth plugin, or null if no plugin supports this config type
   */
  public static OAuthConnectorPlugin getPluginForConfig(Object config) {
    if (config == null) {
      LOG.warn("Cannot retrieve plugin for null configuration object");
      return null;
    }

    Class<?> configClass = config.getClass();

    // Fast path: Check cache first
    OAuthConnectorPlugin cached = CLASS_TO_PLUGIN.get(configClass);
    if (cached != null) {
      LOG.debug("Found cached plugin for config class: {}", configClass.getSimpleName());
      return cached;
    }

    // Slow path: Auto-detect by trying to extract credentials from each plugin
    LOG.debug(
        "No cached plugin for config class '{}'. Auto-detecting plugin by trying all {} registered plugins...",
        configClass.getSimpleName(),
        PLUGINS.size());

    for (OAuthConnectorPlugin plugin : PLUGINS.values()) {
      try {
        // Try to extract credentials - if successful, this plugin handles this config type
        OAuthCredentials credentials = plugin.extractCredentials(config);
        if (credentials != null || plugin.isOAuthConfigured(config)) {
          // Cache this mapping for future lookups
          CLASS_TO_PLUGIN.put(configClass, plugin);
          LOG.info(
              "Auto-detected OAuth plugin for config class '{}': {} (connector type: {})",
              configClass.getSimpleName(),
              plugin.getClass().getSimpleName(),
              plugin.getConnectorType());
          return plugin;
        }
      } catch (ClassCastException e) {
        // This plugin doesn't handle this config type - try next plugin
        LOG.trace(
            "Plugin {} does not handle config class {}",
            plugin.getClass().getSimpleName(),
            configClass.getSimpleName());
      } catch (Exception e) {
        // Log unexpected errors but continue trying other plugins
        LOG.warn(
            "Unexpected error while checking if plugin {} can handle config class {}: {}",
            plugin.getClass().getSimpleName(),
            configClass.getSimpleName(),
            e.getMessage());
      }
    }

    LOG.warn(
        "No OAuth plugin found for configuration class '{}'. "
            + "Available plugins: {}. OAuth may not be supported for this connector type.",
        configClass.getSimpleName(),
        PLUGINS.keySet());
    return null;
  }

  /**
   * Returns all registered connector types.
   *
   * <p>Useful for debugging, logging, and UI display of supported connectors.
   *
   * @return unmodifiable collection of registered connector type strings
   */
  public static Collection<String> getRegisteredConnectorTypes() {
    return PLUGINS.keySet();
  }

  /**
   * Returns all registered plugins.
   *
   * <p>Useful for testing, debugging, and programmatic inspection of available plugins.
   *
   * @return unmodifiable collection of registered plugins
   */
  public static Collection<OAuthConnectorPlugin> getRegisteredPlugins() {
    return PLUGINS.values();
  }

  /**
   * Returns the number of registered plugins.
   *
   * @return count of registered plugins
   */
  public static int getPluginCount() {
    return PLUGINS.size();
  }

  /**
   * Clears all registered plugins.
   *
   * <p><b>WARNING:</b> This method is intended for testing only. Calling this in production will
   * disable OAuth support for all connectors until plugins are re-registered.
   *
   * <p><b>Thread Safety:</b> This method is thread-safe but may cause race conditions if called
   * while other threads are accessing plugins.
   */
  public static void clearAllPlugins() {
    LOG.warn(
        "Clearing all {} registered OAuth plugins. This should only be done in tests!",
        PLUGINS.size());
    PLUGINS.clear();
    CLASS_TO_PLUGIN.clear();
  }

  /**
   * Checks if OAuth is supported for a given connector type.
   *
   * @param connectorType connector type string
   * @return true if a plugin is registered for this connector type
   */
  public static boolean isOAuthSupported(String connectorType) {
    return PLUGINS.containsKey(connectorType);
  }

  /**
   * Checks if OAuth is supported for a given configuration object.
   *
   * @param config connector configuration object
   * @return true if a plugin can handle this configuration type
   */
  public static boolean isOAuthSupportedForConfig(Object config) {
    return getPluginForConfig(config) != null;
  }

  /**
   * Auto-registers built-in plugins.
   *
   * <p>This static initializer ensures built-in plugins (Snowflake, Databricks) are always available
   * without requiring explicit registration.
   *
   * <p><b>Extensibility:</b> Additional plugins can be registered via registerPlugin() after
   * initialization.
   */
  static {
    try {
      // Auto-register built-in plugins
      LOG.info("OAuthConnectorPluginRegistry initializing...");

      // Register Snowflake OAuth plugin
      registerPlugin(new SnowflakeOAuthPlugin());

      // Register Databricks OAuth plugin
      registerPlugin(new DatabricksOAuthPlugin());

      LOG.info(
          "OAuthConnectorPluginRegistry initialized successfully. {} built-in plugins registered: {}",
          PLUGINS.size(),
          PLUGINS.keySet());
    } catch (Exception e) {
      LOG.error("Failed to initialize OAuth connector plugin registry", e);
      throw new ExceptionInInitializerError(e);
    }
  }
}
