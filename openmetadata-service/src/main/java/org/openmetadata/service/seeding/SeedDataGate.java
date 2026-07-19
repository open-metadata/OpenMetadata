/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.seeding;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.configuration.StartupChecksums;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.VersionUtils;
import org.openmetadata.service.config.StartupConfiguration;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.seeding.RequiredSeedRows.SeedTable;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.resourcepath.ResourcePathResolver;
import org.openmetadata.service.util.resourcepath.providers.NotificationTemplateResourcePathProvider;

@Slf4j
public final class SeedDataGate {
  private static final Pattern SEED_RESOURCES =
      Pattern.compile(".*json/(data|schema/(type|entity))/.*\\.json$");
  private static final String TYPE_SCHEMA_PATH = "json/schema/type/";
  private static final String ENTITY_SCHEMA_PATH = "json/schema/entity/";
  private static final String POLICY_SEED_PATH = "json/data/policy/";
  private static final String ROLE_SEED_PATH = "json/data/role/";
  private static final String TASK_FORM_SCHEMA_PATH = "json/data/taskFormSchemas/";
  private static final String DOCUMENT_DOCS_PATH = "json/data/document/docs/";
  private static final String OPENMETADATA_EMAIL_DOCUMENT_PATH =
      "json/data/document/emailTemplates/openmetadata/";
  private static final String COLLATE_EMAIL_DOCUMENT_PATH =
      "json/data/document/emailTemplates/collate/";
  private static final String WORKFLOW_DEFINITION_PATH = "json/data/governance/workflows/";
  private static final String EVENT_SUBSCRIPTION_PATH = "json/data/eventsubscription/";
  private static final String LEARNING_RESOURCE_PATH = "json/data/learningResource/";
  private static final String TEST_DEFINITION_PATH = "json/data/tests/";
  private static final String TEST_CONNECTION_DEFINITION_PATH = "json/data/testConnections/";
  private static final String WEB_ANALYTIC_EVENT_PATH = "json/data/analytics/webAnalyticEvents/";
  private static final String DATA_INSIGHT_CUSTOM_CHART_PATH = "json/data/dataInsight/custom/";
  private static final Pattern DATA_INSIGHT_CHART_SEED_RESOURCES =
      Pattern.compile(".*json/data/dataInsight/(?!custom/).*\\.json$");
  private static final String BOT_PATH = "json/data/bot/";
  private static final String TAG_PATH = "json/data/tags/";
  private static final Pattern GLOSSARY_SEED_RESOURCES =
      Pattern.compile(".*json/data/glossary/.*Glossary\\.json$");
  private static final String AI_POLICY_PATH = "json/data/aiGovernance/policies/";
  private static final String AI_FRAMEWORK_PATH = "json/data/aiGovernance/frameworks/";
  private static final String AI_APPLICATION_PATH = "json/data/aiGovernance/applications/";
  private static final String AI_SHADOW_APPLICATION_PATH = "json/data/aiGovernance/shadow/";
  private static final String LLM_SERVICE_PATH = "json/data/aiGovernance/services/llm/";
  private static final String LLM_MODEL_PATH = "json/data/aiGovernance/llmModels/";
  private static final String MCP_SERVICE_PATH = "json/data/aiGovernance/services/mcp/";
  private static final String MCP_SERVER_PATH = "json/data/aiGovernance/mcpServers/";
  private static final String OPENMETADATA_EMAIL_TEMPLATE_PROVIDER = "openmetadata";
  private static final String COLLATE_EMAIL_TEMPLATE_PROVIDER = "collate";
  private static final Set<SeedTable> REQUIRED_SEED_TABLES =
      EnumSet.complementOf(
          EnumSet.of(
              SeedTable.DATA_INSIGHT_CUSTOM_CHART, SeedTable.GLOSSARY, SeedTable.GLOSSARY_TERM));
  private static final String VERSION_RESOURCE = "/catalog/VERSION";
  private static final SeedDataGate INSTANCE = new SeedDataGate();

