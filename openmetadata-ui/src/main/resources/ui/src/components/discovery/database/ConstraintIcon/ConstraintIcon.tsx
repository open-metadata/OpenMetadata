/*
 *  Copyright 2024 Collate.
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
  ConstraintDistribution,
  ConstraintKey,
  ConstraintSort,
  ConstraintUnique,
  SectionLineDashed,
} from '@openmetadata/ui-core-components/icons';

import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ConstraintType } from '../../../../generated/entity/data/table';

interface ConstraintIconProps {
  constraintType: ConstraintType;
  showOnlyIcon: boolean;
}

const ConstraintIcon = ({
  constraintType,
  showOnlyIcon,
}: ConstraintIconProps) => {
  const { t } = useTranslation();

  const { icon: IconComponent, title } = useMemo(() => {
    switch (constraintType) {
      case ConstraintType.PrimaryKey:
        return {
          icon: ConstraintKey,
          title: t('label.entity-key', {
            entity: t('label.primary'),
          }),
        };
      case ConstraintType.Unique:
        return {
          icon: ConstraintUnique,
          title: t('label.unique'),
        };
      case ConstraintType.DistKey:
        return {
          icon: ConstraintDistribution,
          title: t('label.entity-key', {
            entity: t('label.dist'),
          }),
        };
      case ConstraintType.ClusterKey:
        return {
          icon: ConstraintDistribution,
          title: t('label.entity-key', {
            entity: t('label.cluster'),
          }),
        };
      case ConstraintType.SortKey:
      default:
        return {
          icon: ConstraintSort,
          title: t('label.entity-key', {
            entity: t('label.sort'),
          }),
        };
    }
  }, [constraintType, t]);

  return (
    <div
      className={classNames('constraint-primary-key', {
        'm-r-xs': showOnlyIcon,
      })}
      data-testid={`${constraintType}-icon`}>
      {!showOnlyIcon && (
        <SectionLineDashed
          className="primary-key-section-line tw:text-black tw:dark:text-fg-quaternary"
          height={40}
          width={19}
        />
      )}
      <Tooltip placement="bottom" title={title}>
        <IconComponent
          aria-label={constraintType}
          className="primary-key-icon tw:bg-surface tw:size-3.5 tw:shrink-0"
          role="img"
        />
      </Tooltip>
    </div>
  );
};

export default ConstraintIcon;
