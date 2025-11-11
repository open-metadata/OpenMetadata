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
import { Button, Tag } from 'antd';
import classNames from 'classnames';
import { get } from 'lodash';
import { FC, useMemo } from 'react';
import { PRIMARY_COLOR } from '../../../../constants/Color.constants';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import { getEntityName } from '../../../../utils/EntityUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import { getEntityIcon } from '../../../../utils/TableUtils';
import { SourceType } from '../../../SearchedData/SearchedData.interface';
import './entity-suggestion-option.less';
import { EntitySuggestionOptionProps } from './EntitySuggestionOption.interface';
const EntitySuggestionOption: FC<EntitySuggestionOptionProps> = ({
  entity,
  heading,
  onSelectHandler,
  className,
  showEntityTypeBadge = false,
}) => {
  const serviceIcon = useMemo(() => {
    const serviceType = get(entity, 'serviceType', '');

    if (serviceType) {
      return (
        <img
          alt={entity.name}
          className="m-r-xs"
          height="16px"
          src={serviceUtilClassBase.getServiceTypeLogo(
            entity as SearchSourceAlias
          )}
          width="16px"
        />
      );
    }

    return getEntityIcon(
      (entity as SearchSourceAlias).entityType ?? '',
      'w-4 h-4 m-r-xs'
    );
  }, [entity]);

  return (
    <Button
      block
      className={classNames(
        'd-flex items-center entity-suggestion-option-btn p-0',
        className
      )}
      data-testid={`node-suggestion-${entity.fullyQualifiedName}`}
      key={entity.fullyQualifiedName}
      type="text"
      onClick={() => {
        onSelectHandler?.(entity);
      }}>
      <div className="d-flex items-center w-full overflow-hidden justify-between">
        <div className="d-flex items-center flex-1 overflow-hidden">
          {serviceIcon}
          <div className="d-flex text-left align-start flex-column flex-1 min-w-0">
            {heading && (
              <p className="d-block text-xs text-grey-muted p-b-xss break-all whitespace-normal text-left w-full truncate">
                {heading}
              </p>
            )}
            <p className="text-xs text-grey-muted truncate line-height-normal w-full">
              {entity.name}
            </p>
            <p className="text-sm font-medium truncate w-full">
              {getEntityName(entity)}
            </p>
          </div>
        </div>
        {showEntityTypeBadge && (
          <Tag
            className="entity-tag text-xs ml-2 whitespace-nowrap"
            color={PRIMARY_COLOR}>
            {(entity as SourceType)?.entityType}
          </Tag>
        )}
      </div>
    </Button>
  );
};

export default EntitySuggestionOption;
