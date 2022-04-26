/*
 *  Copyright 2021 Collate
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

import {
  createTag,
  createTagCategory,
  deleteTag,
  deleteTagCategory,
  getCategory,
  getTags,
  updateTag,
  updateTagCategory,
} from './tagAPI';

jest.mock('../utils/APIUtils', () => ({
  getURLWithQueryFields: jest
    .fn()
    .mockImplementation(
      (url, lstQueryFields) => `${url}?fields=${lstQueryFields}`
    ),
}));

jest.mock('./index.js', () => ({
  get: jest.fn().mockImplementation((url) => `get_request${url}`),
  delete: jest.fn().mockImplementation((url) => `delete_request${url}`),
  post: jest
    .fn()
    .mockImplementation((url, data) => ({ url: `post_request${url}`, data })),
  put: jest
    .fn()
    .mockImplementation((url, data) => ({ url: `put_request${url}`, data })),
}));

describe('API functions should work properly', () => {
  it('getTags function should work properly', () => {
    const result = getTags('querry');

    expect(result).toEqual(`get_request/tags?fields=querry`);
  });

  it('getCategory function should work properly', () => {
    const result = getCategory('categoryName', 'querry');

    expect(result).toEqual(`get_request/tags/categoryName?fields=querry`);
  });

  it('deleteTagCategory function should work properly', () => {
    const result = deleteTagCategory('categoryId');

    expect(result).toEqual(`delete_request/tags/categoryId`);
  });

  it('deleteTag function should work properly', () => {
    const result = deleteTag('testCategory', 'categoryId');

    expect(result).toEqual(`delete_request/tags/testCategory/categoryId`);
  });

  it('createTagCategory function should work properly', () => {
    const mockPostData = { name: 'testCategory' };
    const result = createTagCategory(mockPostData);

    expect(result).toEqual({ url: `post_request/tags`, data: mockPostData });
  });

  it('createTag function should work properly', () => {
    const mockPostData = { name: 'newTag' };
    const result = createTag('testCategory', mockPostData);

    expect(result).toEqual({
      url: `post_request/tags/testCategory`,
      data: mockPostData,
    });
  });

  it('updateTagCategory function should work properly', () => {
    const mockUpdateData = {
      name: 'testCategory',
      description: 'newDescription',
    };
    const result = updateTagCategory('testCategory', mockUpdateData);

    expect(result).toEqual({
      url: `put_request/tags/testCategory`,
      data: mockUpdateData,
    });
  });

  it('updateTag function should work properly', () => {
    const mockUpdateData = {
      name: 'tagName',
      description: 'newDescription',
    };
    const result = updateTag('testCategory', 'tagName', mockUpdateData);

    expect(result).toEqual({
      url: `put_request/tags/testCategory/tagName`,
      data: mockUpdateData,
    });
  });
});
