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
import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import {
  ContractAllResult,
  ContractResultFilter,
} from '../components/DataContract/ContractDetailTab/contract.interface';
import { EntityType } from '../enums/entity.enum';
import { CreateDataContract } from '../generated/api/data/createDataContract';
import {
  DataContract,
  EntityStatus,
} from '../generated/entity/data/dataContract';
import { ContractValidation } from '../generated/entity/datacontract/contractValidation';
import { DataContractResult } from '../generated/entity/datacontract/dataContractResult';
import { ListParams } from '../interface/API.interface';
import APIClient from './index';

const BASE_URL = '/dataContracts';

interface ListContractsParams extends ListParams {
  /**
   * status of the contract
   */
  status?: EntityStatus;
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
    `/dataContracts/name/${fqn}`
  );

  return response.data;
};

export const createContract = async (contract: CreateDataContract) => {
  const response = await APIClient.post<CreateDataContract>(
    `/dataContracts`,
    contract
  );

  return response.data;
};

export const updateContract = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<CreateDataContract>
  >(`/dataContracts/${id}`, data);

  return response.data;
};

export const deleteContract = async (fqn: string) => {
  const response = await APIClient.delete<void>(`/dataContracts/${fqn}`);

  return response.data;
};

export const getContractByEntityId = async (
  entityId: string,
  entityType: EntityType = EntityType.TABLE,
  fields: string[] = []
) => {
  const response = await APIClient.get<DataContract>(
    `/dataContracts/entity?entityId=${entityId}&entityType=${entityType}&fields=${fields.join(
      ','
    )}`
  );

  return response.data;
};

export const validateContractById = async (contractId: string) => {
  const response = await APIClient.post<void>(
    `/dataContracts/${contractId}/validate`
  );

  return response.data;
};

export const validateContractByEntityId = async (
  entityId: string,
  entityType: string
) => {
  const response = await APIClient.post<void>(
    `/dataContracts/entity/validate?entityId=${entityId}&entityType=${entityType}`
  );

  return response.data;
};

export const deleteContractById = async (contractId: string) => {
  const response = await APIClient.delete<void>(
    `/dataContracts/${contractId}?hardDelete=true&recursive=true`
  );

  return response.data;
};

export const getContractResultByResultId = async (
  contractId: string,
  resultId: string
) => {
  const response = await APIClient.get<DataContractResult>(
    `/dataContracts/${contractId}/results/${resultId}`
  );

  return response.data;
};

export const getLatestContractResults = async (contractId: string) => {
  const response = await APIClient.get<DataContractResult>(
    `/dataContracts/${contractId}/results/latest`
  );

  return response.data;
};

export const getAllContractResults = async (
  contractId: string,
  params: ContractResultFilter
) => {
  const response = await APIClient.get<ContractAllResult>(
    `/dataContracts/${contractId}/results`,
    {
      params,
    }
  );

  return response.data;
};

// ODCS (Open Data Contract Standard) Import/Export APIs

export interface ODCSDataContract {
  apiVersion: string;
  kind: string;
  id: string;
  name?: string;
  version: string;
  status: string;
  tenant?: string;
  domain?: string;
  dataProduct?: string;
  tags?: string[];
  description?: {
    purpose?: string;
    limitations?: string;
    usage?: string;
  };
  schema?: ODCSSchemaElement[];
  quality?: ODCSQualityRule[];
  support?: ODCSSupportChannel[];
  price?: ODCSPricing;
  team?: ODCSTeamMember[];
  roles?: ODCSRole[];
  slaProperties?: ODCSSlaProperty[];
  servers?: ODCSServer[];
  customProperties?: ODCSCustomProperty[];
  contractCreatedTs?: string;
}

export interface ODCSLogicalTypeOptions {
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  precision?: number;
  scale?: number;
  enumValues?: string[];
  items?: string;
  timezone?: boolean;
  defaultTimezone?: string;
}

