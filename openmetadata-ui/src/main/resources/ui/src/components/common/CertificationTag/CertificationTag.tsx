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
import { Link } from 'react-router-dom';
import CertificationIcon from '../../../assets/svg/ic-certification.svg?react';
import { AssetCertification } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import { getClassificationTagPath } from '../../../utils/RouterUtils';
import { getTagImageSrc, getTagTooltip } from '../../../utils/TagsUtils';
import './certification-tag.less';

const CertificationTag = ({
  certification,
  showName = false,
}: {
  certification: AssetCertification;
  showName?: boolean;
}) => {
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
        }
      : {};

    return (
      <Tooltip
        title={getTagTooltip(name, certification.tagLabel.description)}
        trigger="hover">
        <Link
          className={classNames('d-flex items-center', {
            'certification-tag-with-name  gap-1': showName,
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
        </Link>
      </Tooltip>
    );
  }, [certification, imageItem]);

  return certificationRender;
};

export default CertificationTag;
