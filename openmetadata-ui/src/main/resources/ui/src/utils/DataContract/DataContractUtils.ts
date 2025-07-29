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
import i18next from 'i18next';
import { ReactComponent as QualityIcon } from '../../assets/svg/policies.svg';
import { ReactComponent as SemanticsIcon } from '../../assets/svg/semantics.svg';
import { ReactComponent as TableIcon } from '../../assets/svg/table-grey.svg';
import { DataContractResult } from '../../generated/entity/datacontract/dataContractResult';
import { getRelativeTime } from '../date-time/DateTimeUtils';

export const getConstraintStatus = (
  latestContractResults: DataContractResult
) => {
  if (!latestContractResults) {
    return [];
  }

  const statusArray = [];

  // Add schema validation if it exists
  if (latestContractResults.schemaValidation) {
    const { passed, failed, total } = latestContractResults.schemaValidation;
    statusArray.push({
      label: i18next.t('label.schema'),
      status:
        failed === 0 ? i18next.t('label.passed') : i18next.t('label.failed'),
      desc:
        failed === 0
          ? i18next.t('message.passed-x-checks', { count: passed })
          : i18next.t('message.failed-x-checks', { failed, count: total }),
      time: getRelativeTime(latestContractResults.timestamp),
      icon: TableIcon,
    });
  }

  // Add semantics validation if it exists
  if (latestContractResults.semanticsValidation) {
    const { passed, failed, total } = latestContractResults.semanticsValidation;
    statusArray.push({
      label: i18next.t('label.semantic-plural'),
      status:
        failed === 0 ? i18next.t('label.passed') : i18next.t('label.failed'),
      desc:
        failed === 0
          ? i18next.t('message.passed-x-checks', { count: passed })
          : i18next.t('message.failed-x-checks', { failed, count: total }),
      time: getRelativeTime(latestContractResults.timestamp),
      icon: SemanticsIcon,
    });
  }

  // Add quality validation if it exists
  if (latestContractResults.qualityValidation) {
    const { passed, failed, total } = latestContractResults.qualityValidation;
    statusArray.push({
      label: i18next.t('label.quality'),
      status:
        failed === 0 ? i18next.t('label.passed') : i18next.t('label.failed'),
      desc:
        failed === 0
          ? i18next.t('message.passed-x-checks', { count: passed })
          : i18next.t('message.failed-x-checks', { failed, count: total }),
      time: getRelativeTime(latestContractResults.timestamp),
      icon: QualityIcon,
    });
  }

  return statusArray;
};
