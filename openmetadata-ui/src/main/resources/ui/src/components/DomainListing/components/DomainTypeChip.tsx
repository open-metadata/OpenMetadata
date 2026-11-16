/*
 *  Copyright 2023 Collate.
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

import { BadgeWithIcon, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { DOMAIN_TYPE_DISPLAY } from '../../../constants/Domain.constants';
import { DomainType } from '../../../generated/entity/domains/domain';

const EMPTY_VALUE_INDICATOR = '-';

interface DomainTypeChipProps {
  domainType: string;
}

export const DomainTypeChip = ({ domainType }: DomainTypeChipProps) => {
  const { t } = useTranslation();
  const display = DOMAIN_TYPE_DISPLAY[domainType as DomainType];

  return display ? (
    <BadgeWithIcon
      color="brand"
      iconLeading={display.icon}
      size="sm"
      type="color">
      {t(display.labelKey)}
    </BadgeWithIcon>
  ) : (
    <Typography className="tw:text-secondary" size="text-xs">
      {EMPTY_VALUE_INDICATOR}
    </Typography>
  );
};
