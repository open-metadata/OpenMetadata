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

import { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import { ReactComponent as GovernanceIcon } from '../../../assets/svg/ic-governance.svg';
import { ROUTES } from '../../../constants/constants';

/**
 * Icon-only base crumb shared by the Governance-section headers (Glossary,
 * Ontology Explorer, Classification, Metrics, Column Bulk Operations, Workflows).
 * Renders the governance icon and links back to the glossary homepage. Use with
 * `showHome={false}` as the first item.
 */
export const getGlossaryHomeCrumb = (
  t: TFunction
): Omit<BreadcrumbItemType, 'id'> => ({
  label: null,
  ariaLabel: t('label.glossary'),
  icon: GovernanceIcon,
  href: ROUTES.GLOSSARY,
});
