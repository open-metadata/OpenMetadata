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
import Icon from '@ant-design/icons/lib/components/Icon';
import classNames from 'classnames';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Link, To } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-links.svg';
import { ICON_DIMENSION } from '../../../constants/constants';
import './OverviewSection.less';

interface EntityInfoItemV1 {
  name: string;
  value?: any;
  url?: string;
  linkProps?: To;
  isLink?: boolean;
  isExternal?: boolean;
  visible?: string[];
}

interface CommonEntitySummaryInfoV1Props {
  entityInfo: EntityInfoItemV1[];
  componentType: string;
  isDomainVisible?: boolean;
}

const CommonEntitySummaryInfoV1: React.FC<CommonEntitySummaryInfoV1Props> = ({
  entityInfo,
  componentType,
  isDomainVisible = false,
}) => {
  const { t } = useTranslation();

  const isItemVisible = (item: EntityInfoItemV1) => {
    const isDomain = isDomainVisible && item.name === t('label.domain-plural');

    return (item.visible || []).includes(componentType) || isDomain;
  };

  return (
    <div className="overview-section">
      {entityInfo.filter(isItemVisible).map((info) => (
        <div className="overview-row" key={info.name}>
          <span
            className={classNames('overview-label')}
            data-testid={`${info.name}-label`}>
            {info.name}
          </span>
          <span
            className={classNames('overview-value text-grey-body')}
            data-testid={`${info.name}-value`}>
            {info.isLink ? (
              info.isExternal && info.value !== '-' ? (
                <a
                  className="summary-item-link"
                  href={info.url}
                  target="_blank">
                  {info.value}
                  <Icon
                    className="m-l-xs"
                    component={IconExternalLink}
                    data-testid="external-link-icon"
                    style={ICON_DIMENSION}
                  />
                </a>
              ) : (
                <Link
                  className="summary-item-link"
                  to={info.linkProps ?? info.url ?? ''}>
                  {info.value}
                </Link>
              )
            ) : isNil(info.value) ? (
              '-'
            ) : (
              info.value
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

export default CommonEntitySummaryInfoV1;
