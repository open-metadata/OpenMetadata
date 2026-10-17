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
import { Badge } from '@openmetadata/ui-core-components';
import { toLower } from 'lodash';
import { useTranslation } from 'react-i18next';
import { CONTRACT_RESULT_BADGE_COLOR } from '../../../constants/DataContract.constants';
import { ContractExecutionStatus } from '../../../generated/type/contractExecutionStatus';
import { getDataContractStatusIcon } from '../../../utils/DataContract/DataContractUtils';

interface ContractLatestResultBadgeProps {
  status: ContractExecutionStatus;
  /** Contract tab of the asset; the pill is a link so it navigates like one. */
  href: string;
}

/** Header pill for a failed, aborted or running contract, linking to its Contract tab. */
const ContractLatestResultBadge = ({
  status,
  href,
}: ContractLatestResultBadgeProps) => {
  const { t } = useTranslation();
  const StatusIcon = getDataContractStatusIcon(status);

  return (
    <Badge
      className="tw:gap-1.5"
      color={CONTRACT_RESULT_BADGE_COLOR[status] ?? 'gray'}
      data-testid="data-contract-latest-result-btn"
      href={href}
      size="lg">
      {StatusIcon && <StatusIcon aria-hidden className="tw:size-4" />}
      {t(`label.entity-${toLower(status)}`, { entity: t('label.contract') })}
    </Badge>
  );
};

export default ContractLatestResultBadge;
