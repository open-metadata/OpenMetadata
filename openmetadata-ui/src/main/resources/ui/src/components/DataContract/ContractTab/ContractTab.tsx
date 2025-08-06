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
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataContractTabMode } from '../../../constants/DataContract.constants';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import {
  deleteContractById,
  getContractByEntityId,
} from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import DeleteWidgetModal from '../../common/DeleteWidget/DeleteWidgetModal';
import Loader from '../../common/Loader/Loader';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import AddDataContract from '../AddDataContract/AddDataContract';
import { ContractDetail } from '../ContractDetailTab/ContractDetail';
import './contract-tab.less';

export const ContractTab = () => {
  const {
    data: { id },
  } = useGenericContext();
  const { t } = useTranslation();
  const [tabMode, setTabMode] = useState<DataContractTabMode>(
    DataContractTabMode.VIEW
  );
  const [contract, setContract] = useState<DataContract>();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const fetchContract = async () => {
    try {
      setIsLoading(true);
      const contract = await getContractByEntityId(id, EntityType.TABLE, [
        TabSpecificField.OWNERS,
      ]);
      setContract(contract);
    } catch {
      setContract(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (contract?.id) {
      setIsDeleteModalVisible(true);
    }
  };

  const handleContractDeleteConfirm = async () => {
    if (!contract?.id) {
      return;
    }
    try {
      await deleteContractById(contract.id);
      showSuccessToast(
        t('server.entity-deleted-successfully', {
          entity: t('label.contract'),
        })
      );
      fetchContract();
      setTabMode(DataContractTabMode.VIEW);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }

    setIsDeleteModalVisible(false);
  };

  useEffect(() => {
    fetchContract();
  }, [id]);

  const content = useMemo(() => {
    switch (tabMode) {
      case DataContractTabMode.ADD:
        return (
          <AddDataContract
            contract={contract}
            onCancel={() => {
              setTabMode(DataContractTabMode.VIEW);
            }}
            onSave={() => {
              fetchContract();
              setTabMode(DataContractTabMode.VIEW);
            }}
          />
        );

      case DataContractTabMode.EDIT:
        return (
          <AddDataContract
            contract={contract}
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
            onDelete={handleDelete}
            onEdit={() => {
              setTabMode(
                contract ? DataContractTabMode.EDIT : DataContractTabMode.ADD
              );
            }}
          />
        );
    }
  }, [tabMode, contract]);

  return isLoading ? (
    <Loader />
  ) : (
    <div className="contract-tab-container">
      {content}
      <DeleteWidgetModal
        allowSoftDelete={false}
        entityName={contract?.name ?? ''}
        entityType={EntityType.DATA_CONTRACT}
        visible={isDeleteModalVisible}
        onCancel={() => {
          setIsDeleteModalVisible(false);
        }}
        onDelete={handleContractDeleteConfirm}
      />
    </div>
  );
};
