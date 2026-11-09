/*
 *  Copyright 2026 Collate.
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

import { Industry } from '../../generated/api/data/ontologyPackManifest';

type PackPresentation = {
  order: number;
  iconClass: string;
  mark?: string;
};

const LIGHT_TEXT = 'tw:text-utility-gray-blue-50';

export const PACK_PRESENTATION: Readonly<
  Partial<Record<string, PackPresentation>>
> = {
  fibo: {
    order: 0,
    iconClass: 'tw:bg-brand-solid tw:text-fg-white',
  },
  fhir: {
    order: 1,
    iconClass: `tw:bg-utility-green-700 ${LIGHT_TEXT}`,
  },
  brick: {
    order: 2,
    iconClass: `tw:bg-utility-yellow-700 ${LIGHT_TEXT}`,
  },
  iof: {
    order: 3,
    iconClass: `tw:bg-utility-orange-700 ${LIGHT_TEXT}`,
  },
  'isa-95': {
    order: 4,
    iconClass: `tw:bg-utility-orange-700 ${LIGHT_TEXT}`,
    mark: 'ISA95',
  },
  'hr-open': {
    order: 5,
    iconClass: `tw:bg-utility-purple-700 ${LIGHT_TEXT}`,
    mark: 'HR',
  },
  gs1: {
    order: 6,
    iconClass: `tw:bg-utility-pink-700 ${LIGHT_TEXT}`,
  },
  epcis: {
    order: 7,
    iconClass: `tw:bg-utility-indigo-700 ${LIGHT_TEXT}`,
  },
  dcat: {
    order: 8,
    iconClass: `tw:bg-utility-blue-700 ${LIGHT_TEXT}`,
  },
  'prov-o': {
    order: 9,
    iconClass: `tw:bg-utility-brand-700 ${LIGHT_TEXT}`,
    mark: 'PROV',
  },
  org: {
    order: 10,
    iconClass: `tw:bg-utility-fuchsia-700 ${LIGHT_TEXT}`,
  },
  odrl: {
    order: 11,
    iconClass: `tw:bg-utility-gray-blue-700 ${LIGHT_TEXT}`,
  },
  dpv: {
    order: 12,
    iconClass: `tw:bg-utility-green-700 ${LIGHT_TEXT}`,
  },
  'owl-time': {
    order: 13,
    iconClass: `tw:bg-utility-orange-700 ${LIGHT_TEXT}`,
    mark: 'TIME',
  },
  'sosa-ssn': {
    order: 14,
    iconClass: `tw:bg-utility-yellow-700 ${LIGHT_TEXT}`,
    mark: 'SSN',
  },
  foaf: {
    order: 15,
    iconClass: `tw:bg-utility-pink-700 ${LIGHT_TEXT}`,
  },
};

export const INDUSTRY_ORDER: Industry[] = [
  Industry.Finance,
  Industry.Healthcare,
  Industry.BuildingsAndEnergy,
  Industry.Manufacturing,
  Industry.HumanResources,
  Industry.Retail,
  Industry.SupplyChain,
  Industry.CrossIndustry,
];

export const INDUSTRY_LABEL_KEY: Record<Industry, string> = {
  [Industry.BuildingsAndEnergy]: 'label.ontology-library-buildings-and-energy',
  [Industry.CrossIndustry]: 'label.ontology-library-cross-industry',
  [Industry.Finance]: 'label.ontology-library-finance',
  [Industry.Healthcare]: 'label.ontology-library-healthcare',
  [Industry.Manufacturing]: 'label.ontology-library-manufacturing',
  [Industry.HumanResources]: 'label.ontology-library-hr',
  [Industry.Retail]: 'label.ontology-library-retail',
  [Industry.SupplyChain]: 'label.ontology-library-supply-chain',
};
