/*
 *  Copyright 2026 Collate.
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
import { Box } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import '../../../DataQuality/DataQualityDashboard/data-quality-dashboard.style.less';
import DqDashboardSectionContent, {
    DQ_DASHBOARD_SECTIONS,
    type DqDashboardSectionKey
} from '../../../DataQuality/DataQualityDashboard/DqDashboardSectionContent.component';
import { useDataQualityDashboardFilters } from '../../../DataQuality/DataQualityDashboard/useDataQualityDashboardFilters';
import DqFilterBar from './DqFilterBar';
import DqSectionCard from './DqSectionCard';

const DQ_SECTION_CLASS_NAMES: Partial<Record<DqDashboardSectionKey, string>> = {
  // The pie-chart cards carry a variable number of legend rows, so their
  // natural heights differ. Stretch each card to its grid row so all three
  // share one height.
  'data-health':
    'data-quality-dashboard-card-section tw:[&_.data-quality-dashboard-pie-chart]:h-full',
  'data-dimensions':
    'tw:[&_.status-card-widget-container]:border-0 tw:[&_.status-card-widget-container]:bg-gray-blue-25',
  'incident-metrics':
    'tw:[&_.custom-chart-background]:border-0 tw:[&_.custom-chart-background]:bg-gray-blue-25',
};

/**
 * App-mode Data Quality dashboard tab. Data + API fetch come from the shared
 * useDataQualityDashboardFilters hook; the charts (and their UI logic) come from
 * the shared DqDashboardSectionContent. This component only supplies the mode
 * chrome — the untitled-ui filter bar and borderless DqSectionCard wrappers.
 */
const DataQualityDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    defaultFilters,
    pieChartFilters,
    dateRange,
    onDateRangeChange,
    filters,
    showFilterBar,
    hasVisibleFilters,
    hasActiveFilters,
    clearAll,
  } = useDataQualityDashboardFilters({});

  return (
    <Box direction="col" gap={6}>
      <DqFilterBar
        clearAll={clearAll}
        dateRange={dateRange}
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        hasVisibleFilters={hasVisibleFilters}
        showFilterBar={showFilterBar}
        onDateRangeChange={onDateRangeChange}
      />

      {DQ_DASHBOARD_SECTIONS.map((section) => (
        <DqSectionCard
          className={DQ_SECTION_CLASS_NAMES[section.key]}
          key={section.key}
          subtitle={t(section.header.subHeader)}
          title={t(section.header.header)}>
          <DqDashboardSectionContent
            defaultFilters={defaultFilters}
            navigate={navigate}
            pieChartFilters={pieChartFilters}
            sectionKey={section.key}
          />
        </DqSectionCard>
      ))}
    </Box>
  );
};

export default DataQualityDashboard;
