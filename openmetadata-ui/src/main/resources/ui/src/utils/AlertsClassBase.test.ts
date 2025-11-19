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

import { compare } from 'fast-json-patch';
import { DEFAULT_READ_TIMEOUT } from '../constants/Alerts.constants';
import { EntityType } from '../enums/entity.enum';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';
import {
  AlertType,
  EventSubscription,
  SubscriptionCategory,
  SubscriptionType,
} from '../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
} from '../pages/AddObservabilityPage/AddObservabilityPage.interface';
import {
  getConfigHeaderArrayFromObject,
  getConfigHeaderObjectFromArray,
  getConfigQueryParamsArrayFromObject,
  getConfigQueryParamsObjectFromArray,
  getRandomizedAlertName,
} from './Alerts/AlertsUtil';
import alertsClassBase, { AlertsClassBase } from './AlertsClassBase';
import { getEntityName } from './EntityUtils';
import { handleEntityCreationError } from './formUtils';
import { showSuccessToast } from './ToastUtils';

interface MockHeaderParam {
  key: string;
  value: string;
}

// Mock dependencies
jest.mock('./Alerts/AlertsUtil', () => ({
  getRandomizedAlertName: jest.fn(() => 'openMetadata_alert_abc123456'),
  getConfigHeaderObjectFromArray: jest.fn(
    (headers?: MockHeaderParam[]) =>
      headers?.reduce(
        (acc: Record<string, string>, curr: MockHeaderParam) => ({
          ...acc,
          [curr.key]: curr.value,
        }),
        {}
      ) ?? {}
  ),
  getConfigHeaderArrayFromObject: jest.fn((headers?: Record<string, string>) =>
    headers
      ? Object.entries(headers).map(([key, value]) => ({ key, value }))
      : undefined
  ),
  getConfigQueryParamsObjectFromArray: jest.fn(
    (params?: MockHeaderParam[]) =>
      params?.reduce(
        (acc: Record<string, string>, curr: MockHeaderParam) => ({
          ...acc,
          [curr.key]: curr.value,
        }),
        {}
      ) ?? {}
  ),
  getConfigQueryParamsArrayFromObject: jest.fn(
    (params?: Record<string, string>) =>
      params
        ? Object.entries(params).map(([key, value]) => ({ key, value }))
        : undefined
  ),
}));

jest.mock('./EntityUtils', () => ({
  getEntityName: jest.fn((entity) => entity?.displayName || entity?.name || ''),
}));

jest.mock('./ToastUtils', () => ({
  showSuccessToast: jest.fn(),
}));

jest.mock('./formUtils', () => ({
  handleEntityCreationError: jest.fn(),
}));

jest.mock('./i18next/LocalUtil', () => ({
  t: jest.fn((key: string, options?: Record<string, string>) => {
    if (key === 'server.create-entity-success') {
      return `Successfully created ${options?.entity ?? ''}`;
    }
    if (key === 'label.alert-plural') {
      return 'Alerts';
    }
    if (key === 'label.alert') {
      return 'Alert';
    }
    if (key === 'label.alert-lowercase') {
      return 'alert';
    }
    if (key === 'label.alert-lowercase-plural') {
      return 'alerts';
    }

    return key;
  }),
}));

jest.mock('fast-json-patch', () => ({
  compare: jest.fn(),
}));

