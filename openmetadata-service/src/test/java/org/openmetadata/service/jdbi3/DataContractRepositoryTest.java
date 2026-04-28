package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.mock;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.QualityValidation;
import org.openmetadata.schema.entity.datacontract.SchemaValidation;
import org.openmetadata.schema.entity.datacontract.SemanticsValidation;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;

class DataContractRepositoryTest {
  private static DataContractRepository repository;

  @BeforeAll
  static void setup() {
    repository = mock(DataContractRepository.class);
    doCallRealMethod().when(repository).isEntityTypeSupported(anyString());
  }

  @SuppressWarnings("unchecked")
  private <T> T invoke(String methodName, Class<?>[] paramTypes, Object... args) throws Exception {
    Method method = DataContractRepository.class.getDeclaredMethod(methodName, paramTypes);
    method.setAccessible(true);
    return (T) method.invoke(repository, args);
  }

  // --- getTestSuiteName ---

  @Test
  void testGetTestSuiteName() {
    DataContract contract = new DataContract();
    UUID id = UUID.randomUUID();
    contract.setId(id);
    assertEquals(id.toString(), DataContractRepository.getTestSuiteName(contract));
  }

  // --- areTypesCompatible ---

  @Test
  void testAreTypesCompatible_sameType() throws Exception {
    assertTrue(invokeAreTypesCompatible(ColumnDataType.STRING, ColumnDataType.STRING));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.INT, ColumnDataType.INT));
  }

  @Test
  void testAreTypesCompatible_nullTypes() throws Exception {
    assertTrue(invokeAreTypesCompatible(null, ColumnDataType.STRING));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.STRING, null));
    assertTrue(invokeAreTypesCompatible(null, null));
  }

  @Test
  void testAreTypesCompatible_stringFamily() throws Exception {
    assertTrue(invokeAreTypesCompatible(ColumnDataType.STRING, ColumnDataType.VARCHAR));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.CHAR, ColumnDataType.TEXT));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.MEDIUMTEXT, ColumnDataType.CLOB));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.NTEXT, ColumnDataType.STRING));
  }

  @Test
  void testAreTypesCompatible_integerFamily() throws Exception {
    assertTrue(invokeAreTypesCompatible(ColumnDataType.INT, ColumnDataType.BIGINT));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.SMALLINT, ColumnDataType.TINYINT));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.BYTEINT, ColumnDataType.LONG));
  }

  @Test
  void testAreTypesCompatible_decimalFamily() throws Exception {
    assertTrue(invokeAreTypesCompatible(ColumnDataType.DECIMAL, ColumnDataType.NUMERIC));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.NUMBER, ColumnDataType.DOUBLE));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.FLOAT, ColumnDataType.MONEY));
  }

  @Test
  void testAreTypesCompatible_booleanFamily() throws Exception {
    assertTrue(invokeAreTypesCompatible(ColumnDataType.BOOLEAN, ColumnDataType.BOOLEAN));
  }

  @Test
  void testAreTypesCompatible_dateTimeFamily() throws Exception {
    assertTrue(invokeAreTypesCompatible(ColumnDataType.DATE, ColumnDataType.DATETIME));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.TIMESTAMP, ColumnDataType.TIMESTAMPZ));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.TIME, ColumnDataType.DATE));
  }

  @Test
  void testAreTypesCompatible_binaryFamily() throws Exception {
    assertTrue(invokeAreTypesCompatible(ColumnDataType.BINARY, ColumnDataType.VARBINARY));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.BLOB, ColumnDataType.BYTEA));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.BYTES, ColumnDataType.LONGBLOB));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.MEDIUMBLOB, ColumnDataType.BINARY));
  }

  @Test
  void testAreTypesCompatible_complexFamily() throws Exception {
    assertTrue(invokeAreTypesCompatible(ColumnDataType.ARRAY, ColumnDataType.MAP));
    assertTrue(invokeAreTypesCompatible(ColumnDataType.STRUCT, ColumnDataType.JSON));
  }

  @Test
  void testAreTypesCompatible_incompatibleTypes() throws Exception {
    assertFalse(invokeAreTypesCompatible(ColumnDataType.STRING, ColumnDataType.INT));
    assertFalse(invokeAreTypesCompatible(ColumnDataType.BOOLEAN, ColumnDataType.DATE));
    assertFalse(invokeAreTypesCompatible(ColumnDataType.DECIMAL, ColumnDataType.BINARY));
    assertFalse(invokeAreTypesCompatible(ColumnDataType.ARRAY, ColumnDataType.STRING));
    assertFalse(invokeAreTypesCompatible(ColumnDataType.INT, ColumnDataType.DOUBLE));
  }

  private boolean invokeAreTypesCompatible(ColumnDataType t1, ColumnDataType t2) throws Exception {
    return invoke(
        "areTypesCompatible", new Class[] {ColumnDataType.class, ColumnDataType.class}, t1, t2);
  }

  // --- findDuplicateColumnNames ---

  @Test
  void testFindDuplicateColumnNames_noDuplicates() throws Exception {
    DataContract contract = contractWithSchema("col_a", "col_b", "col_c");
    List<String> result =
        invoke("findDuplicateColumnNames", new Class[] {DataContract.class}, contract);
    assertTrue(result.isEmpty());
  }

  @Test
  void testFindDuplicateColumnNames_withDuplicates() throws Exception {
    DataContract contract = contractWithSchema("col_a", "col_b", "col_a", "col_c", "col_b");
    List<String> result =
        invoke("findDuplicateColumnNames", new Class[] {DataContract.class}, contract);
    assertEquals(2, result.size());
    assertTrue(result.contains("col_a"));
    assertTrue(result.contains("col_b"));
  }

  @Test
  void testFindDuplicateColumnNames_tripleDuplicate() throws Exception {
    DataContract contract = contractWithSchema("col_a", "col_a", "col_a");
    List<String> result =
        invoke("findDuplicateColumnNames", new Class[] {DataContract.class}, contract);
    assertEquals(1, result.size());
    assertEquals("col_a", result.get(0));
  }

  // --- buildColumnMap ---

  @Test
  void testBuildColumnMap_flat() throws Exception {
    List<Column> columns =
        List.of(column("id", ColumnDataType.INT), column("name", ColumnDataType.STRING));
    Map<String, Column> result = invoke("buildColumnMap", new Class[] {List.class}, columns);
    assertEquals(2, result.size());
    assertNotNull(result.get("id"));
    assertNotNull(result.get("name"));
  }

  @Test
  void testBuildColumnMap_nested() throws Exception {
    Column child = column("nested_col", ColumnDataType.STRING);
    Column parent = column("parent", ColumnDataType.STRUCT);
    parent.setChildren(List.of(child));
    List<Column> columns = List.of(parent);
    Map<String, Column> result = invoke("buildColumnMap", new Class[] {List.class}, columns);
    assertEquals(2, result.size());
    assertNotNull(result.get("parent"));
    assertNotNull(result.get("nested_col"));
  }

  @Test
  void testBuildColumnMap_nullOrEmpty() throws Exception {
    Map<String, Column> result1 = invoke("buildColumnMap", new Class[] {List.class}, (Object) null);
    assertTrue(result1.isEmpty());
    Map<String, Column> result2 =
        invoke("buildColumnMap", new Class[] {List.class}, Collections.emptyList());
    assertTrue(result2.isEmpty());
  }

  // --- extractFieldNames ---

  @Test
  void testExtractFieldNames_flat() throws Exception {
    List<org.openmetadata.schema.type.Field> fields = List.of(field("field1"), field("field2"));
    Set<String> result = invoke("extractFieldNames", new Class[] {List.class}, fields);
    assertEquals(Set.of("field1", "field2"), result);
  }

  @Test
  void testExtractFieldNames_nested() throws Exception {
    org.openmetadata.schema.type.Field child = field("child");
    org.openmetadata.schema.type.Field parent = field("parent");
    parent.setChildren(List.of(child));
    List<org.openmetadata.schema.type.Field> fields = List.of(parent);
    Set<String> result = invoke("extractFieldNames", new Class[] {List.class}, fields);
    assertEquals(Set.of("parent", "child"), result);
  }

  @Test
  void testExtractFieldNames_nullOrEmpty() throws Exception {
    Set<String> result1 = invoke("extractFieldNames", new Class[] {List.class}, (Object) null);
    assertTrue(result1.isEmpty());
    Set<String> result2 =
        invoke("extractFieldNames", new Class[] {List.class}, Collections.emptyList());
    assertTrue(result2.isEmpty());
  }

  // --- extractColumnNames ---

  @Test
  void testExtractColumnNames_flat() throws Exception {
    List<Column> columns =
        List.of(column("col1", ColumnDataType.INT), column("col2", ColumnDataType.STRING));
    Set<String> result = invoke("extractColumnNames", new Class[] {List.class}, columns);
    assertEquals(Set.of("col1", "col2"), result);
  }

  @Test
  void testExtractColumnNames_nested() throws Exception {
    Column child = column("child_col", ColumnDataType.INT);
    Column parent = column("parent_col", ColumnDataType.STRUCT);
    parent.setChildren(List.of(child));
    Set<String> result = invoke("extractColumnNames", new Class[] {List.class}, List.of(parent));
    assertEquals(Set.of("parent_col", "child_col"), result);
  }

  @Test
  void testExtractColumnNames_nullOrEmpty() throws Exception {
    Set<String> result1 = invoke("extractColumnNames", new Class[] {List.class}, (Object) null);
    assertTrue(result1.isEmpty());
    Set<String> result2 =
        invoke("extractColumnNames", new Class[] {List.class}, Collections.emptyList());
    assertTrue(result2.isEmpty());
  }

  // --- getAllContractFieldNames ---

  @Test
  void testGetAllContractFieldNames() throws Exception {
    DataContract contract = contractWithSchema("a", "b", "c");
    List<String> result =
        invoke("getAllContractFieldNames", new Class[] {DataContract.class}, contract);
    assertEquals(List.of("a", "b", "c"), result);
  }

  // --- validateContractFieldsAgainstNames ---

  @Test
  void testValidateContractFieldsAgainstNames_allPresent() throws Exception {
    DataContract contract = contractWithSchema("col1", "col2");
    Set<String> entityFields = Set.of("col1", "col2", "col3");
    List<String> result =
        invoke(
            "validateContractFieldsAgainstNames",
            new Class[] {DataContract.class, Set.class},
            contract,
            entityFields);
    assertTrue(result.isEmpty());
  }

  @Test
  void testValidateContractFieldsAgainstNames_missingFields() throws Exception {
    DataContract contract = contractWithSchema("col1", "col2", "col3");
    Set<String> entityFields = Set.of("col1");
    List<String> result =
        invoke(
            "validateContractFieldsAgainstNames",
            new Class[] {DataContract.class, Set.class},
            contract,
            entityFields);
    assertEquals(2, result.size());
    assertTrue(result.contains("col2"));
    assertTrue(result.contains("col3"));
  }

  // --- isSupportedEntityType ---

  @Test
  void testIsSupportedEntityType_supported() throws Exception {
    assertTrue(invokeIsSupportedEntityType(Entity.TABLE));
    assertTrue(invokeIsSupportedEntityType(Entity.TOPIC));
    assertTrue(invokeIsSupportedEntityType(Entity.PIPELINE));
    assertTrue(invokeIsSupportedEntityType(Entity.DASHBOARD));
    assertTrue(invokeIsSupportedEntityType(Entity.API_ENDPOINT));
    assertTrue(invokeIsSupportedEntityType(Entity.DASHBOARD_DATA_MODEL));
    assertTrue(invokeIsSupportedEntityType(Entity.MLMODEL));
    assertTrue(invokeIsSupportedEntityType(Entity.CONTAINER));
    assertTrue(invokeIsSupportedEntityType(Entity.STORED_PROCEDURE));
    assertTrue(invokeIsSupportedEntityType(Entity.DATABASE));
    assertTrue(invokeIsSupportedEntityType(Entity.DATABASE_SCHEMA));
    assertTrue(invokeIsSupportedEntityType(Entity.SEARCH_INDEX));
    assertTrue(invokeIsSupportedEntityType(Entity.API_COLLECTION));
    assertTrue(invokeIsSupportedEntityType(Entity.API));
    assertTrue(invokeIsSupportedEntityType(Entity.DIRECTORY));
    assertTrue(invokeIsSupportedEntityType(Entity.FILE));
    assertTrue(invokeIsSupportedEntityType(Entity.SPREADSHEET));
    assertTrue(invokeIsSupportedEntityType(Entity.WORKSHEET));
    assertTrue(invokeIsSupportedEntityType(Entity.DATA_PRODUCT));
    assertTrue(invokeIsSupportedEntityType(Entity.CHART));
  }

  @Test
  void testIsSupportedEntityType_unsupported() throws Exception {
    assertFalse(invokeIsSupportedEntityType(Entity.USER));
    assertFalse(invokeIsSupportedEntityType(Entity.TEAM));
    assertFalse(invokeIsSupportedEntityType("unknown_entity"));
  }

  private boolean invokeIsSupportedEntityType(String entityType) throws Exception {
    return invoke("isEntityTypeSupported", new Class[] {String.class}, entityType);
  }

  // --- supportsSchemaValidation ---

  @Test
  void testSupportsSchemaValidation() throws Exception {
    assertTrue(invokeSupportsSchemaValidation(Entity.TABLE));
    assertTrue(invokeSupportsSchemaValidation(Entity.TOPIC));
    assertTrue(invokeSupportsSchemaValidation(Entity.API_ENDPOINT));
    assertTrue(invokeSupportsSchemaValidation(Entity.DASHBOARD_DATA_MODEL));
    assertFalse(invokeSupportsSchemaValidation(Entity.PIPELINE));
    assertFalse(invokeSupportsSchemaValidation(Entity.DASHBOARD));
  }

  private boolean invokeSupportsSchemaValidation(String entityType) throws Exception {
    return invoke("supportsSchemaValidation", new Class[] {String.class}, entityType);
  }

  // --- supportsQualityValidation ---

  @Test
  void testSupportsQualityValidation() throws Exception {
    assertTrue(invokeSupportsQualityValidation(Entity.TABLE));
    assertFalse(invokeSupportsQualityValidation(Entity.TOPIC));
    assertFalse(invokeSupportsQualityValidation(Entity.PIPELINE));
  }

  private boolean invokeSupportsQualityValidation(String entityType) throws Exception {
    return invoke("supportsQualityValidation", new Class[] {String.class}, entityType);
  }

  // --- validateEntitySpecificConstraints ---

  @Test
  void testValidateEntitySpecificConstraints_unsupportedEntityType() {
    DataContract contract = new DataContract();
    EntityReference entityRef = new EntityReference().withType(Entity.USER);

    InvocationTargetException ex =
        assertThrows(
            InvocationTargetException.class,
            () ->
                invoke(
                    "validateEntitySpecificConstraints",
                    new Class[] {DataContract.class, EntityReference.class},
                    contract,
                    entityRef));
    assertTrue(ex.getCause() instanceof BadRequestException);
    assertTrue(ex.getCause().getMessage().contains("not supported for data contracts"));
  }

  @Test
  void testValidateEntitySpecificConstraints_schemaNotSupportedForPipeline() {
    DataContract contract = contractWithSchema("col1");
    EntityReference entityRef = new EntityReference().withType(Entity.PIPELINE);

    InvocationTargetException ex =
        assertThrows(
            InvocationTargetException.class,
            () ->
                invoke(
                    "validateEntitySpecificConstraints",
                    new Class[] {DataContract.class, EntityReference.class},
                    contract,
                    entityRef));
    assertTrue(ex.getCause() instanceof BadRequestException);
    assertTrue(ex.getCause().getMessage().contains("Schema validation is not supported"));
  }

  @Test
  void testValidateEntitySpecificConstraints_qualityNotSupportedForTopic() {
    DataContract contract = new DataContract();
    contract.setQualityExpectations(List.of(new EntityReference().withId(UUID.randomUUID())));
    EntityReference entityRef = new EntityReference().withType(Entity.TOPIC);

    InvocationTargetException ex =
        assertThrows(
            InvocationTargetException.class,
            () ->
                invoke(
                    "validateEntitySpecificConstraints",
                    new Class[] {DataContract.class, EntityReference.class},
                    contract,
                    entityRef));
    assertTrue(ex.getCause() instanceof BadRequestException);
    assertTrue(ex.getCause().getMessage().contains("Quality expectations are not supported"));
  }

  @Test
  void testValidateEntitySpecificConstraints_tableSupportsAll() {
    DataContract contract = contractWithSchema("col1");
    contract.setQualityExpectations(List.of(new EntityReference().withId(UUID.randomUUID())));
    EntityReference entityRef = new EntityReference().withType(Entity.TABLE);

    assertDoesNotThrow(
        () ->
            invoke(
                "validateEntitySpecificConstraints",
                new Class[] {DataContract.class, EntityReference.class},
                contract,
                entityRef));
  }

  @Test
  void testValidateEntitySpecificConstraints_emptySchemaAndQuality() {
    DataContract contract = new DataContract();
    EntityReference entityRef = new EntityReference().withType(Entity.PIPELINE);

    assertDoesNotThrow(
        () ->
            invoke(
                "validateEntitySpecificConstraints",
                new Class[] {DataContract.class, EntityReference.class},
                contract,
                entityRef));
  }

  // --- contractHasTestSuite ---

  @Test
  void testContractHasTestSuite() throws Exception {
    DataContract withSuite = new DataContract();
    withSuite.setTestSuite(new EntityReference().withId(UUID.randomUUID()));
    Boolean hasSuite = invoke("contractHasTestSuite", new Class[] {DataContract.class}, withSuite);
    assertTrue(hasSuite);

    DataContract withoutSuite = new DataContract();
    Boolean noSuite =
        invoke("contractHasTestSuite", new Class[] {DataContract.class}, withoutSuite);
    assertFalse(noSuite);
  }

  // --- filterTestsWithoutResults / filterTestsWithResults ---

  @Test
  void testFilterTestsWithoutResults() throws Exception {
    TestCase withResult = new TestCase();
    withResult.setTestCaseResult(new TestCaseResult().withTestCaseStatus(TestCaseStatus.Success));

    TestCase withoutResult = new TestCase();

    TestCase withNullStatus = new TestCase();
    withNullStatus.setTestCaseResult(new TestCaseResult());

    List<TestCase> tests = List.of(withResult, withoutResult, withNullStatus);
    List<TestCase> result = invoke("filterTestsWithoutResults", new Class[] {List.class}, tests);
    assertEquals(2, result.size());
    assertTrue(result.contains(withoutResult));
    assertTrue(result.contains(withNullStatus));
  }

  @Test
  void testFilterTestsWithResults() throws Exception {
    TestCase withResult = new TestCase();
    withResult.setTestCaseResult(new TestCaseResult().withTestCaseStatus(TestCaseStatus.Success));

    TestCase withoutResult = new TestCase();

    List<TestCase> tests = List.of(withResult, withoutResult);
    List<TestCase> result = invoke("filterTestsWithResults", new Class[] {List.class}, tests);
    assertEquals(1, result.size());
    assertTrue(result.contains(withResult));
  }

  // --- initDQValidation ---

  @Test
  void testInitDQValidation() throws Exception {
    DataContract contract = new DataContract();
    contract.setQualityExpectations(
        List.of(
            new EntityReference().withId(UUID.randomUUID()),
            new EntityReference().withId(UUID.randomUUID()),
            new EntityReference().withId(UUID.randomUUID())));

    QualityValidation result =
        invoke("initDQValidation", new Class[] {DataContract.class}, contract);

    assertEquals(3, result.getTotal());
    assertEquals(0, result.getPassed());
    assertEquals(0, result.getFailed());
    assertEquals(0.0, result.getQualityScore());
  }

  // --- getExistingTestResults ---

  @Test
  void testGetExistingTestResults_mixedResults() throws Exception {
    DataContract contract = new DataContract();
    contract.setQualityExpectations(
        List.of(
            new EntityReference().withId(UUID.randomUUID()),
            new EntityReference().withId(UUID.randomUUID()),
            new EntityReference().withId(UUID.randomUUID())));

    TestCase passed = new TestCase();
    passed.setTestCaseResult(new TestCaseResult().withTestCaseStatus(TestCaseStatus.Success));
    TestCase failed = new TestCase();
    failed.setTestCaseResult(new TestCaseResult().withTestCaseStatus(TestCaseStatus.Failed));
    TestCase aborted = new TestCase();
    aborted.setTestCaseResult(new TestCaseResult().withTestCaseStatus(TestCaseStatus.Aborted));

    QualityValidation result =
        invoke(
            "getExistingTestResults",
            new Class[] {DataContract.class, List.class},
            contract,
            List.of(passed, failed, aborted));

    assertEquals(3, result.getTotal());
    assertEquals(1, result.getPassed());
    assertEquals(2, result.getFailed());
    assertTrue(result.getQualityScore() > 0);
  }

  @Test
  void testGetExistingTestResults_emptyList() throws Exception {
    DataContract contract = new DataContract();
    contract.setQualityExpectations(List.of());

    QualityValidation result =
        invoke(
            "getExistingTestResults",
            new Class[] {DataContract.class, List.class},
            contract,
            Collections.emptyList());

    assertNotNull(result);
  }

  // --- validateDQ (division-by-zero guard) ---

  @Test
  void testValidateDQ_zeroTotal_noArithmeticException() throws Exception {
    TestSuite testSuite = new TestSuite();
    testSuite.setTests(List.of(new EntityReference().withFullyQualifiedName("test1")));
    testSuite.setTestCaseResultSummary(
        List.of(new ResultSummary().withTestCaseName("test1").withStatus(TestCaseStatus.Success)));

    QualityValidation existing = new QualityValidation().withTotal(0).withPassed(0).withFailed(0);

    QualityValidation result =
        invoke(
            "validateDQ",
            new Class[] {TestSuite.class, QualityValidation.class},
            testSuite,
            existing);

    assertEquals(0.0, result.getQualityScore());
    assertFalse(Double.isNaN(result.getQualityScore()));
    assertFalse(Double.isInfinite(result.getQualityScore()));
  }

  @Test
  void testValidateDQ_withTotal_calculatesScore() throws Exception {
    TestSuite testSuite = new TestSuite();
    testSuite.setTests(
        List.of(
            new EntityReference().withFullyQualifiedName("test1"),
            new EntityReference().withFullyQualifiedName("test2")));
    testSuite.setTestCaseResultSummary(
        List.of(
            new ResultSummary().withTestCaseName("test1").withStatus(TestCaseStatus.Success),
            new ResultSummary().withTestCaseName("test2").withStatus(TestCaseStatus.Failed)));

    QualityValidation existing =
        new QualityValidation().withTotal(2).withPassed(0).withFailed(0).withQualityScore(0.0);

    QualityValidation result =
        invoke(
            "validateDQ",
            new Class[] {TestSuite.class, QualityValidation.class},
            testSuite,
            existing);

    assertEquals(1, result.getPassed());
    assertEquals(1, result.getFailed());
    assertEquals(50.0, result.getQualityScore());
  }

  @Test
  void testValidateDQ_nullExistingValidation() throws Exception {
    TestSuite testSuite = new TestSuite();
    testSuite.setTests(List.of());
    testSuite.setTestCaseResultSummary(null);

    QualityValidation result =
        invoke(
            "validateDQ",
            new Class[] {TestSuite.class, QualityValidation.class},
            testSuite,
            (QualityValidation) null);

    assertNotNull(result);
  }

  // --- compileResult ---

  @Test
  void testCompileResult_noValidationIssues() {
    doCallRealMethod()
        .when(repository)
        .compileResult(
            org.mockito.ArgumentMatchers.any(DataContractResult.class),
            org.mockito.ArgumentMatchers.any(ContractExecutionStatus.class));

    DataContractResult result = new DataContractResult();
    repository.compileResult(result, ContractExecutionStatus.Success);
    assertEquals(ContractExecutionStatus.Success, result.getContractExecutionStatus());
  }

  @Test
  void testCompileResult_schemaValidationFailed() {
    doCallRealMethod()
        .when(repository)
        .compileResult(
            org.mockito.ArgumentMatchers.any(DataContractResult.class),
            org.mockito.ArgumentMatchers.any(ContractExecutionStatus.class));

    DataContractResult result = new DataContractResult();
    result.setSchemaValidation(new SchemaValidation().withFailed(2).withPassed(3).withTotal(5));
    repository.compileResult(result, ContractExecutionStatus.Success);
    assertEquals(ContractExecutionStatus.Failed, result.getContractExecutionStatus());
  }

  @Test
  void testCompileResult_semanticsValidationFailed() {
    doCallRealMethod()
        .when(repository)
        .compileResult(
            org.mockito.ArgumentMatchers.any(DataContractResult.class),
            org.mockito.ArgumentMatchers.any(ContractExecutionStatus.class));

    DataContractResult result = new DataContractResult();
    result.setSemanticsValidation(
        new SemanticsValidation().withFailed(1).withPassed(2).withTotal(3));
    repository.compileResult(result, ContractExecutionStatus.Success);
    assertEquals(ContractExecutionStatus.Failed, result.getContractExecutionStatus());
  }

  @Test
  void testCompileResult_qualityValidationFailed() {
    doCallRealMethod()
        .when(repository)
        .compileResult(
            org.mockito.ArgumentMatchers.any(DataContractResult.class),
            org.mockito.ArgumentMatchers.any(ContractExecutionStatus.class));

    DataContractResult result = new DataContractResult();
    result.setQualityValidation(new QualityValidation().withFailed(1).withPassed(2).withTotal(3));
    repository.compileResult(result, ContractExecutionStatus.Success);
    assertEquals(ContractExecutionStatus.Failed, result.getContractExecutionStatus());
  }

  @Test
  void testCompileResult_allValidationsPass() {
    doCallRealMethod()
        .when(repository)
        .compileResult(
            org.mockito.ArgumentMatchers.any(DataContractResult.class),
            org.mockito.ArgumentMatchers.any(ContractExecutionStatus.class));

    DataContractResult result = new DataContractResult();
    result.setSchemaValidation(new SchemaValidation().withFailed(0).withPassed(5).withTotal(5));
    result.setSemanticsValidation(
        new SemanticsValidation().withFailed(0).withPassed(3).withTotal(3));
    result.setQualityValidation(new QualityValidation().withFailed(0).withPassed(2).withTotal(2));
    repository.compileResult(result, ContractExecutionStatus.Success);
    assertEquals(ContractExecutionStatus.Success, result.getContractExecutionStatus());
  }

  // --- inheritFromDataProductContract ---

  @Test
  void testInheritFromDataProductContract() throws Exception {
    EntityReference entityRef =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);
    org.openmetadata.schema.EntityInterface entity =
        mock(org.openmetadata.schema.EntityInterface.class);
    org.mockito.Mockito.when(entity.getEntityReference()).thenReturn(entityRef);

    DataContract dpContract = new DataContract();
    dpContract.setId(UUID.randomUUID());
    dpContract.setName("dp-contract");
    dpContract.setEntityStatus(EntityStatus.APPROVED);
    dpContract.setSemantics(List.of(new SemanticsRule().withName("rule1")));
    dpContract.setTermsOfUse(new org.openmetadata.schema.entity.data.TermsOfUse());
    dpContract.setSecurity(new org.openmetadata.schema.api.data.ContractSecurity());
    dpContract.setSla(new org.openmetadata.schema.api.data.ContractSLA());

    DataContract result =
        invoke(
            "inheritFromDataProductContract",
            new Class[] {org.openmetadata.schema.EntityInterface.class, DataContract.class},
            entity,
            dpContract);

    assertNotNull(result);
    assertEquals(entityRef, result.getEntity());
    assertNull(result.getQualityExpectations());
    assertNull(result.getSchema());
    assertNull(result.getTestSuite());
    assertNull(result.getLatestResult());
    assertEquals(EntityStatus.DRAFT, result.getEntityStatus());
    assertTrue(result.getInherited());
    assertTrue(result.getTermsOfUse().getInherited());
    assertTrue(result.getSecurity().getInherited());
    assertTrue(result.getSla().getInherited());
    assertTrue(result.getSemantics().get(0).getInherited());
  }

  // --- mergeContracts ---

  @Test
  void testMergeContracts_inheritsTermsOfUse() throws Exception {
    DataContract entityContract = new DataContract();
    entityContract.setId(UUID.randomUUID());
    entityContract.setName("entity-contract");

    DataContract dpContract = new DataContract();
    dpContract.setTermsOfUse(new org.openmetadata.schema.entity.data.TermsOfUse());
    dpContract.setSecurity(new org.openmetadata.schema.api.data.ContractSecurity());
    dpContract.setSla(new org.openmetadata.schema.api.data.ContractSLA());

    DataContract result =
        invoke(
            "mergeContracts",
            new Class[] {DataContract.class, DataContract.class},
            entityContract,
            dpContract);

    assertNotNull(result.getTermsOfUse());
    assertTrue(result.getTermsOfUse().getInherited());
    assertNotNull(result.getSecurity());
    assertTrue(result.getSecurity().getInherited());
    assertNotNull(result.getSla());
    assertTrue(result.getSla().getInherited());
  }

  @Test
  void testMergeContracts_entityFieldsPreserved() throws Exception {
    DataContract entityContract = new DataContract();
    entityContract.setId(UUID.randomUUID());
    entityContract.setName("entity-contract");
    entityContract.setTermsOfUse(new org.openmetadata.schema.entity.data.TermsOfUse());
    entityContract.setSecurity(new org.openmetadata.schema.api.data.ContractSecurity());

    DataContract dpContract = new DataContract();
    dpContract.setTermsOfUse(new org.openmetadata.schema.entity.data.TermsOfUse());
    dpContract.setSecurity(new org.openmetadata.schema.api.data.ContractSecurity());

    DataContract result =
        invoke(
            "mergeContracts",
            new Class[] {DataContract.class, DataContract.class},
            entityContract,
            dpContract);

    // Entity's own terms/security should be preserved (not marked as inherited)
    assertNotNull(result.getTermsOfUse());
    assertNull(result.getTermsOfUse().getInherited());
  }

  @Test
  void testMergeContracts_semanticsDeduplication() throws Exception {
    DataContract entityContract = new DataContract();
    entityContract.setId(UUID.randomUUID());
    entityContract.setName("entity-contract");
    entityContract.setSemantics(List.of(new SemanticsRule().withName("shared-rule")));

    DataContract dpContract = new DataContract();
    dpContract.setSemantics(
        List.of(
            new SemanticsRule().withName("shared-rule"),
            new SemanticsRule().withName("dp-only-rule")));

    DataContract result =
        invoke(
            "mergeContracts",
            new Class[] {DataContract.class, DataContract.class},
            entityContract,
            dpContract);

    assertEquals(2, result.getSemantics().size());
    SemanticsRule inherited =
        result.getSemantics().stream()
            .filter(r -> "dp-only-rule".equals(r.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(inherited);
    assertTrue(inherited.getInherited());
  }

  // --- Helper methods ---

  private static DataContract contractWithSchema(String... columnNames) {
    DataContract contract = new DataContract();
    List<Column> columns = new ArrayList<>();
    for (String name : columnNames) {
      columns.add(column(name, null));
    }
    contract.setSchema(columns);
    return contract;
  }

  private static Column column(String name, ColumnDataType dataType) {
    Column col = new Column();
    col.setName(name);
    col.setDataType(dataType);
    return col;
  }

  private static org.openmetadata.schema.type.Field field(String name) {
    org.openmetadata.schema.type.Field f = new org.openmetadata.schema.type.Field();
    f.setName(name);
    return f;
  }
}
