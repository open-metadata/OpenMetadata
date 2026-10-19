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
import { Tooltip } from '@openmetadata/ui-core-components';
import {
  ConstraintForeignKey,
  SectionLineDashed,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { ConstraintType } from '../../../generated/entity/data/table';

const ForeignKeyConstraint = () => {
  const { t } = useTranslation();

  return (
    <div
      className="constraint-foreign-key"
      data-testid={`${ConstraintType.ForeignKey}-icon`}>
      <SectionLineDashed
        className="foreign-key-section-line tw:text-black tw:dark:text-fg-quaternary"
        height={40}
        width="100%"
      />
      <Tooltip placement="bottom" title={t('label.foreign-key')}>
        <ConstraintForeignKey
          aria-label="foreign-key"
          className="foreign-key-icon tw:bg-surface tw:size-3.5 tw:shrink-0"
          role="img"
        />
      </Tooltip>
    </div>
  );
};

export default ForeignKeyConstraint;
