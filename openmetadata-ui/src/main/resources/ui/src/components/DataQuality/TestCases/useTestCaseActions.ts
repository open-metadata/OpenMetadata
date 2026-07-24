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
import { Dispatch, SetStateAction } from 'react';
import { TestCase } from '../../../generated/tests/testCase';

export interface UseTestCaseActionsProps {
  setTestCase: Dispatch<SetStateAction<TestCase[]>>;
}

/**
 * Owns the row-mutation handlers that patch the in-memory test-case list: a
 * merge-by-id update and an optimistic replace-by-fullyQualifiedName status
 * submit. Pure functions over the injected list setter.
 */
export const useTestCaseActions = ({
  setTestCase,
}: UseTestCaseActionsProps) => {
  const handleTestCaseUpdate = (data?: TestCase) => {
    if (data) {
      setTestCase((prev) =>
        prev.map((test) => (test.id === data.id ? { ...test, ...data } : test))
      );
    }
  };

  const handleStatusSubmit = (updated: TestCase) => {
    setTestCase((prev) =>
      prev.map((test) =>
        test.fullyQualifiedName === updated.fullyQualifiedName ? updated : test
      )
    );
  };

  return {
    handleTestCaseUpdate,
    handleStatusSubmit,
  };
};
