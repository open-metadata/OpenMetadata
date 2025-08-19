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
import Icon from '@ant-design/icons/lib/components/Icon';
import { ReactComponent as IconDistribution } from '../../../assets/svg/icon-distribution.svg';
import { ReactComponent as IconKey } from '../../../assets/svg/icon-key.svg';
import { ReactComponent as IconSort } from '../../../assets/svg/icon-sort.svg';
import { ReactComponent as IconUnique } from '../../../assets/svg/icon-unique.svg';
import { Tooltip } from '../../../components/common/AntdCompat';
;

import SectionLine from '../../../assets/svg/section-line-medium.svg';

import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ConstraintType } from '../../../generated/entity/data/table';

interface ConstraintIconProps {
  constraintType: ConstraintType;
  showOnlyIcon: boolean;
}

const ConstraintIcon = ({
  constraintType,
  showOnlyIcon,
}: ConstraintIconProps) => {
  const { t } = useTranslation();

  const { icon, title } = useMemo(() => {
    switch (constraintType) {
      case ConstraintType.PrimaryKey:
        return {
          icon: IconKey,
          title: t('label.entity-key', {
            entity: t('label.primary'),
          }),
        };
      case ConstraintType.Unique:
        return {
          icon: IconUnique,
          title: t('label.unique'),
        };
      case ConstraintType.DistKey:
        return {
          icon: IconDistribution,
          title: t('label.entity-key', {
            entity: t('label.dist'),
          }),
        };

      default:
        return {
          icon: IconSort,
          title: t('label.entity-key', {
            entity: t('label.sort'),
          }),
        };
    }
  }, [constraintType]);

  return (
    <div
      className={classNames('constraint-primary-key', {
        'm-r-xs': showOnlyIcon,
      })}
      data-testid={`${constraintType}-icon`}>
      {!showOnlyIcon && (
        <img className="primary-key-section-line" src={SectionLine} />
      )}
      <Tooltip placement="bottom" title={title} trigger="hover">
        <Icon
          alt={constraintType}
          className="primary-key-icon"
          component={icon}
        />
      </Tooltip>
    </div>
  );
};

export default ConstraintIcon;
