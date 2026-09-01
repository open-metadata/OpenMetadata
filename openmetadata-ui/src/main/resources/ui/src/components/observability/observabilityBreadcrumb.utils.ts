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
import { FC } from 'react';
import { ReactComponent as ObservabilityIcon } from '../../assets/svg/observability-default.svg';
import { OBSERVABILITY_ROUTES } from './observability.constants';

/**
 * Icon-only module crumb that heads every Observability breadcrumb in app
 * mode, mirroring the Context Center pattern: the module icon replaces the
 * generic home crumb and links back to the module root.
 */
export const getObservabilityRootBreadcrumb = (
  t: TFunction
): Omit<BreadcrumbItemType, 'id'> => ({
  label: null,
  ariaLabel: t('label.observability'),
  icon: ObservabilityIcon as FC<{ className?: string }>,
  href: OBSERVABILITY_ROUTES.OBSERVABILITY,
});
