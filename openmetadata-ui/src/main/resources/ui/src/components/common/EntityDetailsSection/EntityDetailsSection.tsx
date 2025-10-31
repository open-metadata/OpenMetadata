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
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { getEntityChildDetailsV1 } from '../../../utils/EntitySummaryPanelUtilsV1';
import { EntityDetailsSectionProps } from './EntityDetailsSection.interface';
import './EntityDetailsSection.less';

const EntityDetailsSection: React.FC<EntityDetailsSectionProps> = ({
  entityType,
  dataAsset,
  highlights,
  isLoading = false,
}) => {
  const entityDetails = useMemo(() => {
    return getEntityChildDetailsV1(
      entityType,
      dataAsset,
      highlights,
      isLoading
    );
  }, [dataAsset, entityType, highlights, isLoading]);

  if (isLoading || isEmpty(dataAsset)) {
    return null;
  }

  return <div className="entity-details-section">{entityDetails}</div>;
};

export default EntityDetailsSection;
