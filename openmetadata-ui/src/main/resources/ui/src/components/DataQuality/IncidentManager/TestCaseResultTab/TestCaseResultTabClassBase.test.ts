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
import { TestCase } from '../../../../generated/tests/testCase';
import testCaseResultTabClassBase, {
  AdditionalComponentInterface,
  TestCaseResultTabClassBase,
} from './TestCaseResultTabClassBase';

const mockTestCase: TestCase = {
  id: '1b748634-d24b-4879-9791-289f2f90fc3c',
  name: 'table_column_count_equals',
  fullyQualifiedName:
    'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals',
  testDefinition: {
    id: '48063740-ac35-4854-9ab3-b1b542c820fe',
    type: 'testDefinition',
    name: 'tableColumnCountToEqual',
    fullyQualifiedName: 'tableColumnCountToEqual',
    displayName: 'Table Column Count To Equal',
  },
  entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  entityFQN: 'sample_data.ecommerce_db.shopify.dim_address',
  testSuite: {
    id: 'fe44ef1a-1b83-4872-bef6-fbd1885986b8',
    type: 'testSuite',
    name: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.testSuite',
  },
  parameterValues: [
    {
      name: 'columnCount',
      value: '10',
    },
  ],
  updatedAt: 1703570589915,
  updatedBy: 'admin',
} as TestCase;

describe('TestCaseResultTabClassBase', () => {
  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(testCaseResultTabClassBase).toBeDefined();
      expect(testCaseResultTabClassBase).toBeInstanceOf(
        TestCaseResultTabClassBase
      );
    });

    it('should export the class constructor', () => {
      expect(TestCaseResultTabClassBase).toBeDefined();
      expect(typeof TestCaseResultTabClassBase).toBe('function');
    });

    it('should allow creating new instances', () => {
      const newInstance = new TestCaseResultTabClassBase();

      expect(newInstance).toBeInstanceOf(TestCaseResultTabClassBase);
      expect(newInstance).not.toBe(testCaseResultTabClassBase);
    });
  });

  describe('getAdditionalComponents', () => {
    it('should return an empty array by default', () => {
      const result = testCaseResultTabClassBase.getAdditionalComponents();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should return an empty array when testCaseData is undefined', () => {
      const result =
        testCaseResultTabClassBase.getAdditionalComponents(undefined);

      expect(result).toEqual([]);
    });

    it('should return an empty array when testCaseData is provided', () => {
      const result =
        testCaseResultTabClassBase.getAdditionalComponents(mockTestCase);

      expect(result).toEqual([]);
    });

    it('should return an array that matches AdditionalComponentInterface type', () => {
      const result: Array<AdditionalComponentInterface> =
        testCaseResultTabClassBase.getAdditionalComponents(mockTestCase);

      expect(result).toEqual([]);
    });
  });

  describe('getAlertBanner', () => {
    it('should return null by default', () => {
      const result = testCaseResultTabClassBase.getAlertBanner();

      expect(result).toBeNull();
    });

    it('should return a value that can be assigned to React.FC or null', () => {
      const result: React.FC | null =
        testCaseResultTabClassBase.getAlertBanner();

      expect(result).toBeNull();
    });
  });

  describe('extended class functionality', () => {
    it('should allow extending the class to add custom components', () => {
      const MockComponent = () => null;

      class ExtendedClass extends TestCaseResultTabClassBase {
        public getAdditionalComponents(
          testCaseData?: TestCase
        ): Array<AdditionalComponentInterface> {
          if (testCaseData?.name === 'custom_test') {
            return [{ id: 'custom-component', Component: MockComponent }];
          }

          return [];
        }
      }

      const extendedInstance = new ExtendedClass();
      const resultWithoutMatch = extendedInstance.getAdditionalComponents({
        ...mockTestCase,
        name: 'regular_test',
      });
      const resultWithMatch = extendedInstance.getAdditionalComponents({
        ...mockTestCase,
        name: 'custom_test',
      });

      expect(resultWithoutMatch).toEqual([]);
      expect(resultWithMatch).toHaveLength(1);
      expect(resultWithMatch[0].id).toBe('custom-component');
      expect(resultWithMatch[0].Component).toBe(MockComponent);
    });

    it('should allow extending the class to add custom alert banner', () => {
      const MockBanner = () => null;

      class ExtendedClass extends TestCaseResultTabClassBase {
        public getAlertBanner(): React.FC | null {
          return MockBanner;
        }
      }

      const extendedInstance = new ExtendedClass();
      const result = extendedInstance.getAlertBanner();

      expect(result).toBe(MockBanner);
    });

    it('should allow extending the class with conditional banner logic', () => {
      const MockBanner = () => null;

      class ExtendedClass extends TestCaseResultTabClassBase {
        private showBanner: boolean;

        constructor(showBanner: boolean) {
          super();
          this.showBanner = showBanner;
        }

        public getAlertBanner(): React.FC | null {
          return this.showBanner ? MockBanner : null;
        }
      }

      const instanceWithBanner = new ExtendedClass(true);
      const instanceWithoutBanner = new ExtendedClass(false);

      expect(instanceWithBanner.getAlertBanner()).toBe(MockBanner);
      expect(instanceWithoutBanner.getAlertBanner()).toBeNull();
    });
  });

  describe('method immutability', () => {
    it('should return a new empty array each time getAdditionalComponents is called', () => {
      const result1 = testCaseResultTabClassBase.getAdditionalComponents();
      const result2 = testCaseResultTabClassBase.getAdditionalComponents();

      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2);
    });
  });
});
