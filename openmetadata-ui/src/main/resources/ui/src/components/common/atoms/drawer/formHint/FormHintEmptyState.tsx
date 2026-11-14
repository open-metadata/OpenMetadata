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
import { Lightbulb05 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import NoDataPlaceholder from '../../../EmptyPlaceholder/NoDataPlaceholder';

/** Shown in the Form Hint column while no documented field is active. */
export const FormHintEmptyState = () => {
  const { t } = useTranslation();

  return (
    // width="100%" is required: EmptyPlaceholder's 300px default is wider than
    // the hint column's 260px minimum and would overflow once the column
    // shrinks on a narrow viewport.
    <NoDataPlaceholder
      description={t('message.form-hint-empty-state')}
      icon={Lightbulb05}
      title={t('label.no-entity-selected', { entity: t('label.field') })}
      width="100%"
    />
  );
};
