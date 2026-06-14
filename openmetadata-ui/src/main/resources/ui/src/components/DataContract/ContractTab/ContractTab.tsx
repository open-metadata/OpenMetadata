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

import { AxiosError } from 'axios';
import { lazy, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataContractTabMode } from '../../../constants/DataContract.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import {
  deleteContractById,
  getContractByEntityId,
} from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import DeleteModal from '../../common/DeleteModal/DeleteModal';
import Loader from '../../common/Loader/Loader';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import './contract-tab.less';

const AddDataContract = withSuspenseFallback(
  lazy(() => import('../AddDataContract/AddDataContract'))
);

const ContractDetail = withSuspenseFallback(
  lazy(() =>
    import('../ContractDetailTab/ContractDetail').then((m) => ({
      default: m.ContractDetail,
    }))
  )
);

export const ContractTab = () => {
  const { data: entityData } = useGenericContext();
  const { getEntityPermission, getResourcePermission } =
    usePermissionProvider();
  const { t } = useTranslation();
  const [tabMode, setTabMode] = useState<DataContractTabMode>(
    DataContractTabMode.VIEW
  );
  const [contract, setContract] = useState<DataContract>();
  const [contractPermissions, setContractPermissions] =
    useState<OperationPermission>();
  const [dataContractResourcePermissions, setDataContractResourcePermissions] =
    useState<OperationPermission>();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const { id, name: entityName } = entityData ?? {};

  const hasEditPermission = contract
    ? Boolean(contractPermissions?.EditAll)
    : Boolean(dataContractResourcePermissions?.Create);

  const fetchContractPermissions = async (contractId: string) => {
    try {
      const permissions = await getEntityPermission(
        ResourceEntity.DATA_CONTRACT,
        contractId
      );
      setContractPermissions(permissions);
    } catch {
      setContractPermissions(undefined);
    }
  };

  const fetchDataContractResourcePermissions = async () => {
    try {
      const permissions = await getResourcePermission(
        ResourceEntity.DATA_CONTRACT
      );
      setDataContractResourcePermissions(permissions);
    } catch {
      setDataContractResourcePermissions(undefined);
    }
  };

  const fetchContract = async () => {
    try {
      setIsLoading(true);
      const fetchedContract = await getContractByEntityId(id, entityType, [
        TabSpecificField.OWNERS,
      ]);
      setContract(fetchedContract);
      if (fetchedContract?.id) {
        await fetchContractPermissions(fetchedContract.id);
      } else {
        await fetchDataContractResourcePermissions();
      }
    } catch {
      setContract(undefined);
      setContractPermissions(undefined);
      await fetchDataContractResourcePermissions();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (contract?.id) {
      setIsDeleteModalVisible(true);
    }
  };

  const handleContractDeleteConfirm = async () => {
    if (!contract?.id) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteContractById(contract.id);
      showSuccessToast(
        t('server.entity-deleted-successfully', {
          entity: t('label.contract'),
        })
      );
      fetchContract();
      setTabMode(DataContractTabMode.VIEW);
      setIsDeleteModalVisible(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchContract();
  }, [id]);

  // Check if the contract is inherited from a Data Product
  // If so, editing should create a NEW contract for this asset, not modify the parent's
  const isInheritedContract = Boolean(contract?.inherited);

  const content = useMemo(() => {
    switch (tabMode) {
      case DataContractTabMode.ADD:
      case DataContractTabMode.EDIT:
        return (
          <AddDataContract
            // Don't pass the inherited contract - we want to CREATE a new one for this asset
            // Only pass the contract if it's a direct (non-inherited) contract being edited
            contract={
              tabMode === DataContractTabMode.EDIT && !isInheritedContract
                ? contract
                : undefined
            }
            onCancel={() => {
              setTabMode(DataContractTabMode.VIEW);
            }}
            onSave={() => {
              fetchContract();
              setTabMode(DataContractTabMode.VIEW);
            }}
          />
        );

      case DataContractTabMode.VIEW:
        return (
          <ContractDetail
            contract={contract}
            entityId={id ?? ''}
            entityName={entityName}
            entityType={entityType}
            hasEditPermission={hasEditPermission}
            onContractUpdated={fetchContract}
            onDelete={handleDelete}
            onEdit={() => {
              // If contract is inherited, use ADD mode to create a new contract for this asset
              // Only use EDIT mode for direct (non-inherited) contracts
              setTabMode(
                contract && !isInheritedContract
                  ? DataContractTabMode.EDIT
                  : DataContractTabMode.ADD
              );
            }}
          />
        );
    }
  }, [tabMode, contract, entityName, isInheritedContract, hasEditPermission]);

  return isLoading ? (
    <Loader />
  ) : (
    <div className="contract-tab-container">
      {content}
      <DeleteModal
        entityTitle={contract?.name ?? ''}
        isDeleting={isDeleting}
        message={t('message.are-you-sure-you-want-to-delete-this-entity', {
          entity: t('label.contract'),
        })}
        open={isDeleteModalVisible}
        onCancel={() => setIsDeleteModalVisible(false)}
        onDelete={handleContractDeleteConfirm}
      />
    </div>
  );
};