export interface ODCSSchemaElement {
  name: string;
  physicalName?: string;
  physicalType?: string;
  description?: string;
  businessName?: string;
  tags?: string[];
  logicalType?:
    | 'string'
    | 'date'
    | 'timestamp'
    | 'time'
    | 'number'
    | 'integer'
    | 'object'
    | 'array'
    | 'boolean';
  logicalTypeOptions?: ODCSLogicalTypeOptions;
  primaryKey?: boolean;
  primaryKeyPosition?: number;
  required?: boolean;
  unique?: boolean;
  partitioned?: boolean;
  classification?: string;
  properties?: ODCSSchemaElement[];
}

export interface ODCSQualityRule {
  type?: string;
  name?: string;
  description?: string;
  rule?: string;
  column?: string;
  query?: string;
  engine?: string;
  dimension?: string;
  severity?: string;
  schedule?: string;
  scheduler?: string;
}

export interface ODCSSupportChannel {
  channel: string;
  url: string;
  description?: string;
  tool?: string;
  scope?: string;
}

export interface ODCSPricing {
  priceAmount?: number;
  priceCurrency?: string;
  priceUnit?: string;
}

export interface ODCSTeamMember {
  username?: string;
  name?: string;
  description?: string;
  role?: string;
  dateIn?: string;
  dateOut?: string;
}

export interface ODCSRole {
  role: string;
  description?: string;
  access?: string;
  firstLevelApprovers?: string[];
  secondLevelApprovers?: string[];
}

export interface ODCSSlaProperty {
  property: string;
  value: string;
  valueExt?: string;
  unit?: string;
  element?: string;
  driver?: string;
}

export interface ODCSServer {
  server: string;
  type: string;
  description?: string;
  environment?: string;
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
}

export interface ODCSCustomProperty {
  property?: string;
  value?: string;
}

/**
 * Export a data contract to ODCS v3.1.0 JSON format
 */
export const exportContractToODCS = async (
  contractId: string,
  fields?: string
): Promise<ODCSDataContract> => {
  const response = await APIClient.get<ODCSDataContract>(
    `${BASE_URL}/${contractId}/odcs`,
    { params: { fields } }
  );

  return response.data;
};

/**
 * Export a data contract to ODCS v3.1.0 YAML format
 */
export const exportContractToODCSYaml = async (
  contractId: string,
  fields?: string
): Promise<string> => {
  const response = await APIClient.get<string>(
    `${BASE_URL}/${contractId}/odcs/yaml`,
    {
      params: { fields },
      headers: { Accept: 'application/yaml' },
      responseType: 'text',
    }
  );

  return response.data;
};

/**
 * Export a data contract by FQN to ODCS v3.1.0 JSON format
 */
export const exportContractToODCSByFqn = async (
  fqn: string,
  fields?: string
): Promise<ODCSDataContract> => {
  const response = await APIClient.get<ODCSDataContract>(
    `${BASE_URL}/name/${fqn}/odcs`,
    { params: { fields } }
  );

  return response.data;
};

/**
 * Result from parsing ODCS YAML, including list of schema objects for multi-object contracts
 */
export interface ODCSParseResult {
  name?: string;
  version?: string;
  status?: string;
  schemaObjects?: string[];
  hasMultipleObjects?: boolean;
}

/**
 * Parse ODCS YAML and return metadata including schema object names
 * Use this to determine available objects for multi-object contracts before importing
 */
export const parseODCSYaml = async (
  yamlContent: string
): Promise<ODCSParseResult> => {
  const response = await APIClient.post<ODCSParseResult>(
    `${BASE_URL}/odcs/parse/yaml`,
    yamlContent,
    {
      headers: { 'Content-Type': 'application/yaml' },
    }
  );

  return response.data;
};

/**
 * Import a data contract from ODCS v3.1.0 JSON format
 * @param objectName Schema object name to import (for multi-object ODCS contracts)
 */
