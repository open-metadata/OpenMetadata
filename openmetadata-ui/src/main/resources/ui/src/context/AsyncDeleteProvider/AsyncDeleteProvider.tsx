/*
 *  Copyright 2023 Collate.
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
import { AxiosError } from 'axios';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteType } from '../../components/common/DeleteWidget/DeleteWidget.interface';
import { deleteAsyncEntity } from '../../rest/miscAPI';
import deleteWidgetClassBase from '../../utils/DeleteWidget/DeleteWidgetClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  AsyncDeleteContextType,
  AsyncDeleteJob,
  AsyncDeleteProviderProps,
  AsyncDeleteWebsocketResponse,
  DeleteWidgetAsyncFormFields,
} from './AsyncDeleteProvider.interface';

export const AsyncDeleteContext = createContext({} as AsyncDeleteContextType);

const AsyncDeleteProvider = ({ children }: AsyncDeleteProviderProps) => {
  const { t } = useTranslation();
  const [asyncDeleteJob, setAsyncDeleteJob] = useState<
    Record<string, Partial<AsyncDeleteJob>>
  >({});
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  const handleOnAsyncEntityDeleteConfirm = async ({
    entityName,
    entityId,
    entityType,
    deleteType,
    prepareType,
    isRecursiveDelete,
  }: DeleteWidgetAsyncFormFields) => {
    try {
      const response = await deleteAsyncEntity(
        prepareType
          ? deleteWidgetClassBase.prepareEntityType(entityType)
          : entityType,
        entityId ?? '',
        Boolean(isRecursiveDelete),
        deleteType === DeleteType.HARD_DELETE
      );

      const jobId = response.jobId ?? '';
      setAsyncDeleteJob((prev) => ({
        ...prev,
        [jobId]: response,
      }));
      setIsDeleting((prev) => ({ ...prev, [jobId]: true }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.delete-entity-error', {
          entity: entityName,
        })
      );
    }
  };

  const showDeleteEntityAlertBanner = (
    response: AsyncDeleteWebsocketResponse
  ) => {
    const updatedAsyncDeleteJob: Partial<AsyncDeleteJob> = {
      ...response,
      ...asyncDeleteJob,
    };

    setAsyncDeleteJob((prev) => ({
      ...prev,
      [response.jobId ?? '']: updatedAsyncDeleteJob,
    }));

    if (response.status === 'COMPLETED') {
      setAsyncDeleteJob((prev) => {
        const { [response.jobId ?? '']: _, ...rest } = prev;

        return rest;
      });
    }

    setIsDeleting((prev) => ({ ...prev, [response.jobId ?? '']: false }));
  };

  const activityFeedContextValues = useMemo(() => {
    return {
      isDeleting,
      asyncDeleteJob,
      handleOnAsyncEntityDeleteConfirm,
      showDeleteEntityAlertBanner,
    };
  }, [handleOnAsyncEntityDeleteConfirm, showDeleteEntityAlertBanner]);

  return (
    <AsyncDeleteContext.Provider value={activityFeedContextValues}>
      {children}
    </AsyncDeleteContext.Provider>
  );
};

export const useAsyncDeleteProvider = () => useContext(AsyncDeleteContext);

export default AsyncDeleteProvider;
