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
import { AxiosResponse } from 'axios';
import { Asset, AssetType } from '../generated/attachments/asset';
import APIClient from './index';

export const uploadAsset = async (
  file: File,
  entityLink: string,
  assetType: AssetType = AssetType.External
): Promise<Asset> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityLink', entityLink);
  formData.append('assetType', assetType);

  const response = await APIClient.post<FormData, AxiosResponse<Asset>>(
    '/attachments/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );

  return response.data;
};

export const listAssetsByFqn = async (
  fqn: string,
  assetType: AssetType = AssetType.External
): Promise<Asset[]> => {
  const response = await APIClient.get<Asset[]>(
    `/attachments/fqn/${encodeURIComponent(fqn)}/${assetType}`
  );

  return response.data;
};

export const deleteAsset = async (
  id: string,
  hardDelete = false
): Promise<void> => {
  await APIClient.delete(`/attachments/${id}`, {
    params: { hardDelete },
  });
};