  private StartupConfiguration configuration = new StartupConfiguration();
  private SystemRepository systemRepository;
  private String serverVersion = "unknown";
  private String seedDataFingerprint;
  private String storedSeedDataFingerprint;
  private String storedSearchTemplateFingerprint;
  private String pendingSearchTemplateFingerprint;
  private String storedServerVersion;
  private boolean seedFailure;
  private boolean searchTemplateFailure;
  private boolean forceSeedData;
  private boolean seedDataDriftDetected;
  private RequiredSeedRows requiredSeedRows = RequiredSeedRows.empty();

  private SeedDataGate() {}

  public static SeedDataGate getInstance() {
    return INSTANCE;
  }

  public synchronized void reset() {
    configuration = new StartupConfiguration();
    systemRepository = null;
    serverVersion = "unknown";
    seedDataFingerprint = null;
    storedSeedDataFingerprint = null;
    storedSearchTemplateFingerprint = null;
    pendingSearchTemplateFingerprint = null;
    storedServerVersion = null;
    seedFailure = false;
    searchTemplateFailure = false;
    forceSeedData = false;
    seedDataDriftDetected = false;
    requiredSeedRows = RequiredSeedRows.empty();
  }

  public synchronized void configure(
      StartupConfiguration startupConfiguration, SystemRepository repository) {
    configuration =
        startupConfiguration == null ? new StartupConfiguration() : startupConfiguration;
    systemRepository = repository;
    forceSeedData = configuration.isForceSeedData();
    seedFailure = false;
    searchTemplateFailure = false;
    pendingSearchTemplateFingerprint = null;
    seedDataDriftDetected = false;
    serverVersion =
        Objects.requireNonNullElse(
            VersionUtils.getOpenMetadataServerVersion(VERSION_RESOURCE).getVersion(), "unknown");
    seedDataFingerprint = calculateSeedDataFingerprint();
    loadStoredChecksums();
    detectSeedDataDrift();
    if (!shouldSeed()) {
      LOG.info(
          "Bundled seed fingerprint is unchanged and every required bundled seed entity has a "
              + "database row; skipping seed reconciliation. Soft-deleted rows count as present; "
              + "modified row content and relationships are not validated. "
              + "Set STARTUP_FORCE_SEED_DATA=true or STARTUP_SEED_DATA_GATE_ENABLED=false to rerun "
              + "all loaders; unsupported direct DB changes may require manual repair.");
    }
  }

  public synchronized void forceSeedData() {
    forceSeedData = true;
  }

  /**
   * Returns whether bundled seed resources need reconciliation.
   *
   * <p>A fingerprint match is supplemented by one indexed hard-row presence query for required
   * bundled seed entities. Soft-deleted rows count as present, and policies or roles explicitly
   * marked as deletable are excluded. The query does not validate row content or relationships.
   * {@code STARTUP_FORCE_SEED_DATA=true} or {@code STARTUP_SEED_DATA_GATE_ENABLED=false} reruns all
   * loaders, but unsupported direct database changes may still require manual repair.
   */
  public boolean shouldSeed() {
    return !configuration.isSeedDataGateEnabled()
        || forceSeedData
        || seedDataFingerprint == null
        || !Objects.equals(seedDataFingerprint, storedSeedDataFingerprint)
        || seedDataDriftDetected;
  }

  public boolean shouldUpdateSearchTemplates(String fingerprint, int createdIndexCount) {
    return !configuration.isSearchTemplateGateEnabled()
        || forceSeedData
        || createdIndexCount > 0
        || !Objects.equals(fingerprint, storedSearchTemplateFingerprint);
  }

  public int getSearchInitParallelism() {
    return Math.max(1, configuration.getSearchInitParallelism());
  }

  public synchronized void recordSearchTemplateFingerprint(String fingerprint) {
    pendingSearchTemplateFingerprint = fingerprint;
    searchTemplateFailure = false;
  }

  public synchronized void recordSearchTemplateFailure() {
    pendingSearchTemplateFingerprint = null;
    searchTemplateFailure = true;
  }

  public synchronized void recordSeedFailure() {
    seedFailure = true;
  }

