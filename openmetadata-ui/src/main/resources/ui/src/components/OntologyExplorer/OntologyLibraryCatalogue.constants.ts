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

type PackPresentation = {
  titleKey: string;
  filterKey: string;
  order: number;
  iconClass: string;
  mark?: string;
};

export const PACK_PRESENTATION: Readonly<
  Partial<Record<string, PackPresentation>>
> = {
  fibo: {
    titleKey: 'label.ontology-library-financial-services',
    filterKey: 'label.ontology-library-finance',
    order: 0,
    iconClass: 'tw:bg-brand-solid tw:text-fg-white',
  },
  fhir: {
    titleKey: 'label.ontology-library-healthcare',
    filterKey: 'label.ontology-library-healthcare',
    order: 1,
    iconClass: 'tw:bg-utility-green-700 tw:text-utility-gray-blue-50',
  },
  'isa-95': {
    titleKey: 'label.ontology-library-manufacturing',
    filterKey: 'label.ontology-library-manufacturing',
    order: 2,
    iconClass: 'tw:bg-utility-orange-700 tw:text-utility-gray-blue-50',
    mark: 'ISA95',
  },
  'hr-open': {
    titleKey: 'label.ontology-library-human-resources',
    filterKey: 'label.ontology-library-hr',
    order: 3,
    iconClass: 'tw:bg-utility-purple-700 tw:text-utility-gray-blue-50',
    mark: 'HR',
  },
  gs1: {
    titleKey: 'label.ontology-library-retail-and-commerce',
    filterKey: 'label.ontology-library-retail',
    order: 4,
    iconClass: 'tw:bg-utility-pink-700 tw:text-utility-gray-blue-50',
  },
  epcis: {
    titleKey: 'label.ontology-library-supply-chain-title',
    filterKey: 'label.ontology-library-supply-chain',
    order: 5,
    iconClass: 'tw:bg-utility-indigo-700 tw:text-utility-gray-blue-50',
  },
};
