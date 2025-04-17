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
import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteType } from '../../components/common/DeleteWidget/DeleteWidget.interface';
import { deleteAsyncEntity } from '../../rest/miscAPI';
import deleteWidgetClassBase from '../../utils/DeleteWidget/DeleteWidgetClassBase';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
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
  const [asyncDeleteJob, setAsyncDeleteJob] =
    useState<Partial<AsyncDeleteJob>>();
  const asyncDeleteJobRef = useRef<Partial<AsyncDeleteJob>>();

  const handleOnAsyncEntityDeleteConfirm = async ({
    entityName,
    entityId,
    entityType,
    deleteType,
    prepareType,
    isRecursiveDelete,
    afterDeleteAction,
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

      // In case of recursive delete if false and the deleting entity has data.
      // sometime socket throw the error before the API response
      if (asyncDeleteJobRef.current?.status === 'FAILED') {
        showErrorToast(
          asyncDeleteJobRef.current.error ??
            t('server.delete-entity-error', {
              entity: entityName,
            })
        );

        return;
      }

      setAsyncDeleteJob(response);
      asyncDeleteJobRef.current = response;
      showSuccessToast(response.message);
      if (afterDeleteAction) {
        afterDeleteAction(deleteType === DeleteType.SOFT_DELETE);
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.delete-entity-error', {
          entity: entityName,
        })
      );
    }
  };

  const handleDeleteEntityWebsocketResponse = (
    response: AsyncDeleteWebsocketResponse
  ) => {
    const updatedAsyncDeleteJob: Partial<AsyncDeleteJob> = {
      ...response,
      ...asyncDeleteJob,
    };
    setAsyncDeleteJob(updatedAsyncDeleteJob);
    asyncDeleteJobRef.current = updatedAsyncDeleteJob;

    if (response.status === 'FAILED') {
      showErrorToast(
        response.error ??
          t('server.delete-entity-error', {
            entity: response.entityName,
          })
      );
    }

    if (response.status === 'COMPLETED') {
      showSuccessToast(
        t('server.entity-deleted-successfully', {
          entity: response.entityName,
        })
      );
    }
  };

  const activityFeedContextValues = useMemo(() => {
    return {
      asyncDeleteJob,
      handleOnAsyncEntityDeleteConfirm,
      handleDeleteEntityWebsocketResponse,
    };
  }, [handleOnAsyncEntityDeleteConfirm, handleDeleteEntityWebsocketResponse]);

  return (
    <AsyncDeleteContext.Provider value={activityFeedContextValues}>
      {children}
    </AsyncDeleteContext.Provider>
  );
};

export const useAsyncDeleteProvider = () => useContext(AsyncDeleteContext);

export default AsyncDeleteProvider;
