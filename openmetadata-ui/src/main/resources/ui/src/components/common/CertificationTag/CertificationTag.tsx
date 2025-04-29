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
import { Tag, Tooltip } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { Link } from 'react-router-dom';
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
  if (certification.tagLabel.style?.iconURL) {
    const name = getEntityName(certification.tagLabel);
    const actualName = certification.tagLabel.name ?? '';
    const tagSrc = getTagImageSrc(certification.tagLabel.style.iconURL);
    const tagLink = getClassificationTagPath(certification.tagLabel.tagFQN);

    return (
      <Tooltip
        title={getTagTooltip(name, certification.tagLabel.description)}
        trigger="hover">
        <Link
          className={classNames({
            'certification-tag-with-name d-flex items-center gap-1': showName,
          })}
          data-testid={`certification-${certification.tagLabel.tagFQN}`}
          style={
            showName
              ? { backgroundColor: certification.tagLabel.style?.color + '33' } // to decrease opacity of the background color by 80%
              : {}
          }
          to={tagLink}>
          <img
            alt={`certification: ${name}`}
            className="certification-img"
            src={tagSrc}
          />
          {showName && (
            <span
              className={classNames('text-sm font-medium', {
                [`${actualName.toLowerCase()}`]: Boolean(actualName),
              })}>
              {name}
            </span>
          )}
        </Link>
      </Tooltip>
    );
  }

  return (
    <Tag
      className="certification-tag"
      data-testid={`certification-${certification.tagLabel.tagFQN}`}
      style={{
        borderColor: certification.tagLabel.style?.color,
        backgroundColor: certification.tagLabel.style?.color
          ? `${certification.tagLabel.style.color}33`
          : undefined, // Assuming 33 is the hex transparency for lighter shade
      }}>
      {getEntityName(certification.tagLabel)}
    </Tag>
  );
};

export default CertificationTag;
