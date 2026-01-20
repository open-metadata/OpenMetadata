  1. TestCaseResource (/v1/dataQuality/testCases)

  | Endpoint                             | Method | Required Permissions                                                                                                | Logic |
  |--------------------------------------|--------|---------------------------------------------------------------------------------------------------------------------|-------|
  | /                                    | GET    | TEST_CASE.VIEW_BASIC + optional TABLE.VIEW_TESTS (if entityLink/entityFQN) + TEST_SUITE.VIEW_BASIC (if testSuiteId) | ANY   |
  | /search/list                         | GET    | TEST_CASE.VIEW_BASIC + optional TABLE.VIEW_TESTS + TEST_SUITE.VIEW_BASIC                                            | ANY   |
  | /{id}                                | GET    | TABLE.VIEW_TESTS                                                                                                    | -     |
  | /name/{fqn}                          | GET    | TABLE.VIEW_TESTS                                                                                                    | -     |
  | /{id}/versions                       | GET    | TABLE.VIEW_TESTS                                                                                                    | -     |
  | /{id}/versions/{version}             | GET    | TABLE.VIEW_TESTS                                                                                                    | -     |
  | /                                    | POST   | TABLE.CREATE_TESTS OR TEST_CASE.CREATE                                                                              | ANY   |
  | /createMany                          | POST   | TABLE.CREATE_TESTS + TEST_CASE.CREATE per entity                                                                    | ANY   |
  | /{id}                                | PATCH  | TABLE.EDIT_TESTS OR TEST_CASE.EDIT_ALL                                                                              | ANY   |
  | /                                    | PUT    | TABLE.EDIT_TESTS OR TEST_CASE.CREATE OR TEST_CASE.EDIT_ALL                                                          | ANY   |
  | /{id}                                | DELETE | TEST_CASE.DELETE (inherited)                                                                                        | -     |
  | /name/{fqn}                          | DELETE | TEST_CASE.DELETE                                                                                                    | -     |
  | /logicalTestCases/{testSuiteId}/{id} | DELETE | TEST_CASE.DELETE OR TEST_SUITE.EDIT_ALL                                                                             | ANY   |
  | /restore                             | PUT    | Default restore permissions                                                                                         | -     |
  | /{id}/failedRowsSample               | PUT    | TEST_CASE.EDIT_TESTS                                                                                                | -     |
  | /{id}/failedRowsSample               | GET    | TEST_CASE.VIEW_TEST_CASE_FAILED_ROWS_SAMPLE                                                                         | -     |
  | /{id}/failedRowsSample               | DELETE | TEST_CASE.DELETE_TEST_CASE_FAILED_ROWS_SAMPLE                                                                       | -     |
  | /{id}/inspectionQuery                | PUT    | TEST_CASE.EDIT_TESTS                                                                                                | -     |
  | /logicalTestCases                    | PUT    | TEST_SUITE.EDIT_TESTS OR TEST_SUITE.EDIT_ALL                                                                        | ANY   |
  | /name/{name}/export                  | GET    | CSV export permissions                                                                                              | -     |
  | /name/{name}/import                  | PUT    | CSV import permissions                                                                                              | -     |

  ---
  2. TestSuiteResource (/v1/dataQuality/testSuites)

  | Endpoint                 | Method | Required Permissions                                          | Logic |
  |--------------------------|--------|---------------------------------------------------------------|-------|
  | /                        | GET    | TABLE.VIEW_TESTS OR TEST_SUITE.VIEW_ALL OR TEST_CASE.VIEW_ALL | ANY   |
  | /search/list             | GET    | TABLE.VIEW_TESTS OR TEST_SUITE.VIEW_ALL OR TEST_CASE.VIEW_ALL | ANY   |
  | /{id}                    | GET    | Default VIEW_BASIC                                            | -     |
  | /name/{name}             | GET    | Default VIEW_BASIC                                            | -     |
  | /{id}/versions           | GET    | Default VIEW_ALL                                              | -     |
  | /{id}/versions/{version} | GET    | Default VIEW_ALL                                              | -     |
  | /executionSummary        | GET    | TABLE.VIEW_TESTS OR TEST_SUITE.VIEW_ALL OR TEST_CASE.VIEW_ALL | ANY   |
  | /dataQualityReport       | GET    | TABLE.VIEW_TESTS OR TEST_SUITE.VIEW_ALL OR TEST_CASE.VIEW_ALL | ANY   |
  | /                        | POST   | TABLE.EDIT_TESTS OR TEST_SUITE.CREATE                         | ANY   |
  | /basic                   | POST   | TABLE.EDIT_TESTS OR TEST_SUITE.CREATE                         | ANY   |
  | /{id}                    | PATCH  | TABLE.EDIT_TESTS OR TEST_SUITE.{patch ops}                    | ANY   |
  | /                        | PUT    | TABLE.EDIT_TESTS OR TEST_SUITE.CREATE OR TEST_SUITE.EDIT_ALL  | ANY   |
  | /basic                   | PUT    | TABLE.EDIT_TESTS OR TEST_SUITE.CREATE OR TEST_SUITE.EDIT_ALL  | ANY   |
  | /{id}                    | DELETE | TEST_SUITE.DELETE (logical only)                              | -     |
  | /name/{name}             | DELETE | TEST_SUITE.DELETE (logical only)                              | -     |
  | /basic/{id}              | DELETE | TEST_SUITE.DELETE (basic only)                                | -     |
  | /basic/name/{name}       | DELETE | TEST_SUITE.DELETE (basic only)                                | -     |
  | /restore                 | PUT    | Default restore permissions                                   | -     |

  ---
  3. TestCaseResultResource (/v1/dataQuality/testCases/testCaseResults)

  | Endpoint           | Method | Required Permissions                                                                          | Logic |
  |--------------------|--------|-----------------------------------------------------------------------------------------------|-------|
  | /{fqn}             | POST   | TABLE.EDIT_TESTS OR TEST_CASE.EDIT_ALL                                                        | ANY   |
  | /{fqn}             | GET    | TEST_CASE.VIEW_ALL OR TABLE.VIEW_TESTS                                                        | ANY   |
  | /search/list       | GET    | TEST_CASE.VIEW_ALL + TABLE.VIEW_TESTS (if testCaseFQN) + TEST_SUITE.VIEW_ALL (if testSuiteId) | ANY   |
  | /search/latest     | GET    | Same as /search/list                                                                          | ANY   |
  | /{fqn}/{timestamp} | PATCH  | TABLE.EDIT_TESTS OR TEST_CASE.EDIT_ALL                                                        | ANY   |
  | /{fqn}/{timestamp} | DELETE | TABLE.DELETE AND TEST_CASE.DELETE                                                             | ALL   |

  ---
  4. TestCaseResolutionStatusResource (/v1/dataQuality/testCases/testCaseIncidentStatus)

  | Endpoint           | Method | Required Permissions                                                             | Logic |
  |--------------------|--------|----------------------------------------------------------------------------------|-------|
  | /                  | GET    | TEST_CASE.VIEW_ALL OR TABLE.VIEW_ALL OR TABLE.VIEW_TESTS                         | ANY   |
  | /stateId/{stateId} | GET    | TEST_CASE.VIEW_ALL OR TABLE.VIEW_ALL OR TABLE.VIEW_TESTS                         | ANY   |
  | /{id}              | GET    | TEST_CASE.VIEW_ALL OR TABLE.VIEW_ALL OR TABLE.VIEW_TESTS                         | ANY   |
  | /search/list       | GET    | TEST_CASE.VIEW_ALL OR TABLE.VIEW_ALL                                             | ANY   |
  | /                  | POST   | TABLE.EDIT_TESTS OR TABLE.EDIT_ALL OR TEST_CASE.EDIT_TESTS OR TEST_CASE.EDIT_ALL | ANY   |
  | /{id}              | PATCH  | TABLE.EDIT_TESTS OR TABLE.EDIT_ALL OR TEST_CASE.EDIT_TESTS OR TEST_CASE.EDIT_ALL | ANY   |

  ---
  Summary of Key Operations

  | Operation         | Primary Entity           | Alternative Entities                 |
  |-------------------|--------------------------|--------------------------------------|
  | View Tests        | TEST_CASE.VIEW_BASIC/ALL | TABLE.VIEW_TESTS                     |
  | Create Tests      | TEST_CASE.CREATE         | TABLE.CREATE_TESTS                   |
  | Edit Tests        | TEST_CASE.EDIT_ALL       | TABLE.EDIT_TESTS                     |
  | Delete Tests      | TEST_CASE.DELETE         | TABLE.DELETE (for results)           |
  | View Test Suite   | TEST_SUITE.VIEW_ALL      | TABLE.VIEW_TESTS, TEST_CASE.VIEW_ALL |
  | Edit Test Suite   | TEST_SUITE.EDIT_ALL      | TABLE.EDIT_TESTS                     |
  | Delete Test Suite | TEST_SUITE.DELETE        | -                                    |
  | Manage Incidents  | TEST_CASE.EDIT_TESTS/ALL | TABLE.EDIT_TESTS/ALL                 |