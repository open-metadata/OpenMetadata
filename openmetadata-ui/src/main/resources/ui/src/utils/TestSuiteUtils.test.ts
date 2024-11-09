/*
 *  Copyright 2024 Collate.
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
import { getTestSuiteDetailsPath, getTestSuiteFQN } from './TestSuiteUtils';

describe('getTestSuiteFQN', () => {
  it('get FQN which not contain the testSuiteName', () => {
    const result = getTestSuiteFQN(
      'TeamType.Group.Data.TestSuite.TestSuiteName'
    );

    expect(result).toBe('TeamType.Group.Data.TestSuite');
  });

  it('get FQN which contain only testSuiteName', () => {
    const result = getTestSuiteFQN('TestSuiteName');

    expect(result).toBe('TestSuiteName');
  });
});

describe('getTestSuiteDetailsPath', () => {
  const FQN = 'TeamType.Group.Data.TestSuite.TestSuiteName';

  it('should return detail path for ExecutableTestSuite', () => {
    const result = getTestSuiteDetailsPath({
      fullyQualifiedName: FQN,
      isExecutableTestSuite: true,
    });

    expect(result).toBe(
      '/table/TeamType.Group.Data.TestSuite.TestSuiteName/profiler?activeTab=Data Quality'
    );
  });

  it('should return detail path for not ExecutableTestSuite', () => {
    const result = getTestSuiteDetailsPath({
      fullyQualifiedName: FQN,
      isExecutableTestSuite: false,
    });

    expect(result).toBe(
      '/test-suites/TeamType.Group.Data.TestSuite.TestSuiteName'
    );
  });
});
