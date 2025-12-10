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
import { Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as CertificationIcon } from '../../../assets/svg/ic-certification.svg';
import { AssetCertification } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import { getClassificationTagPath } from '../../../utils/RouterUtils';
import { getTagImageSrc, getTagTooltip } from '../../../utils/TagsUtils';
import './certification-tag.less';

const CertificationTag = ({
  certification,
  showName = false,
  isDisabled = false,
}: {
  certification: AssetCertification;
  showName?: boolean;
  isDisabled?: boolean;
}) => {
  const { t } = useTranslation();
  const imageItem = useMemo(() => {
    if (certification.tagLabel.style?.iconURL) {
      const name = getEntityName(certification.tagLabel);
      const tagSrc = getTagImageSrc(certification.tagLabel.style.iconURL);

      return (
        <img
          alt={`certification: ${name}`}
          className="certification-img"
          src={tagSrc}
        />
      );
    }

    const iconSize = showName ? 14 : 20;

    return <CertificationIcon height={iconSize} width={iconSize} />;
  }, [certification.tagLabel.style?.iconURL, showName]);

  const certificationRender = useMemo(() => {
    const name = getEntityName(certification.tagLabel);
    const actualName = certification.tagLabel.name ?? '';
    const tagLink = getClassificationTagPath(certification.tagLabel.tagFQN);

    const tagStyle = showName
      ? {
          backgroundColor: certification.tagLabel.style?.color
            ? certification.tagLabel.style?.color + '33'
            : '#f8f8f8',
          padding: '2px 6px',
        }
      : {};

    const tooltipTitle = isDisabled
      ? t('label.disabled')
      : null

    return (
      <Tooltip title={tooltipTitle} trigger="hover">
        <Link
          className={classNames('d-flex items-center', {
            'certification-tag-with-name  gap-1': showName,
            'certification-tag-disabled': isDisabled,
          })}
          data-testid={`certification-${certification.tagLabel.tagFQN}`}
          style={tagStyle}
          to={tagLink}>
          {imageItem}
          {showName && (
            <Typography.Text
              className={classNames('text-sm font-medium certification-text', {
                [`${actualName.toLowerCase()}`]: Boolean(actualName),
              })}
              ellipsis={{ tooltip: true }}>
              {name}
            </Typography.Text>
          )}
          {isDisabled && (
            <Typography.Text
              className="text-xs text-grey-muted certification-disabled-badge"
              data-testid="certification-disabled-badge">
            </Typography.Text>
          )}
        </Link>
      </Tooltip>
    );
  }, [certification, imageItem, isDisabled, t]);

  return certificationRender;
};

export default CertificationTag;
