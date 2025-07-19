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
import { EntityType } from '../enums/entity.enum';
import { CreateDataContract } from '../generated/api/data/createDataContract';
import { DataContract } from '../generated/entity/data/dataContract';
import { ListParams } from '../interface/API.interface';
import APIClient from './index';

const BASE_URL = '/dataContracts';

interface ListContractsParams extends ListParams {
  /**
   * status of the contract
   */
  status?: 'Active';
  /**
   * entity ID to filter by
   */
  entity?: string;
}

export const listContracts = async (params: ListContractsParams) => {
  const response = await APIClient.get<DataContract[]>(`${BASE_URL}`, {
    params,
  });

  return response.data;
};

export const getContract = async (fqn: string) => {
  const response = await APIClient.get<CreateDataContract>(
    `/data-contracts/${fqn}`
  );

  return response.data;
};

export const createContract = async (contract: CreateDataContract) => {
  const response = await APIClient.post<CreateDataContract>(
    `/data-contracts`,
    contract
  );

  return response.data;
};

export const updateContract = async (
  fqn: string,
  contract: CreateDataContract
) => {
  const response = await APIClient.put<CreateDataContract>(
    `/data-contracts/${fqn}`,
    contract
  );

  return response.data;
};

export const deleteContract = async (fqn: string) => {
  const response = await APIClient.delete<void>(`/data-contracts/${fqn}`);

  return response.data;
};

export const getContractByEntityId = async (
  entityId: string,
  entityType: EntityType = EntityType.TABLE
) => {
  const response = await APIClient.get<DataContract>(
    `/dataContracts/entity?entityId=${entityId}&entityType=${entityType}`
  );

  return response.data;
};
