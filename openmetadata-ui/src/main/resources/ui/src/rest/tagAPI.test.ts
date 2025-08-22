/*
 *  Copyright 2022 Collate.
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

import { Classification } from '../generated/entity/classification/classification';
import {
  createClassification,
  createTag,
  deleteClassification,
  deleteTag,
  getClassificationByName,
  getTags,
  updateTag,
} from './tagAPI';

jest.mock('./index', () => ({
  get: jest
    .fn()
    .mockImplementation((url) =>
      Promise.resolve({ data: `get_request${url}` })
    ),
  delete: jest
    .fn()
    .mockImplementation((url) =>
      Promise.resolve({ data: `delete_request${url}` })
    ),
  post: jest.fn().mockImplementation((url, data) =>
    Promise.resolve({
      data: { url: `post_request${url}`, data },
    })
  ),
  put: jest.fn().mockImplementation((url, data) =>
    Promise.resolve({
      data: { url: `put_request${url}`, data },
    })
  ),
}));

describe('API functions should work properly', () => {
  it('getTags function should work properly', async () => {
    const data = await getTags({});

    expect(data).toBe(`get_request/tags`);
  });

  it('getClassificationByName function should work properly', async () => {
    const result = await getClassificationByName('categoryName');

    expect(result).toBe(`get_request/classifications/name/categoryName`);
  });

  it('deleteClassification function should work properly', async () => {
    const result = await deleteClassification('classificationId');

    expect(result).toBe(
      `delete_request/classifications/classificationId?recursive=true&hardDelete=true`
    );
  });

  // TODO:9259 deleting tag with classificationId?
  it('deleteTag function should work properly', async () => {
    const result = await deleteTag('classificationId');

    expect(result).toBe(`delete_request/tags/classificationId`);
  });

  it('createClassification function should work properly', async () => {
    const mockPostData = {
      name: 'testCategory',
    } as Classification;
    const result = await createClassification({
      ...mockPostData,
      domains: undefined,
    });

    expect(result).toEqual({
      url: `post_request/classifications`,
      data: mockPostData,
    });
  });

  it('createTag function should work properly', async () => {
    const mockPostData = { name: 'newTag', id: 'tagId' } as Classification;
    const result = await createTag({ ...mockPostData, domains: undefined });

    expect(result).toEqual({
      url: `post_request/tags`,
      data: mockPostData,
    });
  });

  it('updateTag function should work properly', async () => {
    const mockUpdateData = {
      name: 'tagName',
      description: 'newDescription',
      id: 'tagId',
    };
    const result = await updateTag(mockUpdateData);

    expect(result).toEqual({
      url: `put_request/tags`,
      data: mockUpdateData,
    });
  });
});
