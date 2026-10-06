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

import { act, renderHook } from '@testing-library/react';
import { LearningResource } from '../../../rest/learningResourceAPI';
import { useLearningResourceActions } from './useLearningResourceActions';

jest.mock('../../../rest/learningResourceAPI', () => ({
  deleteLearningResource: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const createResource = (
  resourceType: LearningResource['resourceType'],
  url: string
): LearningResource => ({
  id: `${resourceType}-resource`,
  name: `${resourceType}Resource`,
  resourceType,
  categories: ['Discovery'],
  source: { url },
  contexts: [{ pageId: 'domain' }],
});

describe('useLearningResourceActions', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('should open a Link resource in a new tab instead of the player when previewed', () => {
    const { result } = renderHook(() =>
      useLearningResourceActions({ onRefetch: jest.fn() })
    );

    act(() => {
      result.current.handlePreview(
        createResource('Link', 'https://sharepoint.example.com/sites/guide')
      );
    });

    expect(openSpy).toHaveBeenCalledWith(
      'https://sharepoint.example.com/sites/guide',
      '_blank',
      'noopener,noreferrer'
    );
    expect(result.current.isPlayerOpen).toBe(false);
    expect(result.current.selectedResource).toBeNull();
  });

  it('should open the resource player when a PDF resource is previewed', () => {
    const { result } = renderHook(() =>
      useLearningResourceActions({ onRefetch: jest.fn() })
    );
    const pdfResource = createResource(
      'PDF',
      'https://docs.example.com/guide.pdf'
    );

    act(() => {
      result.current.handlePreview(pdfResource);
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(result.current.isPlayerOpen).toBe(true);
    expect(result.current.selectedResource).toBe(pdfResource);
  });
});