  public synchronized void stampIfClean() {
    if (systemRepository == null) {
      return;
    }
    String seedFingerprintToStore = seedFailure ? null : seedDataFingerprint;
    String searchFingerprintToStore =
        searchTemplateFailure
            ? null
            : pendingSearchTemplateFingerprint == null
                ? storedSearchTemplateFingerprint
                : pendingSearchTemplateFingerprint;
    if (Objects.equals(seedFingerprintToStore, storedSeedDataFingerprint)
        && Objects.equals(searchFingerprintToStore, storedSearchTemplateFingerprint)
        && Objects.equals(serverVersion, storedServerVersion)) {
      return;
    }

    StartupChecksums checksums =
        new StartupChecksums()
            .withSeedDataFingerprint(seedFingerprintToStore)
            .withSearchTemplateFingerprint(searchFingerprintToStore)
            .withServerVersion(serverVersion)
            .withAppliedAt(System.currentTimeMillis());
    try {
      systemRepository.updateSetting(
          new Settings().withConfigType(SettingsType.STARTUP_CHECKSUMS).withConfigValue(checksums));
      storedSeedDataFingerprint = seedFingerprintToStore;
      storedSearchTemplateFingerprint = searchFingerprintToStore;
      storedServerVersion = serverVersion;
    } catch (Exception exception) {
      LOG.warn("Unable to persist startup fingerprints; the next startup will retry", exception);
    }
  }

  public static String fingerprint(Map<String, String> values) {
    MessageDigest digest = sha256Digest();
    new TreeMap<>(values)
        .forEach(
            (key, value) -> {
              updateDigest(digest, key.getBytes(StandardCharsets.UTF_8));
              updateDigest(digest, value.getBytes(StandardCharsets.UTF_8));
            });
    return HexFormat.of().formatHex(digest.digest());
  }

  private String calculateSeedDataFingerprint() {
    try {
      MessageDigest digest = sha256Digest();
      SeedManifestAccumulator manifest = new SeedManifestAccumulator();
      Set<String> seedResources = new TreeSet<>(CommonUtil.getResources(SEED_RESOURCES));
      seedResources.addAll(manifest.notificationTemplateResources());
      List<String> resources = List.copyOf(seedResources);
      for (String resource : resources) {
        updateDigest(digest, resource.getBytes(StandardCharsets.UTF_8));
        try (InputStream input =
            SeedDataGate.class.getClassLoader().getResourceAsStream(resource)) {
          if (input == null) {
            throw new IOException("Missing classpath resource " + resource);
          }
          byte[] content = input.readAllBytes();
          updateDigest(digest, content);
          manifest.collect(resource, content);
        }
      }
      requiredSeedRows = manifest.build();
      updateDigest(digest, serverVersion.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest.digest());
    } catch (Exception exception) {
      requiredSeedRows = RequiredSeedRows.empty();
      LOG.warn("Unable to fingerprint seed data; seed gate will fail open", exception);
      return null;
    }
  }

