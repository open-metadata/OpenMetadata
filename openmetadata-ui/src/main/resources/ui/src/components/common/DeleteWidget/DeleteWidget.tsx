import { AxiosError, AxiosResponse } from 'axios';
import React, { Fragment, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { deleteEntity } from '../../../axiosAPIs/miscAPI';
import { ENTITY_DELETE_STATE } from '../../../constants/entity.constants';
import { EntityType } from '../../../enums/entity.enum';
import jsonData from '../../../jsons/en';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import EntityDeleteModal from '../../Modals/EntityDeleteModal/EntityDeleteModal';
import DeleteWidgetBody from './DeleteWidgetBody';

interface DeleteSectionProps {
  allowSoftDelete?: boolean;
  entityName: string;
  entityType: string;
  deletEntityMessage?: string;
  hasPermission: boolean;
  isAdminUser?: boolean;
  entityId: string;
  isRecursiveDelete?: boolean;
}

const DeleteWidget = ({
  allowSoftDelete,
  entityName,
  entityType,
  hasPermission,
  isAdminUser,
  deletEntityMessage,
  entityId,
  isRecursiveDelete,
}: DeleteSectionProps) => {
  const history = useHistory();
  const [entityDeleteState, setEntityDeleteState] =
    useState<typeof ENTITY_DELETE_STATE>(ENTITY_DELETE_STATE);

  const prepareDeleteMessage = (softDelete = false) => {
    const softDeleteText = `Soft deleting will deactivate the ${entityName}. This will disable any discovery, read or write operations on ${entityName}`;
    const hardDeleteText = `Once you delete this ${entityType}, it will be removed permanently`;

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
    } else {
      return `${entityType}s`;
    }
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
              jsonData['api-success-messages']['delete-entity-success']
            );
            setTimeout(() => {
              history.push('/');
            }, 500);
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
          entityName={entityName as string}
          entityType={entityType as string}
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
      <p className="tw-text-base tw-font-medium">Delete section</p>
      <div className="tw-mt-1 tw-bg-white" data-testid="danger-zone">
        <div className="tw-border tw-border-error tw-rounded tw-mt-3 tw-shadow">
          {allowSoftDelete && (
            <div className="tw-border-b">
              <DeleteWidgetBody
                buttonText="Soft delete"
                description={prepareDeleteMessage(true)}
                hasPermission={hasPermission}
                header={`Soft delete ${entityType} ${entityName}`}
                isOwner={isAdminUser}
                onClick={() => handleOnEntityDelete(true)}
              />
            </div>
          )}

          <DeleteWidgetBody
            buttonText="Delete"
            description={prepareDeleteMessage()}
            hasPermission={hasPermission}
            header={`Delete ${entityType} ${entityName}`}
            isOwner={isAdminUser}
            onClick={() => handleOnEntityDelete(false)}
          />
        </div>
      </div>
      {getDeleteModal()}
    </Fragment>
  );
};

export default DeleteWidget;
