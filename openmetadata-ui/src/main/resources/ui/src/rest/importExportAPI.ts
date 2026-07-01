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
import { EntityType } from '../enums/entity.enum';
import { CSVImportAsyncResponse } from '../pages/EntityImport/BulkEntityImportPage/BulkEntityImportPage.interface';
import { getEncodedFqn } from '../utils/StringUtils';
import APIClient from './index';

export interface importEntityInCSVFormatRequestParams {
  entityType: EntityType;
  name: string;
  data: string;
  dryRun?: boolean;
  recursive?: boolean;
  targetEntityType?: string;
}

export const importTestCaseInCSVFormat = async ({
  name,
  data,
  dryRun = true,
  recursive = false,
  targetEntityType,
}: importEntityInCSVFormatRequestParams) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
  };
  let url = `/dataQuality/testCases/name/${getEncodedFqn(
    name
  )}/importAsync?dryRun=${dryRun}&recursive=${recursive}`;

  if (targetEntityType) {
    url += `&targetEntityType=${targetEntityType}`;
  }
  const res = await APIClient.put<
    string,
    AxiosResponse<CSVImportAsyncResponse>
  >(url, data, configOptions);

  return res.data;
};

export const importEntityInCSVFormat = async ({
  entityType,
  name,
  data,
  dryRun = true,
  recursive = false,
}: importEntityInCSVFormatRequestParams) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
  };
  const res = await APIClient.put<
    string,
    AxiosResponse<CSVImportAsyncResponse>
  >(
    `/${entityType}s/name/${getEncodedFqn(
      name
    )}/importAsync?dryRun=${dryRun}&recursive=${recursive}`,
    data,
    configOptions
  );

  return res.data;
};

export const importServiceInCSVFormat = async ({
  entityType,
  name,
  data,
  dryRun = true,
  recursive = false,
}: importEntityInCSVFormatRequestParams) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
  };
  const res = await APIClient.put<
    string,
    AxiosResponse<CSVImportAsyncResponse>
  >(
    `services/${entityType}s/name/${getEncodedFqn(
      name
    )}/importAsync?dryRun=${dryRun}&recursive=${recursive}`,
    data,
    configOptions
  );

  return res.data;
};

export const importGlossaryInCSVFormat = async ({
  name,
  data,
  dryRun = true,
}: importEntityInCSVFormatRequestParams) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
  };
  const response = await APIClient.put<
    string,
    AxiosResponse<CSVImportAsyncResponse>
  >(
    `/glossaries/name/${getEncodedFqn(name)}/importAsync?dryRun=${dryRun}`,
    data,
    configOptions
  );

  return response.data;
};

export const importGlossaryTermInCSVFormat = async ({
  name,
  data,
  dryRun = true,
}: importEntityInCSVFormatRequestParams) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
  };
  const response = await APIClient.put<
    string,
    AxiosResponse<CSVImportAsyncResponse>
  >(
    `/glossaryTerms/name/${getEncodedFqn(name)}/importAsync?dryRun=${dryRun}`,
    data,
    configOptions
  );

  return response.data;
};

export interface OntologyImportResult {
  dryRun: boolean;
  glossariesCreated: number;
  termsCreated: number;
  termsUpdated: number;
  relationsAdded: number;
  conceptMappingsAdded: number;
  customPropertiesCreated: number;
  relationTypesRegistered: number;
  messages: string[];
}

// JSON-LD is intentionally excluded — the backend rejects it (remote @context
// resolution is an SSRF risk). Keep in sync with GlossaryRdfImporter.jenaLang().
export type OntologyImportFormat = 'turtle' | 'rdfxml' | 'ntriples';

export const importGlossaryOntology = async ({
  name,
  data,
  dryRun = true,
  format = 'turtle',
}: {
  name: string;
  data: string;
  dryRun?: boolean;
  format?: OntologyImportFormat;
}) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
  };
  const response = await APIClient.put<
    string,
    AxiosResponse<OntologyImportResult>
  >(
    `/glossaries/name/${getEncodedFqn(
      name
    )}/importRdf?dryRun=${dryRun}&format=${encodeURIComponent(format)}`,
    data,
    configOptions
  );

  return response.data;
};
