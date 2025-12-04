/*
 *  Copyright 2022 Collate.
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

import { Link } from '@mui/material';
import { Tooltip } from 'antd';
import { TooltipPlacement } from 'antd/es/tooltip';
import { getTextFromHtmlString } from '../../../utils/BlockEditorUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { stringToHTML } from '../../../utils/StringsUtils';
import './EntityTitleSection.less';

interface EntityTitleSectionProps {
  entityDetails: {
    entityType?: string;
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
    [key: string]: unknown;
  };
  entityLink: string;
  tooltipPlacement?: TooltipPlacement;
  testId?: string;
  className?: string;
}

export const EntityTitleSection = ({
  entityDetails,
  entityLink,
  tooltipPlacement = 'topLeft',
  testId = 'entity-link',
  className = '',
}: EntityTitleSectionProps) => {
  const entityName = getEntityName(entityDetails);
  const entityType = entityDetails.entityType ?? '';

  return (
    <div className={`title-section ${className}`}>
      <div className="title-container">
        <Tooltip
          mouseEnterDelay={0.5}
          placement={tooltipPlacement}
          title={getTextFromHtmlString(entityName)}
          trigger="hover">
          <div className="d-flex items-center">
            <span className="entity-icon">
              {searchClassBase.getEntityIcon(entityType)}
            </span>
            <Link
              className="entity-title-link"
              data-testid={testId}
              href={entityLink}
              rel="noopener noreferrer"
              target="_blank"
              underline="hover">
              {stringToHTML(entityName)}
            </Link>
          </div>
        </Tooltip>
      </div>
    </div>
  );
};