export const importContractFromODCS = async (
  odcs: ODCSDataContract,
  entityId: string,
  entityType: string,
  objectName?: string
): Promise<DataContract> => {
  const response = await APIClient.post<DataContract>(
    `${BASE_URL}/odcs`,
    odcs,
    { params: { entityId, entityType, objectName } }
  );

  return response.data;
};

/**
 * Import a data contract from ODCS v3.1.0 YAML format
 * @param objectName Schema object name to import (for multi-object ODCS contracts)
 */
export const importContractFromODCSYaml = async (
  yamlContent: string,
  entityId: string,
  entityType: string,
  objectName?: string
): Promise<DataContract> => {
  const response = await APIClient.post<DataContract>(
    `${BASE_URL}/odcs/yaml`,
    yamlContent,
    {
      params: { entityId, entityType, objectName },
      headers: { 'Content-Type': 'application/yaml' },
    }
  );

  return response.data;
};

/**
 * Create or update a data contract from ODCS v3.1.0 JSON format (smart merge)
 * @param objectName Schema object name to import (for multi-object ODCS contracts)
 */
export const createOrUpdateContractFromODCS = async (
  odcs: ODCSDataContract,
  entityId: string,
  entityType: string,
  objectName?: string
): Promise<DataContract> => {
  const response = await APIClient.put<DataContract>(`${BASE_URL}/odcs`, odcs, {
    params: { entityId, entityType, objectName },
  });

  return response.data;
};

/**
 * Schema validation result - used within ContractValidation.schemaValidation
 * @deprecated Use ContractValidation type instead for comprehensive validation results
 */
export interface SchemaValidation {
  passed?: number;
  failed?: number;
  total?: number;
  failedFields?: string[];
}

/**
 * Validate ODCS YAML against an entity without importing
 * Returns comprehensive validation results including entity errors, constraint errors,
 * and schema field mismatches
 * @param objectName Schema object name to validate (for multi-object ODCS contracts)
 */
export const validateODCSYaml = async (
  yamlContent: string,
  entityId: string,
  entityType: string,
  objectName?: string
): Promise<ContractValidation> => {
  const response = await APIClient.post<ContractValidation>(
    `${BASE_URL}/odcs/validate/yaml`,
    yamlContent,
    {
      params: { entityId, entityType, objectName },
      headers: { 'Content-Type': 'application/yaml' },
    }
  );

  return response.data;
};

/**
 * Validate OM format data contract request without creating the contract
 * Returns comprehensive validation results including entity errors, constraint errors,
 * and schema field mismatches
 */
export const validateContract = async (
  createRequest: CreateDataContract
): Promise<ContractValidation> => {
  const response = await APIClient.post<ContractValidation>(
    `${BASE_URL}/validate`,
    createRequest
  );

  return response.data;
};

/**
 * Validate OM format data contract YAML request without creating the contract
 * Returns comprehensive validation results including entity errors, constraint errors,
 * and schema field mismatches
 */
export const validateContractYaml = async (
  yamlContent: string
): Promise<ContractValidation> => {
  const response = await APIClient.post<ContractValidation>(
    `${BASE_URL}/validate/yaml`,
    yamlContent,
    {
      headers: { 'Content-Type': 'application/yaml' },
    }
  );

  return response.data;
};

/**
 * Create or update a data contract from ODCS v3.1.0 YAML format
 * @param mode 'merge' preserves existing fields, 'replace' overwrites all fields but preserves ID and history
 * @param objectName Schema object name to import (for multi-object ODCS contracts)
 */
export const createOrUpdateContractFromODCSYaml = async (
  yamlContent: string,
  entityId: string,
  entityType: string,
  mode: 'merge' | 'replace' = 'merge',
  objectName?: string
): Promise<DataContract> => {
  const response = await APIClient.put<DataContract>(
    `${BASE_URL}/odcs/yaml`,
    yamlContent,
    {
      params: { entityId, entityType, mode, objectName },
      headers: { 'Content-Type': 'application/yaml' },
    }
  );

  return response.data;
};
