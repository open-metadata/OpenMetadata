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
import { ReactNode } from 'react';
import { DeleteType } from '../../components/common/DeleteWidget/DeleteWidget.interface';

export interface AsyncDeleteProviderProps {
  children: ReactNode;
}

export interface DeleteWidgetAsyncFormFields {
  entityName: string;
  entityId: string;
  entityType: string;
  deleteType: DeleteType;
  prepareType: boolean;
  isRecursiveDelete: boolean;
  afterDeleteAction?: (isSoftDelete?: boolean, version?: number) => void;
}

export interface AsyncDeleteContextType {
  asyncDeleteJob?: Partial<AsyncDeleteJob>;
  handleOnAsyncEntityDeleteConfirm: ({
    deleteType,
  }: DeleteWidgetAsyncFormFields) => Promise<void>;
  handleDeleteEntityWebsocketResponse: (
    response: AsyncDeleteWebsocketResponse
  ) => void;
}

export type AsyncDeleteResponse = {
  message: string;
};

export type AsyncDeleteWebsocketResponse = {
  jobId: string;
  status: 'COMPLETED' | 'FAILED';
  entityName: string;
  error: string | null;
};

export type AsyncDeleteJob = {
  hardDelete: boolean;
  recursive: boolean;
} & Partial<AsyncDeleteWebsocketResponse> &
  AsyncDeleteResponse;
