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

import { Operation } from 'fast-json-patch';
import { CreateNotificationTemplate } from '../generated/api/events/createNotificationTemplate';
import {
  NotificationTemplate,
  ProviderType,
} from '../generated/entity/events/notificationTemplate';
import APIClient from '../rest/index';
import {
  createNotificationTemplate,
  deleteNotificationTemplate,
  getAllNotificationTemplates,
  getNotificationTemplateByFqn,
  patchNotificationTemplate,
  validateNotificationTemplate,
} from './notificationtemplateAPI';

jest.mock('./index');

describe('notificationtemplateAPI', () => {
  const mockAPIClient = APIClient as jest.Mocked<typeof APIClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotificationTemplate', () => {
    it('should create a notification template', async () => {
      const mockTemplate: NotificationTemplate = {
        id: 'test-id',
        name: 'test-template',
        displayName: 'Test Template',
        fullyQualifiedName: 'test.template',
        provider: ProviderType.User,
        templateSubject: 'Test Subject',
        templateBody: 'Test Body',
        updatedAt: 123456,
        deleted: false,
      };

      const createData: CreateNotificationTemplate = {
        name: 'test-template',
        displayName: 'Test Template',
        templateSubject: 'Test Subject',
        templateBody: 'Test Body',
      };

      mockAPIClient.post.mockResolvedValue({ data: mockTemplate });

      const result = await createNotificationTemplate(createData);

      expect(mockAPIClient.post).toHaveBeenCalledWith(
        '/notificationTemplates',
        createData
      );
      expect(result).toEqual(mockTemplate);
    });

    it('should handle creation errors', async () => {
      const createData: CreateNotificationTemplate = {
        name: 'test-template',
        displayName: 'Test Template',
        templateSubject: 'Test Subject',
        templateBody: 'Test Body',
      };

      mockAPIClient.post.mockRejectedValue(new Error('Creation failed'));

      await expect(createNotificationTemplate(createData)).rejects.toThrow(
        'Creation failed'
      );
    });
  });

  describe('patchNotificationTemplate', () => {
    it('should patch a notification template', async () => {
      const mockTemplate: NotificationTemplate = {
        id: 'test-id',
        name: 'test-template',
        displayName: 'Updated Template',
        fullyQualifiedName: 'test.template',
        provider: ProviderType.User,
        templateSubject: 'Test Subject',
        templateBody: 'Test Body',
        updatedAt: 123456,
        deleted: false,
      };

      const patchData: Operation[] = [
        { op: 'replace', path: '/displayName', value: 'Updated Template' },
      ];

      mockAPIClient.patch.mockResolvedValue({ data: mockTemplate });

      const result = await patchNotificationTemplate('test-id', patchData);

      expect(mockAPIClient.patch).toHaveBeenCalledWith(
        '/notificationTemplates/test-id',
        patchData
      );
      expect(result).toEqual(mockTemplate);
    });

    it('should handle patch errors', async () => {
      const patchData: Operation[] = [
        { op: 'replace', path: '/displayName', value: 'Updated' },
      ];

      mockAPIClient.patch.mockRejectedValue(new Error('Patch failed'));

      await expect(
        patchNotificationTemplate('test-id', patchData)
      ).rejects.toThrow('Patch failed');
    });
  });

  describe('getNotificationTemplateByFqn', () => {
    it('should get a notification template by FQN', async () => {
      const mockTemplate: NotificationTemplate = {
        id: 'test-id',
        name: 'test-template',
        displayName: 'Test Template',
        fullyQualifiedName: 'test.template',
        provider: ProviderType.User,
        templateSubject: 'Test Subject',
        templateBody: 'Test Body',
        updatedAt: 123456,
        deleted: false,
      };

      mockAPIClient.get.mockResolvedValue({ data: mockTemplate });

      const result = await getNotificationTemplateByFqn('test.template');

      expect(mockAPIClient.get).toHaveBeenCalledWith(
        '/notificationTemplates/name/test.template',
        { params: undefined }
      );
      expect(result).toEqual(mockTemplate);
    });

    it('should handle FQN with special characters', async () => {
      const mockTemplate: NotificationTemplate = {
        id: 'test-id',
        name: 'test-template',
        displayName: 'Test Template',
        fullyQualifiedName: 'test/template',
        provider: ProviderType.User,
        templateSubject: 'Test Subject',
        templateBody: 'Test Body',
        updatedAt: 123456,
        deleted: false,
      };

      mockAPIClient.get.mockResolvedValue({ data: mockTemplate });

      await getNotificationTemplateByFqn('test/template');

      expect(mockAPIClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/notificationTemplates/name/'),
        expect.any(Object)
      );
    });

    it('should pass params to the API call', async () => {
      const mockTemplate: NotificationTemplate = {
        id: 'test-id',
        name: 'test-template',
        displayName: 'Test Template',
        fullyQualifiedName: 'test.template',
        provider: ProviderType.User,
        templateSubject: 'Test Subject',
        templateBody: 'Test Body',
        updatedAt: 123456,
        deleted: false,
      };

      mockAPIClient.get.mockResolvedValue({ data: mockTemplate });

      const params = { fields: 'owner,tags' };
      await getNotificationTemplateByFqn('test.template', params);

      expect(mockAPIClient.get).toHaveBeenCalledWith(
        '/notificationTemplates/name/test.template',
        { params }
      );
    });

    it('should handle get errors', async () => {
      mockAPIClient.get.mockRejectedValue(new Error('Not found'));

      await expect(
        getNotificationTemplateByFqn('test.template')
      ).rejects.toThrow('Not found');
    });
  });

  describe('deleteNotificationTemplate', () => {
    it('should delete a notification template', async () => {
      mockAPIClient.delete.mockResolvedValue({});

      await deleteNotificationTemplate('test-id');

      expect(mockAPIClient.delete).toHaveBeenCalledWith(
        '/notificationTemplates/test-id'
      );
    });

    it('should handle delete errors', async () => {
      mockAPIClient.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(deleteNotificationTemplate('test-id')).rejects.toThrow(
        'Delete failed'
      );
    });
  });

  describe('getAllNotificationTemplates', () => {
    it('should get all notification templates', async () => {
      const mockResponse = {
        data: [
          {
            id: 'test-id-1',
            name: 'template-1',
            displayName: 'Template 1',
            fullyQualifiedName: 'test.template1',
            provider: ProviderType.User,
            templateSubject: 'Subject 1',
            templateBody: 'Body 1',
            updatedAt: 123456,
            deleted: false,
          },
          {
            id: 'test-id-2',
            name: 'template-2',
            displayName: 'Template 2',
            fullyQualifiedName: 'test.template2',
            provider: 'System',
            templateSubject: 'Subject 2',
            templateBody: 'Body 2',
            updatedAt: 123457,
            deleted: false,
          },
        ],
        paging: { total: 2 },
      };

      mockAPIClient.get.mockResolvedValue({ data: mockResponse });

      const result = await getAllNotificationTemplates();

      expect(mockAPIClient.get).toHaveBeenCalledWith('/notificationTemplates', {
        params: undefined,
      });
      expect(result).toEqual(mockResponse);
      expect(result.data).toHaveLength(2);
    });

    it('should pass params to the API call', async () => {
      const mockResponse = {
        data: [],
        paging: { total: 0 },
      };

      mockAPIClient.get.mockResolvedValue({ data: mockResponse });

      const params = { limit: 10, offset: 0, provider: ProviderType.User };
      await getAllNotificationTemplates(params);

      expect(mockAPIClient.get).toHaveBeenCalledWith('/notificationTemplates', {
        params,
      });
    });

    it('should handle empty results', async () => {
      const mockResponse = {
        data: [],
        paging: { total: 0 },
      };

      mockAPIClient.get.mockResolvedValue({ data: mockResponse });

      const result = await getAllNotificationTemplates();

      expect(result.data).toEqual([]);
      expect(result.paging.total).toBe(0);
    });

    it('should handle get all errors', async () => {
      mockAPIClient.get.mockRejectedValue(new Error('Fetch failed'));

      await expect(getAllNotificationTemplates()).rejects.toThrow(
        'Fetch failed'
      );
    });
  });

  describe('validateNotificationTemplate', () => {
    it('should validate a notification template successfully', async () => {
      const mockValidationResponse = {
        isValid: true,
      };

      mockAPIClient.post.mockResolvedValue({ data: mockValidationResponse });

      const result = await validateNotificationTemplate(
        'Test Subject',
        'Test Body'
      );

      expect(mockAPIClient.post).toHaveBeenCalledWith(
        '/notificationTemplates/validate',
        {
          templateSubject: 'Test Subject',
          templateBody: 'Test Body',
        }
      );
      expect(result).toEqual(mockValidationResponse);
      expect(result.isValid).toBe(true);
    });

    it('should return validation errors when template is invalid', async () => {
      const mockValidationResponse = {
        isValid: false,
        bodyError: 'Invalid handlebars syntax in body',
        subjectError: 'Invalid handlebars syntax in subject',
      };

      mockAPIClient.post.mockResolvedValue({ data: mockValidationResponse });

      const result = await validateNotificationTemplate(
        'Invalid {{#if}}',
        'Invalid {{each}}'
      );

      expect(result.isValid).toBe(false);
      expect(result.bodyError).toBeTruthy();
      expect(result.subjectError).toBeTruthy();
    });

    it('should handle empty template body', async () => {
      const mockValidationResponse = {
        isValid: false,
        bodyError: 'Template body cannot be empty',
      };

      mockAPIClient.post.mockResolvedValue({ data: mockValidationResponse });

      const result = await validateNotificationTemplate('Subject', '');

      expect(result.isValid).toBe(false);
      expect(result.bodyError).toBeTruthy();
    });

    it('should handle empty template subject', async () => {
      const mockValidationResponse = {
        isValid: false,
        subjectError: 'Template subject cannot be empty',
      };

      mockAPIClient.post.mockResolvedValue({ data: mockValidationResponse });

      const result = await validateNotificationTemplate('', 'Body');

      expect(result.isValid).toBe(false);
      expect(result.subjectError).toBeTruthy();
    });

    it('should handle validation API errors', async () => {
      mockAPIClient.post.mockRejectedValue(new Error('Validation failed'));

      await expect(
        validateNotificationTemplate('Subject', 'Body')
      ).rejects.toThrow('Validation failed');
    });

    it('should validate templates with handlebars variables', async () => {
      const mockValidationResponse = {
        isValid: true,
      };

      mockAPIClient.post.mockResolvedValue({ data: mockValidationResponse });

      const result = await validateNotificationTemplate(
        'Hello {{userName}}',
        'Your email is {{userEmail}}'
      );

      expect(mockAPIClient.post).toHaveBeenCalledWith(
        '/notificationTemplates/validate',
        {
          templateSubject: 'Hello {{userName}}',
          templateBody: 'Your email is {{userEmail}}',
        }
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate templates with handlebars helpers', async () => {
      const mockValidationResponse = {
        isValid: true,
      };

      mockAPIClient.post.mockResolvedValue({ data: mockValidationResponse });

      const result = await validateNotificationTemplate(
        'Subject',
        '{{#if condition}}Content{{/if}}'
      );

      expect(result.isValid).toBe(true);
    });
  });
});