  private void loadStoredChecksums() {
    storedSeedDataFingerprint = null;
    storedSearchTemplateFingerprint = null;
    storedServerVersion = null;
    if (systemRepository == null) {
      return;
    }
    Settings stored = systemRepository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString());
    if (stored == null || stored.getConfigValue() == null) {
      return;
    }
    StartupChecksums checksums =
        JsonUtils.convertValue(stored.getConfigValue(), StartupChecksums.class);
    storedSeedDataFingerprint = checksums.getSeedDataFingerprint();
    storedSearchTemplateFingerprint = checksums.getSearchTemplateFingerprint();
    storedServerVersion = checksums.getServerVersion();
  }

  private void detectSeedDataDrift() {
    if (systemRepository == null
        || !configuration.isSeedDataGateEnabled()
        || forceSeedData
        || seedDataFingerprint == null
        || !Objects.equals(seedDataFingerprint, storedSeedDataFingerprint)) {
      return;
    }
    try {
      RequiredSeedRows selectedSeedRows =
          requiredSeedRows.selectEmailDocuments(getEmailTemplateProvider());
      seedDataDriftDetected = !systemRepository.hasRequiredSeedRows(selectedSeedRows);
      if (seedDataDriftDetected) {
        LOG.warn(
            "Required seed rows are missing despite an unchanged fingerprint; running seed loaders");
      }
    } catch (Exception exception) {
      seedDataDriftDetected = true;
      LOG.warn("Unable to verify required seed rows; seed gate will fail open", exception);
    }
  }

  private String getEmailTemplateProvider() {
    Settings emailSettings =
        systemRepository.getConfigWithKey(SettingsType.EMAIL_CONFIGURATION.toString());
    if (emailSettings == null || emailSettings.getConfigValue() == null) {
      return OPENMETADATA_EMAIL_TEMPLATE_PROVIDER;
    }
    SmtpSettings smtpSettings =
        JsonUtils.convertValue(emailSettings.getConfigValue(), SmtpSettings.class);
    return smtpSettings.getTemplates() == null
        ? OPENMETADATA_EMAIL_TEMPLATE_PROVIDER
        : smtpSettings.getTemplates().value();
  }

  private static String readRequiredSeedName(String resource, JsonNode seed, boolean preferFqn)
      throws IOException {
    JsonNode allowDelete = seed.get("allowDelete");
    if (allowDelete == null || !allowDelete.isBoolean()) {
      throw new IOException("Seed resource has no allowDelete flag: " + resource);
    }
    if (allowDelete.booleanValue()) {
      return null;
    }
    String name = preferFqn ? seed.path("fullyQualifiedName").asText(null) : null;
    if (name == null || name.isBlank()) {
      name = seed.path("name").asText(null);
    }
    if (name == null || name.isBlank()) {
      throw new IOException("Seed resource has no name: " + resource);
    }
    return name;
  }

  private static String requiredText(String resource, JsonNode node, String field)
      throws IOException {
    String value = node.path(field).asText(null);
    if (value == null || value.isBlank()) {
      throw new IOException("Seed resource has no " + field + ": " + resource);
    }
    return value;
  }

  private static String quotedName(String resource, JsonNode node) throws IOException {
    return FullyQualifiedName.build(requiredText(resource, node, "name"));
  }

  private static final class SeedManifestAccumulator {
    private final EnumMap<SeedTable, Set<String>> rows = new EnumMap<>(SeedTable.class);
    private final Set<String> openMetadataEmailDocuments = new TreeSet<>();
    private final Set<String> collateEmailDocuments = new TreeSet<>();
    private final Set<String> llmModelNames = new TreeSet<>();
    private final Set<String> mcpServerNames = new TreeSet<>();
    private final Pattern notificationTemplatePattern;

    private SeedManifestAccumulator() {
      for (SeedTable table : SeedTable.values()) {
        rows.put(table, new TreeSet<>());
      }
      notificationTemplatePattern =
          Pattern.compile(
              ResourcePathResolver.getResourcePath(NotificationTemplateResourcePathProvider.class));
    }

    private List<String> notificationTemplateResources() throws IOException {
      return CommonUtil.getResources(notificationTemplatePattern);
    }

    private void collect(String resource, byte[] content) throws IOException {
      if (resource.contains(TYPE_SCHEMA_PATH) || resource.contains(ENTITY_SCHEMA_PATH)) {
        rows.get(SeedTable.TYPE).addAll(JsonUtils.getTypeNames(resource, content));
        return;
      }

      SeedTable simpleTable = simpleSeedTable(resource);
      if (simpleTable != null) {
        JsonNode seed = readSeed(resource, content);
        if (simpleTable == SeedTable.POLICY || simpleTable == SeedTable.ROLE) {
          String identity = readRequiredSeedName(resource, seed, simpleTable == SeedTable.POLICY);
          if (identity != null) {
            rows.get(simpleTable).add(identity);
          }
        } else {
          rows.get(simpleTable).add(simpleIdentity(resource, seed, simpleTable));
        }
        return;
      }

      if (resource.contains(DOCUMENT_DOCS_PATH)) {
        JsonNode seed = readSeed(resource, content);
        rows.get(SeedTable.DOCUMENT).add(requiredText(resource, seed, "fullyQualifiedName"));
      } else if (resource.contains(OPENMETADATA_EMAIL_DOCUMENT_PATH)) {
        openMetadataEmailDocuments.add(
            requiredText(resource, readSeed(resource, content), "fullyQualifiedName"));
      } else if (resource.contains(COLLATE_EMAIL_DOCUMENT_PATH)) {
        collateEmailDocuments.add(
            requiredText(resource, readSeed(resource, content), "fullyQualifiedName"));
      } else if (resource.contains(TAG_PATH)) {
        collectTags(resource, readSeed(resource, content));
      } else if (GLOSSARY_SEED_RESOURCES.matcher(resource).matches()) {
        collectGlossary(resource, readSeed(resource, content));
      } else if (resource.contains(AI_FRAMEWORK_PATH) && !resource.endsWith("/_index.json")) {
        collectAiFramework(resource, readSeed(resource, content));
      } else if (resource.contains(LLM_MODEL_PATH)) {
        llmModelNames.add(requiredText(resource, readSeed(resource, content), "name"));
      } else if (resource.contains(MCP_SERVER_PATH)) {
        mcpServerNames.add(requiredText(resource, readSeed(resource, content), "name"));
      }
    }

    private SeedTable simpleSeedTable(String resource) {
      if (resource.contains(POLICY_SEED_PATH)) {
        return SeedTable.POLICY;
      }
      if (resource.contains(ROLE_SEED_PATH)) {
        return SeedTable.ROLE;
      }
      if (resource.contains(TASK_FORM_SCHEMA_PATH)) {
        return SeedTable.TASK_FORM_SCHEMA;
      }
      if (resource.contains(WORKFLOW_DEFINITION_PATH)) {
        return SeedTable.WORKFLOW_DEFINITION;
      }
      if (resource.contains(EVENT_SUBSCRIPTION_PATH)) {
        return SeedTable.EVENT_SUBSCRIPTION;
      }
      if (notificationTemplatePattern.matcher(resource).matches()) {
        return SeedTable.NOTIFICATION_TEMPLATE;
      }
      if (resource.contains(LEARNING_RESOURCE_PATH)) {
        return SeedTable.LEARNING_RESOURCE;
      }
      if (resource.contains(TEST_DEFINITION_PATH)) {
        return SeedTable.TEST_DEFINITION;
      }
      if (resource.contains(TEST_CONNECTION_DEFINITION_PATH)) {
        return SeedTable.TEST_CONNECTION_DEFINITION;
      }
      if (resource.contains(WEB_ANALYTIC_EVENT_PATH)) {
        return SeedTable.WEB_ANALYTIC_EVENT;
      }
      if (resource.contains(DATA_INSIGHT_CUSTOM_CHART_PATH)) {
        return SeedTable.DATA_INSIGHT_CUSTOM_CHART;
      }
      if (DATA_INSIGHT_CHART_SEED_RESOURCES.matcher(resource).matches()) {
        return SeedTable.DATA_INSIGHT_CHART;
      }
      if (resource.contains(BOT_PATH)) {
        return SeedTable.BOT;
      }
      if (resource.contains(AI_POLICY_PATH)) {
        return SeedTable.AI_GOVERNANCE_POLICY;
      }
      if (resource.contains(AI_APPLICATION_PATH)
          || (resource.contains(AI_SHADOW_APPLICATION_PATH)
              && !resource.endsWith("/_service.json")
              && !resource.endsWith("/_model.json"))) {
        return SeedTable.AI_APPLICATION;
      }
      if (resource.contains(LLM_SERVICE_PATH)) {
        return SeedTable.LLM_SERVICE;
      }
      if (resource.contains(MCP_SERVICE_PATH)) {
        return SeedTable.MCP_SERVICE;
      }
      return null;
    }

    private static String simpleIdentity(String resource, JsonNode seed, SeedTable seedTable)
        throws IOException {
      if (seedTable == SeedTable.TEST_CONNECTION_DEFINITION) {
        return requiredText(resource, seed, "name") + ".testConnectionDefinition";
      }
      if (seedTable == SeedTable.DATA_INSIGHT_CUSTOM_CHART) {
        return requiredText(resource, seed, "name");
      }
      if (seedTable == SeedTable.LEARNING_RESOURCE) {
        String fullyQualifiedName = seed.path("fullyQualifiedName").asText(null);
        if (fullyQualifiedName != null && !fullyQualifiedName.isBlank()) {
          return fullyQualifiedName;
        }
      }
      return quotedName(resource, seed);
    }

    private void collectTags(String resource, JsonNode seed) throws IOException {
      JsonNode classification = seed.path("createClassification");
      String classificationName = requiredText(resource, classification, "name");
      rows.get(SeedTable.CLASSIFICATION).add(FullyQualifiedName.build(classificationName));
      JsonNode tags = seed.path("createTags");
      if (!tags.isArray()) {
        throw new IOException("Seed resource has no createTags array: " + resource);
      }
      for (JsonNode tag : tags) {
        String name = requiredText(resource, tag, "name");
        String parent = tag.path("parent").asText(null);
        rows.get(SeedTable.TAG)
            .add(
                parent == null || parent.isBlank()
                    ? FullyQualifiedName.build(classificationName, name)
                    : FullyQualifiedName.add(parent, name));
      }
    }

    private void collectGlossary(String resource, JsonNode seed) throws IOException {
      JsonNode createGlossary = seed.path("createGlossary");
      if (createGlossary.isMissingNode()) {
        return;
      }
      String glossaryName = requiredText(resource, createGlossary, "name");
      rows.get(SeedTable.GLOSSARY).add(FullyQualifiedName.build(glossaryName));
      JsonNode terms = seed.path("createTerms");
      if (!terms.isArray()) {
        throw new IOException("Seed resource has no createTerms array: " + resource);
      }
      for (JsonNode term : terms) {
        String name = requiredText(resource, term, "name");
        String parent = term.path("parent").asText(null);
        rows.get(SeedTable.GLOSSARY_TERM)
            .add(
                parent == null || parent.isBlank()
                    ? FullyQualifiedName.build(glossaryName, name)
                    : FullyQualifiedName.add(parent, name));
      }
    }

    private void collectAiFramework(String resource, JsonNode seed) throws IOException {
      JsonNode framework = seed.path("framework");
      if (framework.isMissingNode()) {
        throw new IOException("Seed resource has no framework: " + resource);
      }
      String frameworkFqn = quotedName(resource, framework);
      rows.get(SeedTable.AI_GOVERNANCE_FRAMEWORK).add(frameworkFqn);
      JsonNode controls = seed.path("controls");
      if (!controls.isArray()) {
        throw new IOException("Seed resource has no controls array: " + resource);
      }
      for (JsonNode control : controls) {
        rows.get(SeedTable.AI_FRAMEWORK_CONTROL)
            .add(FullyQualifiedName.add(frameworkFqn, requiredText(resource, control, "name")));
      }
    }

    private RequiredSeedRows build() throws IOException {
      qualifyChildren(SeedTable.LLM_SERVICE, SeedTable.LLM_MODEL, llmModelNames);
      qualifyChildren(SeedTable.MCP_SERVICE, SeedTable.MCP_SERVER, mcpServerNames);
      for (SeedTable requiredTable : REQUIRED_SEED_TABLES) {
        if (rows.get(requiredTable).isEmpty()) {
          throw new IOException("Required seed resources are missing for " + requiredTable);
        }
      }
      EnumMap<SeedTable, List<String>> sortedRows = new EnumMap<>(SeedTable.class);
      rows.forEach((table, identities) -> sortedRows.put(table, List.copyOf(identities)));
      return new RequiredSeedRows(
          sortedRows, List.copyOf(openMetadataEmailDocuments), List.copyOf(collateEmailDocuments));
    }

    private void qualifyChildren(
        SeedTable serviceTable, SeedTable childTable, Set<String> childNames) throws IOException {
      if (childNames.isEmpty()) {
        return;
      }
      Set<String> services = rows.get(serviceTable);
      if (services.size() != 1) {
        throw new IOException("Expected one seed service for " + childTable);
      }
      String service = services.iterator().next();
      childNames.forEach(
          childName -> rows.get(childTable).add(FullyQualifiedName.add(service, childName)));
    }

    private static JsonNode readSeed(String resource, byte[] content) throws IOException {
      try {
        return JsonUtils.readTree(new String(content, StandardCharsets.UTF_8));
      } catch (Exception exception) {
        throw new IOException("Unable to parse seed resource " + resource, exception);
      }
    }
  }

  private static MessageDigest sha256Digest() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }

  private static void updateDigest(MessageDigest digest, byte[] bytes) {
    digest.update(bytes);
    digest.update((byte) 0);
  }
}