describe('AlertsClassBase', () => {
  let alertsClass: AlertsClassBase;

  const mockUser: User = {
    id: 'user-id-123',
    name: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
  } as User;

  const mockDestinationData: ModifiedDestination = {
    type: SubscriptionType.Slack,
    category: SubscriptionCategory.External,
    destinationType: SubscriptionType.Slack,
    config: {
      endpoint: 'https://slack.com/webhook',
      headers: [
        { key: 'Authorization', value: 'Bearer token' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      queryParams: [
        { key: 'channel', value: 'alerts' },
        { key: 'user', value: 'admin' },
      ],
    },
    notifyDownstream: true,
    downstreamDepth: 2,
  };

  const mockModifiedData: ModifiedCreateEventSubscription = {
    name: 'Test Alert',
    displayName: 'Test Alert Display',
    description: 'Test alert description',
    alertType: AlertType.Notification,
    timeout: 15,
    readTimeout: 30,
    destinations: [mockDestinationData],
    input: {
      filters: [],
      actions: [],
    },
    owners: [],
    resources: [],
  };

  const mockInitialData: EventSubscription = {
    id: 'alert-id-123',
    name: 'openMetadata_alert_old123',
    displayName: 'Old Alert Display',
    description: 'Old alert description',
    fullyQualifiedName: 'test.alert',
    alertType: AlertType.Notification,
    destinations: [
      {
        type: SubscriptionType.Slack,
        category: SubscriptionCategory.External,
        config: {
          endpoint: 'https://slack.com/webhook',
          headers: { Authorization: 'Bearer old-token' },
          queryParams: { channel: 'old-channel' },
        },
        timeout: 10,
        readTimeout: DEFAULT_READ_TIMEOUT,
      },
    ],
    input: {
      filters: [],
      actions: [],
    },
    filteringRules: {
      resources: [],
    },
    owners: [],
  } as EventSubscription;

  beforeEach(() => {
    alertsClass = new AlertsClassBase();
    jest.clearAllMocks();
  });

  describe('getAddAlertFormExtraWidgets', () => {
    it('should return an empty widgets object by default', () => {
      const widgets = alertsClass.getAddAlertFormExtraWidgets();

      expect(widgets).toBeDefined();
      expect(typeof widgets).toBe('object');
      expect(Object.keys(widgets)).toHaveLength(0);
    });
  });

  describe('getCommonAlertFieldsData', () => {
    it('should generate alert name and display name from data', () => {
      const result = alertsClass.getCommonAlertFieldsData(mockModifiedData);

      expect(result).toBeDefined();
      expect(result.alertName).toBe('openMetadata_alert_abc123456');
      expect(result.alertDisplayName).toBe('Test Alert Display');
      expect(getRandomizedAlertName).toHaveBeenCalled();
      expect(getEntityName).toHaveBeenCalledWith(mockModifiedData);
    });

    it('should use initial alert name if provided', () => {
      const result = alertsClass.getCommonAlertFieldsData(
        mockModifiedData,
        mockInitialData
      );

      expect(result.alertName).toBe('openMetadata_alert_old123');
    });

    it('should format destinations correctly', () => {
      const result = alertsClass.getCommonAlertFieldsData(mockModifiedData);

      expect(result.destinations).toBeDefined();
      expect(result.destinations).toHaveLength(1);

      const destination = result.destinations?.[0];

      expect(destination?.type).toBe(SubscriptionType.Slack);
      expect(destination?.category).toBe(SubscriptionCategory.External);
      expect(destination?.timeout).toBe(15);
      expect(destination?.readTimeout).toBe(30);
      expect(destination?.notifyDownstream).toBe(true);
      expect(destination?.downstreamDepth).toBe(2);
    });

    it('should merge with initial destination data if available', () => {
      const result = alertsClass.getCommonAlertFieldsData(
        mockModifiedData,
        mockInitialData
      );

      const destination = result.destinations?.[0];

      expect(destination).toMatchObject({
        type: SubscriptionType.Slack,
        category: SubscriptionCategory.External,
      });
    });

    it('should transform headers and queryParams using utility functions', () => {
      alertsClass.getCommonAlertFieldsData(mockModifiedData);

      expect(getConfigHeaderObjectFromArray).toHaveBeenCalledWith(
        mockDestinationData.config?.headers
      );
      expect(getConfigQueryParamsObjectFromArray).toHaveBeenCalledWith(
        mockDestinationData.config?.queryParams
      );
    });
  });

  describe('getAlertCreationData', () => {
    it('should create alert data with all required fields', () => {
      const result = alertsClass.getAlertCreationData(
        mockModifiedData,
        undefined,
        mockUser
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('openMetadata_alert_abc123456');
      expect(result.displayName).toBe('Test Alert Display');
      expect(result.description).toBe('Test alert description');
      expect(result.destinations).toHaveLength(1);
    });

    it('should add user as owner when currentUser is provided', () => {
      const result = alertsClass.getAlertCreationData(
        mockModifiedData,
        undefined,
        mockUser
      );

      expect(result.owners).toBeDefined();
      expect(result.owners).toHaveLength(1);

      const owner = result.owners?.[0];

      expect(owner?.id).toBe(mockUser.id);
      expect(owner?.type).toBe(EntityType.USER);
    });

    it('should not add owner when currentUser is not provided', () => {
      const result = alertsClass.getAlertCreationData(mockModifiedData);

      // When no currentUser is provided, owners from mockModifiedData is used (empty array)
      expect(result.owners).toBeDefined();
      expect(result.owners).toEqual([]);
    });

    it('should exclude timeout and readTimeout from final data', () => {
      const result = alertsClass.getAlertCreationData(mockModifiedData);

      expect('timeout' in result).toBe(false);
      expect('readTimeout' in result).toBe(false);
    });

    it('should include all other properties from modified data', () => {
      const result = alertsClass.getAlertCreationData(mockModifiedData);

      expect(result.input).toEqual(mockModifiedData.input);
      expect(result.resources).toEqual(mockModifiedData.resources);
    });
  });

  describe('getAlertUpdateData', () => {
    it('should merge updated data with initial data', () => {
      const result = alertsClass.getAlertUpdateData(
        mockModifiedData,
        mockInitialData
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(mockInitialData.id);
      expect(result.name).toBe('openMetadata_alert_old123');
      expect(result.displayName).toBe('Test Alert Display');
      expect(result.description).toBe('Test alert description');
    });

    it('should update input filters and actions', () => {
      const updatedInput = {
        filters: [],
        actions: [],
      };
      const dataWithInput = {
        ...mockModifiedData,
        input: updatedInput,
      };

      const result = alertsClass.getAlertUpdateData(
        dataWithInput,
        mockInitialData
      );

      expect(result.input).toEqual(updatedInput);
    });

    it('should update owners correctly', () => {
      const updatedOwners: EntityReference[] = [
        { id: 'new-owner-id', type: EntityType.USER },
      ];
      const dataWithOwners = {
        ...mockModifiedData,
        owners: updatedOwners,
      };

      const result = alertsClass.getAlertUpdateData(
        dataWithOwners,
        mockInitialData
      );

      expect(result.owners).toEqual(updatedOwners);
    });

    it('should update filtering rules resources', () => {
      const updatedResources = ['resource1', 'resource2'];
      const dataWithResources = {
        ...mockModifiedData,
        resources: updatedResources,
      };

      const result = alertsClass.getAlertUpdateData(
        dataWithResources,
        mockInitialData
      );

      expect(result.filteringRules?.resources).toEqual(updatedResources);
    });

    it('should handle empty input gracefully', () => {
      const dataWithoutInput = {
        ...mockModifiedData,
        input: undefined,
      };

      const result = alertsClass.getAlertUpdateData(
        dataWithoutInput,
        mockInitialData
      );

      expect(result.input).toEqual({ actions: [], filters: [] });
    });
  });

  describe('handleAlertSave', () => {
    const mockCreateAPI = jest.fn();
    const mockUpdateAPI = jest.fn();
    const mockAfterSave = jest.fn();
    const mockSetInlineAlert = jest.fn();

    beforeEach(() => {
      mockCreateAPI.mockResolvedValue({
        id: 'new-alert-id',
        fullyQualifiedName: 'test.new.alert',
      });
      mockUpdateAPI.mockResolvedValue({
        id: 'updated-alert-id',
        fullyQualifiedName: 'test.updated.alert',
      });
      (compare as jest.Mock).mockReturnValue([
        { op: 'replace', path: '/displayName', value: 'New Name' },
      ]);
    });

    it('should create a new alert when fqn and initialData are not provided', async () => {
      await alertsClass.handleAlertSave({
        data: mockModifiedData,
        createAlertAPI: mockCreateAPI,
        updateAlertAPI: mockUpdateAPI,
        afterSaveAction: mockAfterSave,
        setInlineAlertDetails: mockSetInlineAlert,
        currentUser: mockUser,
      });

      expect(mockCreateAPI).toHaveBeenCalled();
      expect(mockUpdateAPI).not.toHaveBeenCalled();
      expect(showSuccessToast).toHaveBeenCalledWith(
        'Successfully created Alerts'
      );
      expect(mockAfterSave).toHaveBeenCalledWith('test.new.alert');
    });

    it('should update existing alert when fqn and initialData are provided', async () => {
      await alertsClass.handleAlertSave({
        data: mockModifiedData,
        fqn: 'test.alert',
        initialData: mockInitialData,
        createAlertAPI: mockCreateAPI,
        updateAlertAPI: mockUpdateAPI,
        afterSaveAction: mockAfterSave,
        setInlineAlertDetails: mockSetInlineAlert,
      });

      expect(mockUpdateAPI).toHaveBeenCalledWith(mockInitialData.id, [
        { op: 'replace', path: '/displayName', value: 'New Name' },
      ]);
      expect(mockCreateAPI).not.toHaveBeenCalled();
      expect(compare).toHaveBeenCalled();
      expect(showSuccessToast).toHaveBeenCalled();
      expect(mockAfterSave).toHaveBeenCalledWith('test.updated.alert');
    });

    it('should handle creation errors correctly', async () => {
      const mockError = new Error('Creation failed');
      mockCreateAPI.mockRejectedValue(mockError);

      await alertsClass.handleAlertSave({
        data: mockModifiedData,
        createAlertAPI: mockCreateAPI,
        updateAlertAPI: mockUpdateAPI,
        afterSaveAction: mockAfterSave,
        setInlineAlertDetails: mockSetInlineAlert,
      });

      expect(handleEntityCreationError).toHaveBeenCalledWith({
        error: mockError,
        entity: 'Alert',
        entityLowercase: 'alert',
        entityLowercasePlural: 'alerts',
        setInlineAlertDetails: mockSetInlineAlert,
        name: mockModifiedData.name,
        defaultErrorType: 'create',
      });
      expect(showSuccessToast).not.toHaveBeenCalled();
      expect(mockAfterSave).not.toHaveBeenCalled();
    });

    it('should handle update errors correctly', async () => {
      const mockError = new Error('Update failed');
      mockUpdateAPI.mockRejectedValue(mockError);

      await alertsClass.handleAlertSave({
        data: mockModifiedData,
        fqn: 'test.alert',
        initialData: mockInitialData,
        createAlertAPI: mockCreateAPI,
        updateAlertAPI: mockUpdateAPI,
        afterSaveAction: mockAfterSave,
        setInlineAlertDetails: mockSetInlineAlert,
      });

      expect(handleEntityCreationError).toHaveBeenCalled();
      expect(showSuccessToast).not.toHaveBeenCalled();
      expect(mockAfterSave).not.toHaveBeenCalled();
    });

    it('should call afterSaveAction with empty string if fullyQualifiedName is undefined', async () => {
      mockCreateAPI.mockResolvedValue({
        id: 'new-alert-id',
        fullyQualifiedName: undefined,
      });

      await alertsClass.handleAlertSave({
        data: mockModifiedData,
        createAlertAPI: mockCreateAPI,
        updateAlertAPI: mockUpdateAPI,
        afterSaveAction: mockAfterSave,
        setInlineAlertDetails: mockSetInlineAlert,
      });

      expect(mockAfterSave).toHaveBeenCalledWith('');
    });
  });

  describe('getModifiedAlertDataForForm', () => {
    it('should transform alert data for form consumption', () => {
      const result = alertsClass.getModifiedAlertDataForForm(mockInitialData);

      expect(result).toBeDefined();
      expect(result.timeout).toBe(10);
      expect(result.readTimeout).toBe(DEFAULT_READ_TIMEOUT);
    });

    it('should use default timeout values if not present', () => {
      const dataWithoutTimeouts = {
        ...mockInitialData,
        destinations: [
          {
            ...mockInitialData.destinations[0],
            timeout: undefined,
            readTimeout: undefined,
          },
        ],
      } as EventSubscription;

      const result =
        alertsClass.getModifiedAlertDataForForm(dataWithoutTimeouts);

      expect(result.timeout).toBe(10);
      expect(result.readTimeout).toBe(DEFAULT_READ_TIMEOUT);
    });

    it('should convert destinations to form format', () => {
      const result = alertsClass.getModifiedAlertDataForForm(mockInitialData);

      expect(result.destinations).toBeDefined();
      expect(result.destinations).toHaveLength(1);
      expect(result.destinations[0].destinationType).toBe(
        SubscriptionType.Slack
      );
    });

    it('should transform headers to array format', () => {
      alertsClass.getModifiedAlertDataForForm(mockInitialData);

      expect(getConfigHeaderArrayFromObject).toHaveBeenCalledWith(
        mockInitialData.destinations[0].config?.headers
      );
    });

    it('should transform queryParams to array format', () => {
      alertsClass.getModifiedAlertDataForForm(mockInitialData);

      expect(getConfigQueryParamsArrayFromObject).toHaveBeenCalledWith(
        mockInitialData.destinations[0].config?.queryParams
      );
    });

    it('should set destinationType based on category', () => {
      const internalDestination = {
        ...mockInitialData,
        destinations: [
          {
            ...mockInitialData.destinations[0],
            category: SubscriptionCategory.Admins,
            type: SubscriptionType.Email,
          },
        ],
      } as EventSubscription;

      const result =
        alertsClass.getModifiedAlertDataForForm(internalDestination);

      expect(result.destinations[0].destinationType).toBe(
        SubscriptionCategory.Admins
      );
    });

    it('should preserve all alert properties', () => {
      const result = alertsClass.getModifiedAlertDataForForm(mockInitialData);

      expect(result.id).toBe(mockInitialData.id);
      expect(result.name).toBe(mockInitialData.name);
      expect(result.displayName).toBe(mockInitialData.displayName);
      expect(result.description).toBe(mockInitialData.description);
      expect(result.fullyQualifiedName).toBe(
        mockInitialData.fullyQualifiedName
      );
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(alertsClassBase).toBeInstanceOf(AlertsClassBase);
    });

    it('should use the same instance across imports', () => {
      const instance1 = alertsClassBase;
      const instance2 = alertsClassBase;

      expect(instance1).toBe(instance2);
    });
  });
});
