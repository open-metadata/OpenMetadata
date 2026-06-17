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
import { PagingResponse } from 'Models';
import { Asset, AssetType } from '../generated/attachments/asset';
import { ContextFile } from '../generated/entity/data/contextFile';
import { Folder } from '../generated/entity/data/folder';
import { ListParams } from '../interface/API.interface';
import APIClient from './index';

export interface CreateFolderRequest {
  name: string;
  displayName?: string;
}

export const createFolder = async (
  data: CreateFolderRequest
): Promise<Folder> => {
  const response = await APIClient.post<Folder>(
    '/contextCenter/drive/folders',
    data
  );

  return response.data;
};

export const listFolders = async (): Promise<Folder[]> => {
  const response = await APIClient.get<{ data: Folder[] }>(
    '/contextCenter/drive/folders'
  );

  return response.data.data ?? [];
};

export const deleteFolder = async (
  id: string,
  hardDelete = false
): Promise<void> => {
  await APIClient.delete(`/contextCenter/drive/folders/${id}`, {
    params: { hardDelete },
  });
};

export const listContextFiles = async (params: ListParams = {}) => {
  const response = await APIClient.get<PagingResponse<ContextFile[]>>(
    '/contextCenter/drive/files',
    { params: { fields: 'folder,memoryCount', limit: 100, ...params } }
  );

  return response.data;
};

export const moveFileToFolder = async (
  driveFileId: string,
  folderId: string
): Promise<void> => {
  await APIClient.put(`/contextCenter/drive/files/${driveFileId}/move`, {
    folder: { id: folderId, type: 'folder' },
  });
};

export const uploadDriveFile = async (
  file: File,
  folderFqn?: string
): Promise<ContextFile> => {
  const formData = new FormData();
  formData.append('file', file);

  if (folderFqn) {
    formData.append('folder', folderFqn);
  }

  const response = await APIClient.post<FormData, AxiosResponse<ContextFile>>(
    '/contextCenter/drive/files/upload',
    formData
  );

  return response.data;
};

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
    formData
  );

  return response.data;
};

export const listAssetsByFqn = async (
  fqn: string,
  assetType: AssetType = AssetType.External,
  params?: ListParams
) => {
  const response = await APIClient.get<PagingResponse<Asset[]>>(
    `/attachments/fqn/${encodeURIComponent(fqn)}/${assetType}`,
    { params }
  );

  return response.data;
};

export const deleteDriveFile = async (
  id: string,
  hardDelete = false
): Promise<void> => {
  await APIClient.delete(`/contextCenter/drive/files/${id}`, {
    params: { hardDelete },
  });
};

export const listArchivedContextFiles = async (): Promise<ContextFile[]> => {
  const response = await APIClient.get<{ data: ContextFile[] }>(
    '/contextCenter/drive/files',
    { params: { include: 'deleted', limit: 1000 } }
  );

  return response.data.data ?? [];
};

export const restoreDriveFile = async (id: string): Promise<ContextFile> => {
  const response = await APIClient.put<
    { id: string },
    AxiosResponse<ContextFile>
  >('/contextCenter/drive/files/restore', { id });

  return response.data;
};

export const downloadDriveFile = async (id: string): Promise<Blob> => {
  const response = await APIClient.get<Blob>(
    `/contextCenter/drive/files/${id}/download`,
    { params: { redirect: true, expiry: 300 }, responseType: 'blob' }
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

export const downloadAsset = async (id: string): Promise<Blob> => {
  const response = await APIClient.get<Blob>(`/attachments/${id}/download`, {
    params: { direct: false },
    responseType: 'blob',
  });

  return response.data;
};
