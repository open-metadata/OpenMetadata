/*
 *  Copyright 2022 Collate
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

import { CloseOutlined } from '@ant-design/icons';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ExplorePageTabs } from '../../../enums/Explore.enum';
import { Table } from '../../../generated/entity/data/table';
import { EntitySummaryPanelProps } from './EntitySummaryPanel.interface';
import './EntitySummaryPanel.style.less';
import TableSummary from './TableSummary/TableSummary.component';

export default function EntitySummaryPanel({
  entityDetails,
  handleClosePanel,
  showPanel,
}: EntitySummaryPanelProps) {
  const { tab } = useParams<{ tab: string }>();

  const summaryComponent = useMemo(() => {
    if (entityDetails.entityType === ExplorePageTabs.TABLES) {
      return <TableSummary entityDetails={entityDetails.details as Table} />;
    } else {
      return null;
    }
  }, [tab, entityDetails]);

  return (
    <div
      className={classNames(
        'summary-panel-container',
        showPanel ? 'show-panel' : ''
      )}>
      {summaryComponent}
      <CloseOutlined className="close-icon" onClick={handleClosePanel} />
    </div>
  );
}
