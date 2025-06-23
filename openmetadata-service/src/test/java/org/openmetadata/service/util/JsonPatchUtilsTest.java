package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;
import static org.openmetadata.common.utils.CommonUtil.listOf;

import com.github.fge.jsonpatch.JsonPatchException;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonPatch;
import jakarta.json.JsonReader;
import java.io.IOException;
import java.io.StringReader;
import java.util.Set;
import java.util.UUID;
import org.jetbrains.annotations.NotNull;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JsonPatchUtilsTest {
  private Table originalTable;
  @Mock private ResourceContextInterface resourceContextMock;

  @BeforeEach
  public void setup() {
    // Initialize a sample Table entity
    originalTable = new Table();
    originalTable.setName("sample_table");
    originalTable.setDescription("A sample table");
    originalTable.setOwners(
        listOf(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withName("john")
                .withType(Entity.USER)));

    TagLabel topTag = new TagLabel();
    topTag.setTagFQN("Tier.Bronze");
    topTag.setSource(TagLabel.TagSource.CLASSIFICATION);
    topTag.setLabelType(TagLabel.LabelType.MANUAL);
    topTag.setState(TagLabel.State.CONFIRMED);
    originalTable.setTags(listOf(topTag));

    Column column = new Column();
    column.setName("column1");

    TagLabel columnTag = new TagLabel();
    columnTag.setTagFQN("Business Glossary.Term1");
    columnTag.setSource(TagLabel.TagSource.GLOSSARY);
    columnTag.setLabelType(TagLabel.LabelType.MANUAL);
    columnTag.setState(TagLabel.State.CONFIRMED);
    column.setTags(listOf(columnTag));

    originalTable.setColumns(listOf(column));

    when(resourceContextMock.getEntity()).thenReturn(originalTable);
  }

  @Test
  void testGetMetadataOperation() {
    Object[][] patchPathToOperations = {
      {"/" + Entity.FIELD_DESCRIPTION, MetadataOperation.EDIT_DESCRIPTION},
      {"/" + Entity.FIELD_DISPLAY_NAME, MetadataOperation.EDIT_DISPLAY_NAME},
      {"/" + Entity.FIELD_TAGS, MetadataOperation.EDIT_TAGS},
      {"/Unknown", MetadataOperation.EDIT_ALL} // Unknown fields map to EDIT_ALL
    };
    for (Object[] patchPathToOperation : patchPathToOperations) {
      assertEquals(
          patchPathToOperation[1],
          JsonPatchUtils.getMetadataOperation((String) patchPathToOperation[0]));
    }
  }

  @Test
  void testAddClassificationTag() throws JsonPatchException, IOException {
    // Create a patch to add a new Classification tag
    String patchString =
        "[\n"
            + "  {\n"
            + "    \"op\": \"add\",\n"
            + "    \"path\": \"/tags/-\",\n"
            + "    \"value\": {\n"
            + "      \"tagFQN\": \"PII.Sensitive\",\n"
            + "      \"source\": \"Classification\",\n"
            + "      \"labelType\": \"Manual\",\n"
            + "      \"state\": \"Confirmed\"\n"
            + "    }\n"
            + "  }\n"
            + "]";
    JsonPatch patch;
    try (JsonReader jsonReader = Json.createReader(new StringReader(patchString))) {
      JsonArray patchArray = jsonReader.readArray();
      patch = Json.createPatch(patchArray);
    }

    // Determine MetadataOperations
    Set<MetadataOperation> operations =
        JsonPatchUtils.getMetadataOperations(resourceContextMock, patch);

    // Assertions
    assertTrue(operations.contains(MetadataOperation.EDIT_TAGS));
    assertEquals(1, operations.size());
  }

  @Test
  void testRemoveGlossaryTag() throws JsonPatchException, IOException {
    // Create a patch to remove the Glossary tag
    String patchString =
        "[\n"
            + "  {\n"
            + "    \"op\": \"remove\",\n"
            + "    \"path\": \"/columns/0/tags/0\"\n"
            + "  }\n"
            + "]";
    JsonPatch patch;
    try (JsonReader jsonReader = Json.createReader(new StringReader(patchString))) {
      JsonArray patchArray = jsonReader.readArray();
      patch = Json.createPatch(patchArray);
    }

    // Determine MetadataOperations
    Set<MetadataOperation> operations =
        JsonPatchUtils.getMetadataOperations(resourceContextMock, patch);

    // Assertions
    assertTrue(operations.contains(MetadataOperation.EDIT_GLOSSARY_TERMS));
    assertEquals(1, operations.size());
  }

  @Test
  void testAddClassificationAndRemoveGlossaryTag() throws IOException {
    // Create a patch to add a Classification tag and remove a Glossary tag
    String patchString =
        "[\n"
            + "  {\n"
            + "    \"op\": \"add\",\n"
            + "    \"path\": \"/tags/-\",\n"
            + "    \"value\": {\n"
            + "      \"tagFQN\": \"PII.None\",\n"
            + "      \"source\": \"Classification\",\n"
            + "      \"labelType\": \"Manual\",\n"
            + "      \"state\": \"Confirmed\"\n"
            + "    }\n"
            + "  },\n"
            + "  {\n"
            + "    \"op\": \"remove\",\n"
            + "    \"path\": \"/columns/0/tags/0\"\n"
            + "  }\n"
            + "]";
    JsonPatch patch;
    try (JsonReader jsonReader = Json.createReader(new StringReader(patchString))) {
      JsonArray patchArray = jsonReader.readArray();
      patch = Json.createPatch(patchArray);
    }

    // Determine MetadataOperations
    Set<MetadataOperation> operations =
        JsonPatchUtils.getMetadataOperations(resourceContextMock, patch);

    // Assertions
    assertTrue(operations.contains(MetadataOperation.EDIT_TAGS));
    assertTrue(operations.contains(MetadataOperation.EDIT_GLOSSARY_TERMS));
    assertEquals(2, operations.size());
  }

  @Test
  void testReplaceTierTag() throws JsonPatchException, IOException {
    // Create a patch to replace the Tier tag
    String patchString =
        "[\n"
            + "  {\n"
            + "    \"op\": \"replace\",\n"
            + "    \"path\": \"/tags/0/tagFQN\",\n"
            + "    \"value\": \"Tier.Silver\"\n"
            + "  }\n"
            + "]";
    JsonPatch patch;
    try (JsonReader jsonReader = Json.createReader(new StringReader(patchString))) {
      JsonArray patchArray = jsonReader.readArray();
      patch = Json.createPatch(patchArray);
    }

    // Determine MetadataOperations
    Set<MetadataOperation> operations =
        JsonPatchUtils.getMetadataOperations(resourceContextMock, patch);

    // Assertions
    assertTrue(operations.contains(MetadataOperation.EDIT_TIER));
    assertEquals(1, operations.size());
  }

  @Test
  void testModifyNonTagField() throws JsonPatchException, IOException {
    // Create a patch to modify a non-tag field (e.g., description)
    String patchString =
        "[\n"
            + "  {\n"
            + "    \"op\": \"replace\",\n"
            + "    \"path\": \"/description\",\n"
            + "    \"value\": \"Updated table description\"\n"
            + "  }\n"
            + "]";
    JsonPatch patch;
    try (JsonReader jsonReader = Json.createReader(new StringReader(patchString))) {
      JsonArray patchArray = jsonReader.readArray();
      patch = Json.createPatch(patchArray);
    }

    // Determine MetadataOperations
    Set<MetadataOperation> operations =
        JsonPatchUtils.getMetadataOperations(resourceContextMock, patch);

    // Assertions
    assertTrue(operations.contains(MetadataOperation.EDIT_DESCRIPTION));
    assertEquals(1, operations.size());
  }

  @Test
  void testAddClassificationTagAtColumn() throws Exception {
    // Create a patch to add a new Classification tag
    String patchString =
        "[\n"
            + "  {\n"
            + "    \"op\": \"add\",\n"
            + "    \"path\": \"/columns/0/tags/-\",\n"
            + "    \"value\": {\n"
            + "      \"tagFQN\": \"PII.Sensitive\",\n"
            + "      \"name\": \"Sensitive\",\n"
            + "      \"description\": \"PII which if lost, compromised, or disclosed without authorization, could result in substantial harm, embarrassment, inconvenience, or unfairness to an individual.\",\n"
            + "      \"source\": \"Classification\",\n"
            + "      \"labelType\": \"Manual\",\n"
            + "      \"state\": \"Confirmed\"\n"
            + "    }\n"
            + "  },\n"
            + "  {\n"
            + "    \"op\": \"add\",\n"
            + "    \"path\": \"/columns/0/tags/-\",\n"
            + "    \"value\": {\n"
            + "      \"tagFQN\": \"PersonalData.Personal\",\n"
            + "      \"name\": \"Personal\",\n"
            + "      \"description\": \"Data that can be used to directly or indirectly identify a person.\",\n"
            + "      \"source\": \"Classification\",\n"
            + "      \"labelType\": \"Manual\",\n"
            + "      \"state\": \"Confirmed\"\n"
            + "    }\n"
            + "  }\n"
            + "]";

    // Parse the patch string into javax.json.JsonPatch
    JsonPatch patch;
    try (JsonReader jsonReader = Json.createReader(new StringReader(patchString))) {
      JsonArray patchArray = jsonReader.readArray();
      patch = Json.createPatch(patchArray);
    }

    // Determine MetadataOperations using the overloaded method
    Set<MetadataOperation> operations =
        JsonPatchUtils.getMetadataOperations(resourceContextMock, patch);

    // Assertions
    assertTrue(
        operations.contains(MetadataOperation.EDIT_TAGS),
        "MetadataOperations should contain EDIT_TAGS");
    assertEquals(1, operations.size(), "There should be exactly one MetadataOperation");
  }

  @Test
  void testAddCertificationTag() throws JsonPatchException, IOException {
    // Create a patch to add a new Certification tag
    long currentTime = System.currentTimeMillis();
    String patchString = getPatchString(currentTime, "    \"op\": \"add\",\n");
    JsonPatch patch;
    try (JsonReader jsonReader = Json.createReader(new StringReader(patchString))) {
      JsonArray patchArray = jsonReader.readArray();
      patch = Json.createPatch(patchArray);
    }

    // Determine MetadataOperations
    Set<MetadataOperation> operations =
        JsonPatchUtils.getMetadataOperations(resourceContextMock, patch);

    // Assertions
    assertTrue(operations.contains(MetadataOperation.EDIT_CERTIFICATION));
    assertEquals(1, operations.size());
  }

  @Test
  void testReplaceCertificationTag() throws JsonPatchException, IOException {
    // Create a patch to replace the Certification tag
    long currentTime = System.currentTimeMillis();
    String patchString = getPatchString(currentTime, "    \"op\": \"replace\",\n");
    JsonPatch patch;
    try (JsonReader jsonReader = Json.createReader(new StringReader(patchString))) {
      JsonArray patchArray = jsonReader.readArray();
      patch = Json.createPatch(patchArray);
    }

    // Determine MetadataOperations
    Set<MetadataOperation> operations =
        JsonPatchUtils.getMetadataOperations(resourceContextMock, patch);

    // Assertions
    assertTrue(operations.contains(MetadataOperation.EDIT_CERTIFICATION));
    assertEquals(1, operations.size());
  }

  @Test
  void testRemoveCertificationTag() throws JsonPatchException, IOException {
    // Create a patch to remove the Certification tag
    String patchString =
        """
            [
              {
                "op": "remove",
                "path": "/certification"
              }
            ]""";
    JsonPatch patch;
    try (JsonReader jsonReader = Json.createReader(new StringReader(patchString))) {
      JsonArray patchArray = jsonReader.readArray();
      patch = Json.createPatch(patchArray);
    }

    // Determine MetadataOperations
    Set<MetadataOperation> operations =
        JsonPatchUtils.getMetadataOperations(resourceContextMock, patch);
    // Assertions
    assertTrue(operations.contains(MetadataOperation.EDIT_CERTIFICATION));
    assertEquals(1, operations.size());
  }

  private static @NotNull String getPatchString(long currentTime, String operationString) {
    long oneYearInMillis = 365L * 24 * 60 * 60 * 1000;
    long expiryTime = currentTime + oneYearInMillis;
    return "[\n"
        + "  {\n"
        + operationString
        + "    \"path\": \"/certification\",\n"
        + "    \"value\": {\n"
        + "      \"tagLabel\": {\n"
        + "        \"tagFQN\": \"Certification.Gold\",\n"
        + "        \"labelType\": \"Manual\",\n"
        + "        \"state\": \"Confirmed\"\n"
        + "      },\n"
        + "      \"appliedDate\": "
        + currentTime
        + ",\n"
        + "      \"expiryDate\": "
        + expiryTime
        + "\n"
        + "    }\n"
        + "  }\n"
        + "]";
  }
}
