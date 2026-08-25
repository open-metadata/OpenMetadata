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

import { Card } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useLineageStore } from '../../hooks/useLineageStore';
import CustomControlsComponent from '../Entity/EntityLineage/CustomControls.component';
import { LineageProps } from './Lineage.interface';
import LineageMap from './LineageMap/LineageMap.component';

const Lineage = ({
  deleted,
  entity,
  entityType,
  isPlatformLineage,
  hasEditAccess,
  platformHeader,
  showControls = true,
}: LineageProps) => {
  const { isEditMode } = useLineageStore();

  const headerContent = isPlatformLineage ? (
    platformHeader
  ) : showControls ? (
    <div
      className={classNames('lineage-header', {
        'lineage-header-edit-mode': isEditMode,
      })}>
      <CustomControlsComponent
        deleted={Boolean(deleted)}
        hasEditAccess={hasEditAccess}
      />
    </div>
  ) : null;

  return (
    <Card
      className="lineage-card card-padding-0 tw:flex tw:flex-col"
      data-testid="lineage-details">
      {headerContent ? (
        <div className="tw:py-4 tw:px-6 tw:border-b tw:border-tertiary tw:shrink-0">
          {headerContent}
        </div>
      ) : null}
      <div
        className="lineage-container tw:flex-1 tw:min-h-0 tw:overflow-hidden"
        data-testid="lineage-container"
        id="lineage-container">
        <LineageMap
          deleted={deleted}
          entity={entity}
          entityType={entityType}
          hasEditAccess={hasEditAccess}
          isPlatformLineage={isPlatformLineage}
          platformHeader={platformHeader}
        />
      </div>
    </Card>
  );
};

export default Lineage;
