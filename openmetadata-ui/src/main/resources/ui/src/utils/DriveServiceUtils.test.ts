/*
 *  Copyright 2025 Collate.
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

import { cloneDeep } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/Services.constant';
import { DriveServiceType } from '../generated/entity/services/driveService';
import customDriveConnection from '../jsons/connectionSchemas/connections/drive/customDriveConnection.json';
import googleDriveConnection from '../jsons/connectionSchemas/connections/drive/googleDriveConnection.json';
import { getDriveConfig } from './DriveServiceUtils';

jest.mock('lodash', () => ({
  cloneDeep: jest.fn(),
}));

jest.mock('../constants/Services.constant', () => ({
  COMMON_UI_SCHEMA: {
    connection: {
      'ui:field': 'collapsible',
      'ui:widget': 'connectionConfig',
    },
  },
}));

jest.mock(
  '../jsons/connectionSchemas/connections/drive/customDriveConnection.json',
  () => ({
    $id: 'https://open-metadata.org/schema/entity/services/connections/drive/customDriveConnection.json',
    title: 'CustomDriveConnection',
    type: 'object',
    properties: {
      type: {
        title: 'Service Type',
        description: 'Service Type',
        type: 'string',
        enum: ['CustomDrive'],
        default: 'CustomDrive',
      },
    },
  })
);

jest.mock(
  '../jsons/connectionSchemas/connections/drive/googleDriveConnection.json',
  () => ({
    $id: 'https://open-metadata.org/schema/entity/services/connections/drive/googleDriveConnection.json',
    title: 'GoogleDriveConnection',
    type: 'object',
    properties: {
      type: {
        title: 'Service Type',
        description: 'Service Type',
        type: 'string',
        enum: ['GoogleDrive'],
        default: 'GoogleDrive',
      },
    },
  })
);

const mockedCloneDeep = cloneDeep as jest.MockedFunction<typeof cloneDeep>;

describe('DriveServiceUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCloneDeep.mockImplementation((obj) =>
      JSON.parse(JSON.stringify(obj))
    );
  });

  describe('getDriveConfig', () => {
    it('should return custom drive configuration for CustomDrive type', () => {
      const expectedResult = {
        schema: customDriveConnection,
        uiSchema: COMMON_UI_SCHEMA,
      };

      const result = getDriveConfig(DriveServiceType.CustomDrive);

      expect(mockedCloneDeep).toHaveBeenCalledWith(expectedResult);
      expect(result).toEqual(expectedResult);
    });

    it('should return google drive configuration for GoogleDrive type', () => {
      const expectedResult = {
        schema: googleDriveConnection,
        uiSchema: COMMON_UI_SCHEMA,
      };

      const result = getDriveConfig(DriveServiceType.GoogleDrive);

      expect(mockedCloneDeep).toHaveBeenCalledWith(expectedResult);
      expect(result).toEqual(expectedResult);
    });

    it('should return empty schema and common ui schema for unknown drive type', () => {
      const unknownType = 'UnknownDrive' as DriveServiceType;
      const expectedResult = {
        schema: {},
        uiSchema: COMMON_UI_SCHEMA,
      };

      const result = getDriveConfig(unknownType);

      expect(mockedCloneDeep).toHaveBeenCalledWith(expectedResult);
      expect(result).toEqual(expectedResult);
    });

    it('should return empty schema and common ui schema for default case', () => {
      // Test the default case by passing undefined as type
      getDriveConfig(undefined as unknown as DriveServiceType);
      const expectedResult = {
        schema: {},
        uiSchema: COMMON_UI_SCHEMA,
      };

      expect(mockedCloneDeep).toHaveBeenCalledWith(expectedResult);
    });

    it('should create a deep clone of the configuration object', () => {
      getDriveConfig(DriveServiceType.GoogleDrive);

      expect(mockedCloneDeep).toHaveBeenCalledTimes(1);
      expect(mockedCloneDeep).toHaveBeenCalledWith({
        schema: googleDriveConnection,
        uiSchema: COMMON_UI_SCHEMA,
      });
    });

    it('should not mutate the original COMMON_UI_SCHEMA object', () => {
      const originalUiSchema = { ...COMMON_UI_SCHEMA };

      getDriveConfig(DriveServiceType.CustomDrive);

      expect(COMMON_UI_SCHEMA).toEqual(originalUiSchema);
    });

    it('should handle all valid DriveServiceType enum values', () => {
      const driveServiceTypes = [
        DriveServiceType.CustomDrive,
        DriveServiceType.GoogleDrive,
      ];

      driveServiceTypes.forEach((type) => {
        expect(() => getDriveConfig(type)).not.toThrow();
        expect(mockedCloneDeep).toHaveBeenCalled();
      });
    });
  });
});
