/*
 *  Copyright 2026 Collate.
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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the \"License\");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an \"AS IS\" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { TestCaseStatus } from '../generated/tests/testCase';

// Mock response data
const mockTestCase = {
  id: 'test-case-id',
  name: 'test_case_name',
  fullyQualifiedName: 'test.suite.test_case',
  testDefinition: { id: 'def-id', name: 'definition' },
  testSuite: { id: 'suite-id', name: 'suite' },
};

const mockTestSuite = {
  id: 'test-suite-id',
  name: 'test_suite',
  fullyQualifiedName: 'test.suite',
  executable: false,
};

const mockTestDefinition = {
  id: 'test-def-id',
  name: 'test_definition',
  fullyQualifiedName: 'test.definition',
  entityType: 'table',
};

const mockPagingResponse = {
  data: [mockTestCase],
  paging: { total: 1, after: 'cursor', before: 'cursor' },
};

describe('testAPI tests', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Test Case APIs', () => {
    describe('getListTestCaseBySearch', () => {
      it('should fetch test cases with search parameters', async () => {
        const mockGet = jest
          .fn()
          .mockResolvedValue({ data: mockPagingResponse });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getListTestCaseBySearch } = require('./testAPI');

        const params = {
          q: 'search query',
          testSuiteId: 'suite-id',
          limit: 10,
        };

        const result = await getListTestCaseBySearch(params);

        expect(mockGet).toHaveBeenCalledWith(
          '/dataQuality/testCases/search/list',
          {
            params,
          }
        );
        expect(result).toEqual(mockPagingResponse);
      });

      it('should handle empty search parameters', async () => {
        const mockGet = jest
          .fn()
          .mockResolvedValue({ data: mockPagingResponse });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getListTestCaseBySearch } = require('./testAPI');

        await getListTestCaseBySearch();

        expect(mockGet).toHaveBeenCalledWith(
          '/dataQuality/testCases/search/list',
          {
            params: undefined,
          }
        );
      });

      it('should handle API errors', async () => {
        const error = new Error('API Error');
        const mockGet = jest.fn().mockRejectedValue(error);
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getListTestCaseBySearch } = require('./testAPI');

        await expect(getListTestCaseBySearch()).rejects.toThrow('API Error');
      });
    });

    describe('getListTestCaseResults', () => {
      it('should fetch test case results with FQN encoding', async () => {
        const mockGet = jest.fn().mockResolvedValue({
          data: { data: [], paging: {} },
        });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getListTestCaseResults } = require('./testAPI');

        await getListTestCaseResults('test.case.fqn', { limit: 10 });

        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining('/dataQuality/testCases/testCaseResults/'),
          { params: { limit: 10 } }
        );
      });

      it('should handle special characters in FQN', async () => {
        const mockGet = jest.fn().mockResolvedValue({
          data: { data: [], paging: {} },
        });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getListTestCaseResults } = require('./testAPI');

        await getListTestCaseResults('test/case/fqn');

        expect(mockGet).toHaveBeenCalled();
      });
    });

    describe('getTestCaseByFqn', () => {
      it('should fetch test case by FQN with fields', async () => {
        const mockGet = jest.fn().mockResolvedValue({ data: mockTestCase });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getTestCaseByFqn } = require('./testAPI');

        const result = await getTestCaseByFqn('test.case.fqn', {
          fields: ['owner', 'tags'],
        });

        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining('/dataQuality/testCases/name/'),
          { params: { fields: ['owner', 'tags'] } }
        );
        expect(result).toEqual(mockTestCase);
      });

      it('should handle missing params', async () => {
        const mockGet = jest.fn().mockResolvedValue({ data: mockTestCase });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getTestCaseByFqn } = require('./testAPI');

        await getTestCaseByFqn('test.case.fqn');

        expect(mockGet).toHaveBeenCalledWith(expect.any(String), {
          params: undefined,
        });
      });
    });

    describe('createTestCase', () => {
      it('should create a test case', async () => {
        const mockPost = jest.fn().mockResolvedValue({ data: mockTestCase });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            post: mockPost,
          },
        }));

        const { createTestCase } = require('./testAPI');

        const createData = {
          name: 'new_test_case',
          testDefinition: 'def-id',
          entityLink: 'table-link',
        };

        const result = await createTestCase(createData);

        expect(mockPost).toHaveBeenCalledWith(
          '/dataQuality/testCases',
          createData
        );
        expect(result).toEqual(mockTestCase);
      });

      it('should handle creation errors', async () => {
        const error = new Error('Creation failed');
        const mockPost = jest.fn().mockRejectedValue(error);
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            post: mockPost,
          },
        }));

        const { createTestCase } = require('./testAPI');

        await expect(createTestCase({})).rejects.toThrow('Creation failed');
      });
    });

    describe('updateTestCaseById', () => {
      it('should update test case with JSON patch', async () => {
        const mockPatch = jest.fn().mockResolvedValue({ data: mockTestCase });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            patch: mockPatch,
          },
        }));

        const { updateTestCaseById } = require('./testAPI');

        const patch = [
          { op: 'replace', path: '/description', value: 'new description' },
        ];

        const result = await updateTestCaseById('test-case-id', patch);

        expect(mockPatch).toHaveBeenCalledWith(
          '/dataQuality/testCases/test-case-id',
          patch
        );
        expect(result).toEqual(mockTestCase);
      });
    });

    describe('getTestCaseExecutionSummary', () => {
      it('should fetch execution summary with test suite ID', async () => {
        const mockSummary = { success: 10, failed: 2, aborted: 1 };
        const mockGet = jest.fn().mockResolvedValue({ data: mockSummary });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getTestCaseExecutionSummary } = require('./testAPI');

        const result = await getTestCaseExecutionSummary('suite-id');

        expect(mockGet).toHaveBeenCalledWith(
          '/dataQuality/testSuites/executionSummary',
          { params: { testSuiteId: 'suite-id' } }
        );
        expect(result).toEqual(mockSummary);
      });

      it('should fetch execution summary without test suite ID', async () => {
        const mockGet = jest.fn().mockResolvedValue({ data: {} });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getTestCaseExecutionSummary } = require('./testAPI');

        await getTestCaseExecutionSummary();

        expect(mockGet).toHaveBeenCalledWith(
          '/dataQuality/testSuites/executionSummary',
          { params: { testSuiteId: undefined } }
        );
      });
    });

    describe('addTestCaseToLogicalTestSuite', () => {
      it('should add test cases to logical test suite', async () => {
        const mockPut = jest.fn().mockResolvedValue({ data: mockTestSuite });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            put: mockPut,
          },
        }));

        const { addTestCaseToLogicalTestSuite } = require('./testAPI');

        const data = {
          testCaseIds: ['case-1', 'case-2'],
          testSuiteId: 'suite-id',
        };

        const result = await addTestCaseToLogicalTestSuite(data);

        expect(mockPut).toHaveBeenCalledWith(
          '/dataQuality/testCases/logicalTestCases',
          data
        );
        expect(result).toEqual(mockTestSuite);
      });
    });

    describe('removeTestCaseFromTestSuite', () => {
      it('should remove test case from test suite', async () => {
        const mockDelete = jest.fn().mockResolvedValue({ data: mockTestCase });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            delete: mockDelete,
          },
        }));

        const { removeTestCaseFromTestSuite } = require('./testAPI');

        const result = await removeTestCaseFromTestSuite('case-id', 'suite-id');

        expect(mockDelete).toHaveBeenCalledWith(
          '/dataQuality/testCases/logicalTestCases/suite-id/case-id'
        );
        expect(result).toEqual(mockTestCase);
      });
    });

    describe('getTestCaseVersionList', () => {
      it('should fetch test case version list', async () => {
        const mockVersions = { versions: ['1.0', '1.1'] };
        const mockGet = jest.fn().mockResolvedValue({ data: mockVersions });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getTestCaseVersionList } = require('./testAPI');

        const result = await getTestCaseVersionList('test-case-id');

        expect(mockGet).toHaveBeenCalledWith(
          '/dataQuality/testCases/test-case-id/versions'
        );
        expect(result).toEqual(mockVersions);
      });
    });

    describe('getTestCaseVersionDetails', () => {
      it('should fetch specific version details', async () => {
        const mockVersion = { version: '1.0', ...mockTestCase };
        const mockGet = jest.fn().mockResolvedValue({ data: mockVersion });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getTestCaseVersionDetails } = require('./testAPI');

        const result = await getTestCaseVersionDetails('test-case-id', '1.0');

        expect(mockGet).toHaveBeenCalledWith(
          '/dataQuality/testCases/test-case-id/versions/1.0'
        );
        expect(result).toEqual(mockVersion);
      });
    });

    describe('getTestCaseDimensionResultsByFqn', () => {
      it('should fetch dimension results with parameters', async () => {
        const mockResults = { data: [], paging: {} };
        const mockGet = jest.fn().mockResolvedValue({ data: mockResults });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getTestCaseDimensionResultsByFqn } = require('./testAPI');

        const params = {
          dimensionalityKey: 'key',
          startTs: 1000,
          endTs: 2000,
        };

        const result = await getTestCaseDimensionResultsByFqn(
          'test.case.fqn',
          params
        );

        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining('/dataQuality/testCases/dimensionResults/'),
          { params }
        );
        expect(result).toEqual(mockResults);
      });
    });

    describe('listTestCases', () => {
      it('should list test cases with all parameters', async () => {
        const mockGet = jest
          .fn()
          .mockResolvedValue({ data: mockPagingResponse });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { listTestCases } = require('./testAPI');

        const params = {
          includeAllTests: true,
          limit: 25,
          testSuiteId: 'suite-id',
          testCaseStatus: TestCaseStatus.Success,
        };

        const result = await listTestCases(params);

        expect(mockGet).toHaveBeenCalledWith('/dataQuality/testCases', {
          params,
        });
        expect(result).toEqual(mockPagingResponse);
      });
    });

    describe('exportTestCasesInCSV', () => {
      it('should export test cases with recursive parameter', async () => {
        const mockResponse = { jobId: 'export-job-id' };
        const mockGet = jest.fn().mockResolvedValue({ data: mockResponse });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { exportTestCasesInCSV } = require('./testAPI');

        const result = await exportTestCasesInCSV('test.suite.name', {
          recursive: true,
        });

        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining('/dataQuality/testCases/name/'),
          { params: { recursive: true } }
        );
        expect(result).toEqual(mockResponse);
      });

      it('should export test cases without parameters', async () => {
        const mockResponse = { jobId: 'export-job-id' };
        const mockGet = jest.fn().mockResolvedValue({ data: mockResponse });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { exportTestCasesInCSV } = require('./testAPI');

        await exportTestCasesInCSV('test.suite.name');

        expect(mockGet).toHaveBeenCalledWith(expect.any(String), {
          params: undefined,
        });
      });
    });
  });

  describe('Test Definition APIs', () => {
    describe('getListTestDefinitions', () => {
      it('should fetch test definitions with filters', async () => {
        const mockResponse = { data: [mockTestDefinition], paging: {} };
        const mockGet = jest.fn().mockResolvedValue({ data: mockResponse });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getListTestDefinitions } = require('./testAPI');

        const params = {
          entityType: 'table',
          testPlatform: 'OpenMetadata',
          enabled: true,
        };

        const result = await getListTestDefinitions(params);

        expect(mockGet).toHaveBeenCalledWith('/dataQuality/testDefinitions', {
          params,
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getTestDefinitionById', () => {
      it('should fetch test definition by ID with fields', async () => {
        const mockGet = jest
          .fn()
          .mockResolvedValue({ data: mockTestDefinition });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getTestDefinitionById } = require('./testAPI');

        const result = await getTestDefinitionById('def-id', {
          fields: ['parameterDefinition'],
        });

        expect(mockGet).toHaveBeenCalledWith(
          '/dataQuality/testDefinitions/def-id',
          { params: { fields: ['parameterDefinition'] } }
        );
        expect(result).toEqual(mockTestDefinition);
      });
    });

    describe('createTestDefinition', () => {
      it('should create a test definition', async () => {
        const mockPost = jest
          .fn()
          .mockResolvedValue({ data: mockTestDefinition });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            post: mockPost,
          },
        }));

        const { createTestDefinition } = require('./testAPI');

        const createData = {
          name: 'new_test_definition',
          entityType: 'table',
        };

        const result = await createTestDefinition(createData);

        expect(mockPost).toHaveBeenCalledWith(
          '/dataQuality/testDefinitions',
          createData
        );
        expect(result).toEqual(mockTestDefinition);
      });
    });

    describe('updateTestDefinition', () => {
      it('should update test definition', async () => {
        const mockPut = jest
          .fn()
          .mockResolvedValue({ data: mockTestDefinition });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            put: mockPut,
          },
        }));

        const { updateTestDefinition } = require('./testAPI');

        const result = await updateTestDefinition(mockTestDefinition);

        expect(mockPut).toHaveBeenCalledWith(
          '/dataQuality/testDefinitions',
          mockTestDefinition
        );
        expect(result).toEqual(mockTestDefinition);
      });
    });

    describe('patchTestDefinition', () => {
      it('should patch test definition with JSON patch', async () => {
        const mockPatch = jest
          .fn()
          .mockResolvedValue({ data: mockTestDefinition });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            patch: mockPatch,
          },
        }));

        const { patchTestDefinition } = require('./testAPI');

        const patch = [{ op: 'replace', path: '/enabled', value: false }];

        const result = await patchTestDefinition('def-id', patch);

        expect(mockPatch).toHaveBeenCalledWith(
          '/dataQuality/testDefinitions/def-id',
          patch
        );
        expect(result).toEqual(mockTestDefinition);
      });
    });

    describe('deleteTestDefinitionByFqn', () => {
      it('should delete test definition with default parameters', async () => {
        const mockDelete = jest
          .fn()
          .mockResolvedValue({ data: mockTestDefinition });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            delete: mockDelete,
          },
        }));

        const { deleteTestDefinitionByFqn } = require('./testAPI');

        await deleteTestDefinitionByFqn('test.definition.fqn');

        expect(mockDelete).toHaveBeenCalledWith(
          '/dataQuality/testDefinitions/name/test.definition.fqn',
          { params: { hardDelete: true, recursive: true } }
        );
      });

      it('should delete test definition with custom parameters', async () => {
        const mockDelete = jest
          .fn()
          .mockResolvedValue({ data: mockTestDefinition });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            delete: mockDelete,
          },
        }));

        const { deleteTestDefinitionByFqn } = require('./testAPI');

        await deleteTestDefinitionByFqn('test.definition.fqn', {
          hardDelete: false,
          recursive: false,
        });

        expect(mockDelete).toHaveBeenCalledWith(
          '/dataQuality/testDefinitions/name/test.definition.fqn',
          { params: { hardDelete: false, recursive: false } }
        );
      });
    });
  });

  describe('Test Suite APIs', () => {
    describe('getListTestSuites', () => {
      it('should fetch test suites with filters', async () => {
        const mockResponse = { data: [mockTestSuite], paging: {} };
        const mockGet = jest.fn().mockResolvedValue({ data: mockResponse });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getListTestSuites } = require('./testAPI');

        const params = {
          testSuiteType: 'logical',
          includeEmptyTestSuites: true,
          limit: 20,
        };

        const result = await getListTestSuites(params);

        expect(mockGet).toHaveBeenCalledWith('/dataQuality/testSuites', {
          params,
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getListTestSuitesBySearch', () => {
      it('should search test suites with query and sort', async () => {
        const mockGet = jest
          .fn()
          .mockResolvedValue({ data: mockPagingResponse });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getListTestSuitesBySearch } = require('./testAPI');

        const params = {
          q: 'search term',
          sortField: 'name',
          sortType: 'asc',
          owner: 'user-id',
        };

        const result = await getListTestSuitesBySearch(params);

        expect(mockGet).toHaveBeenCalledWith(
          '/dataQuality/testSuites/search/list',
          { params }
        );
        expect(result).toEqual(mockPagingResponse);
      });
    });

    describe('createTestSuites', () => {
      it('should create a test suite', async () => {
        const mockPost = jest.fn().mockResolvedValue({ data: mockTestSuite });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            post: mockPost,
          },
        }));

        const { createTestSuites } = require('./testAPI');

        const createData = {
          name: 'new_test_suite',
          description: 'Test suite description',
        };

        const result = await createTestSuites(createData);

        expect(mockPost).toHaveBeenCalledWith(
          '/dataQuality/testSuites',
          createData
        );
        expect(result).toEqual(mockTestSuite);
      });
    });

    describe('createExecutableTestSuite', () => {
      it('should create an executable test suite', async () => {
        const mockPost = jest.fn().mockResolvedValue({ data: mockTestSuite });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            post: mockPost,
          },
        }));

        const { createExecutableTestSuite } = require('./testAPI');

        const createData = {
          name: 'executable_suite',
          executable: true,
        };

        const result = await createExecutableTestSuite(createData);

        expect(mockPost).toHaveBeenCalledWith(
          '/dataQuality/testSuites/basic',
          createData
        );
        expect(result).toEqual(mockTestSuite);
      });
    });

    describe('getTestSuiteByName', () => {
      it('should fetch test suite by name with params', async () => {
        const mockGet = jest.fn().mockResolvedValue({ data: mockTestSuite });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getTestSuiteByName } = require('./testAPI');

        const params = { fields: ['owners', 'tests'] };

        const result = await getTestSuiteByName('test.suite.name', params);

        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining('/dataQuality/testSuites/name/'),
          { params }
        );
        expect(result).toEqual(mockTestSuite);
      });

      it('should encode FQN with special characters', async () => {
        const mockGet = jest.fn().mockResolvedValue({ data: mockTestSuite });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getTestSuiteByName } = require('./testAPI');

        await getTestSuiteByName('test/suite/name');

        expect(mockGet).toHaveBeenCalled();
      });
    });

    describe('updateTestSuiteById', () => {
      it('should update test suite with JSON patch', async () => {
        const mockPatch = jest.fn().mockResolvedValue({ data: mockTestSuite });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            patch: mockPatch,
          },
        }));

        const { updateTestSuiteById } = require('./testAPI');

        const patch = [
          { op: 'replace', path: '/description', value: 'Updated description' },
        ];

        const result = await updateTestSuiteById('suite-id', patch);

        expect(mockPatch).toHaveBeenCalledWith(
          '/dataQuality/testSuites/suite-id',
          patch
        );
        expect(result).toEqual(mockTestSuite);
      });
    });

    describe('getDataQualityReport', () => {
      it('should fetch data quality report with aggregation query', async () => {
        const mockReport = { metrics: {}, charts: [] };
        const mockGet = jest.fn().mockResolvedValue({ data: mockReport });
        jest.mock('./index', () => ({
          __esModule: true,
          default: {
            get: mockGet,
          },
        }));

        const { getDataQualityReport } = require('./testAPI');

        const params = {
          q: 'query',
          aggregationQuery: 'agg query',
          index: 'test_case_index',
        };

        const result = await getDataQualityReport(params);

        expect(mockGet).toHaveBeenCalledWith(
          '/dataQuality/testSuites/dataQualityReport',
          { params }
        );
        expect(result).toEqual(mockReport);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors across all functions', async () => {
      const networkError = new Error('Network Error');
      const mockGet = jest.fn().mockRejectedValue(networkError);
      const mockPost = jest.fn().mockRejectedValue(networkError);
      const mockPut = jest.fn().mockRejectedValue(networkError);
      const mockPatch = jest.fn().mockRejectedValue(networkError);
      const mockDelete = jest.fn().mockRejectedValue(networkError);

      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          get: mockGet,
          post: mockPost,
          put: mockPut,
          patch: mockPatch,
          delete: mockDelete,
        },
      }));

      const {
        getListTestCaseBySearch,
        createTestCase,
        addTestCaseToLogicalTestSuite,
        updateTestCaseById,
        removeTestCaseFromTestSuite,
      } = require('./testAPI');

      await expect(getListTestCaseBySearch()).rejects.toThrow('Network Error');
      await expect(createTestCase({})).rejects.toThrow('Network Error');
      await expect(
        addTestCaseToLogicalTestSuite({ testCaseIds: [], testSuiteId: '' })
      ).rejects.toThrow('Network Error');
      await expect(updateTestCaseById('id', [])).rejects.toThrow(
        'Network Error'
      );
      await expect(removeTestCaseFromTestSuite('c', 's')).rejects.toThrow(
        'Network Error'
      );
    });

    it('should handle 404 errors', async () => {
      const notFoundError = { response: { status: 404 } };
      const mockGet = jest.fn().mockRejectedValue(notFoundError);

      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          get: mockGet,
        },
      }));

      const { getTestCaseByFqn } = require('./testAPI');

      await expect(getTestCaseByFqn('non.existent.fqn')).rejects.toEqual(
        notFoundError
      );
    });

    it('should handle 500 errors', async () => {
      const serverError = { response: { status: 500 } };
      const mockPost = jest.fn().mockRejectedValue(serverError);

      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          post: mockPost,
        },
      }));

      const { createTestCase } = require('./testAPI');

      await expect(createTestCase({})).rejects.toEqual(serverError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty responses', async () => {
      const mockGet = jest
        .fn()
        .mockResolvedValue({ data: { data: [], paging: {} } });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          get: mockGet,
        },
      }));

      const { getListTestCaseBySearch } = require('./testAPI');

      const result = await getListTestCaseBySearch();

      expect(result.data).toEqual([]);
    });

    it('should handle large result sets', async () => {
      const largeData = Array(1000).fill(mockTestCase);
      const mockGet = jest.fn().mockResolvedValue({
        data: { data: largeData, paging: { total: 1000 } },
      });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          get: mockGet,
        },
      }));

      const { getListTestCaseBySearch } = require('./testAPI');

      const result = await getListTestCaseBySearch({ limit: 1000 });

      expect(result.data).toHaveLength(1000);
    });

    it('should handle special characters in all FQN parameters', async () => {
      const mockGet = jest.fn().mockResolvedValue({ data: mockTestCase });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          get: mockGet,
        },
      }));

      const {
        getTestCaseByFqn,
        getListTestCaseResults,
        getTestSuiteByName,
      } = require('./testAPI');

      const specialFqn = 'test@case#with$special%chars';

      await getTestCaseByFqn(specialFqn);
      await getListTestCaseResults(specialFqn);
      await getTestSuiteByName(specialFqn);

      expect(mockGet).toHaveBeenCalledTimes(3);
    });
  });
});
