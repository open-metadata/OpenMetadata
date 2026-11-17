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
import APIClient from './axiosClient';
import {
  addAssetsToTags,
  createClassification,
  createTag,
  deleteClassification,
  deleteTag,
  exportClassificationInCSVFormat,
  getAllClassifications,
  getClassificationByName,
  getClassificationVersionData,
  getClassificationVersionsList,
  getTagByFqn,
  getTags,
  patchClassification,
  patchTag,
  removeAssetsFromTags,
  updateTag,
} from './tagAPI';

jest.mock('./axiosClient', () => ({
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
  patch: jest.fn().mockImplementation((url, data) =>
    Promise.resolve({
      data: { url: `patch_request${url}`, data },
    })
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

  it('getTagByFqn encodes reserved URI characters (:, /, ?, #, %, $) and forwards params', async () => {
    const fqn = 'Gov/Domain:1.PII/Email#1?v=2%ok$1';
    const params = { fields: 'owners,domains' };
    const result = await getTagByFqn(fqn, params);

    expect(result).toBe(
      'get_request/tags/name/Gov%2FDomain%3A1.PII%2FEmail%231%3Fv%3D2%25ok%241'
    );
    expect(APIClient.get).toHaveBeenLastCalledWith(
      '/tags/name/Gov%2FDomain%3A1.PII%2FEmail%231%3Fv%3D2%25ok%241',
      { params }
    );
  });

  it('getClassificationByName and exportClassificationInCSVFormat encode reserved URI characters', async () => {
    const classificationName = 'Gov/Domain:1#2?v=3%ok$1';
    const [byName, exported] = await Promise.all([
      getClassificationByName(classificationName),
      exportClassificationInCSVFormat(classificationName),
    ]);

    expect(byName).toBe(
      'get_request/classifications/name/Gov%2FDomain%3A1%232%3Fv%3D3%25ok%241'
    );
    expect(exported).toBe(
      'get_request/classifications/name/Gov%2FDomain%3A1%232%3Fv%3D3%25ok%241/exportAsync'
    );
  });

  it('supports classification list, version history, patches, and tag asset mutations', async () => {
    const patchOps = [
      { op: 'replace' as const, path: '/description', value: 'x' },
    ];
    const assets = [{ id: 't1', type: 'table' }];

    const [
      defaultList,
      pagedList,
      versionsList,
      versionData,
      patchedClassification,
      patchedTag,
      addedAssets,
      removedAssets,
    ] = await Promise.all([
      getAllClassifications(),
      getAllClassifications({ limit: 25 }),
      getClassificationVersionsList('cls-1'),
      getClassificationVersionData('cls-1', '0.2'),
      patchClassification('cls-1', patchOps),
      patchTag('tag-1', patchOps),
      addAssetsToTags('tag-1', assets),
      removeAssetsFromTags('tag-1', assets),
    ]);

    expect(defaultList).toBe('get_request/classifications');
    expect(pagedList).toBe('get_request/classifications');
    expect(versionsList).toBe('get_request/classifications/cls-1/versions');
    expect(versionData).toBe('get_request/classifications/cls-1/versions/0.2');
    expect(patchedClassification).toEqual({
      url: 'patch_request/classifications/cls-1',
      data: patchOps,
    });
    expect(patchedTag).toEqual({
      url: 'patch_request/tags/tag-1',
      data: patchOps,
    });
    expect(addedAssets).toEqual({
      url: 'put_request/tags/tag-1/assets/add',
      data: { assets, dryRun: false },
    });
    expect(removedAssets).toEqual({
      url: 'put_request/tags/tag-1/assets/remove',
      data: { assets, dryRun: false },
    });
  });
});
