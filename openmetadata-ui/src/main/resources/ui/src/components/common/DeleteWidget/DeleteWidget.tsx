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

import { AxiosError, AxiosResponse } from 'axios';
import { startCase } from 'lodash';
import React, { Fragment, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { deleteEntity } from '../../../axiosAPIs/miscAPI';
import { ENTITY_DELETE_STATE } from '../../../constants/entity.constants';
import { EntityType } from '../../../enums/entity.enum';
import jsonData from '../../../jsons/en';
import { getEntityDeleteMessage } from '../../../utils/CommonUtils';
import { getTitleCase } from '../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import EntityDeleteModal from '../../Modals/EntityDeleteModal/EntityDeleteModal';
import { DeleteSectionProps } from './DeleteWidget.interface';
import DeleteWidgetBody from './DeleteWidgetBody';

const DeleteWidget = ({
  allowSoftDelete,
  entityName,
  entityType,
  hasPermission,
  isAdminUser,
  deletEntityMessage,
  entityId,
  isRecursiveDelete,
  afterDeleteAction,
}: DeleteSectionProps) => {
  const history = useHistory();
  const [entityDeleteState, setEntityDeleteState] =
    useState<typeof ENTITY_DELETE_STATE>(ENTITY_DELETE_STATE);

  const prepareDeleteMessage = (softDelete = false) => {
    const softDeleteText = `Soft deleting will deactivate the ${entityName}. This will disable any discovery, read or write operations on ${entityName}`;
    const hardDeleteText = getEntityDeleteMessage(getTitleCase(entityType), '');

    return softDelete ? softDeleteText : hardDeleteText;
  };

  const handleOnEntityDelete = (softDelete = false) => {
    setEntityDeleteState((prev) => ({ ...prev, state: true, softDelete }));
  };

  const handleOnEntityDeleteCancel = () => {
    setEntityDeleteState(ENTITY_DELETE_STATE);
  };

  const prepareEntityType = () => {
    const services = [
      EntityType.DASHBOARD_SERVICE,
      EntityType.DATABASE_SERVICE,
      EntityType.MESSAGING_SERVICE,
      EntityType.PIPELINE_SERVICE,
    ];

    if (services.includes((entityType || '') as EntityType)) {
      return `services/${entityType}s`;
    } else if (entityType === EntityType.GLOSSARY) {
      return `glossaries`;
    } else {
      return `${entityType}s`;
    }
  };

  const getMessage = (message: string) => {
    return message.replace('Entity', startCase(entityType));
  };

  const handleOnEntityDeleteConfirm = () => {
    setEntityDeleteState((prev) => ({ ...prev, loading: 'waiting' }));
    deleteEntity(
      prepareEntityType(),
      entityId,
      isRecursiveDelete,
      entityDeleteState.softDelete
    )
      .then((res: AxiosResponse) => {
        if (res.status === 200) {
          setTimeout(() => {
            handleOnEntityDeleteCancel();
            showSuccessToast(
              getMessage(
                jsonData['api-success-messages']['delete-entity-success']
              )
            );
            if (afterDeleteAction) {
              afterDeleteAction();
            } else {
              setTimeout(() => {
                history.push('/');
              }, 500);
            }
          }, 1000);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['unexpected-server-response']
          );
        }
      })
      .catch((error: AxiosError) => {
        showErrorToast(
          error,
          jsonData['api-error-messages']['delete-entity-error']
        );
      })
      .finally(() => {
        handleOnEntityDeleteCancel();
      });
  };

  const getDeleteModal = () => {
    if (entityDeleteState.state) {
      return (
        <EntityDeleteModal
          bodyText={
            deletEntityMessage ||
            prepareDeleteMessage(entityDeleteState.softDelete)
          }
          entityName={entityName}
          entityType={entityType}
          loadingState={entityDeleteState.loading}
          softDelete={entityDeleteState.softDelete}
          onCancel={handleOnEntityDeleteCancel}
          onConfirm={handleOnEntityDeleteConfirm}
        />
      );
    } else {
      return null;
    }
  };

  return (
    <Fragment>
      <div className="tw-mt-1 tw-bg-white" data-testid="danger-zone-container">
        <div className="tw-border tw-border-error-70 tw-rounded tw-mt-3">
          {allowSoftDelete && (
            <div className="tw-border-b" data-testid="soft-delete">
              <DeleteWidgetBody
                buttonText="Soft delete"
                description={prepareDeleteMessage(true)}
                hasPermission={hasPermission}
                header={`Soft delete ${getTitleCase(entityType)} ${entityName}`}
                isOwner={isAdminUser}
                onClick={() => handleOnEntityDelete(true)}
              />
            </div>
          )}
          <div data-testid="hard-delete">
            <DeleteWidgetBody
              buttonText="Delete"
              description={prepareDeleteMessage()}
              hasPermission={hasPermission}
              header={`Delete ${getTitleCase(entityType)} ${entityName}`}
              isOwner={isAdminUser}
              onClick={() => handleOnEntityDelete(false)}
            />
          </div>
        </div>
      </div>
      {getDeleteModal()}
    </Fragment>
  );
};

export default DeleteWidget;
