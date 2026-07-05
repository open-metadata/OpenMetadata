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
import {
  Card,
  Grid,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DropDownIcon } from '../../../assets/svg/drop-down.svg';
import DatePickerMenu from '../../../components/common/DatePickerMenu/DatePickerMenu.component';
import { UserTeamSelectableList } from '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import SearchDropdown from '../../../components/SearchDropdown/SearchDropdown';
import { getSelectedOptionLabelString } from '../../../utils/AdvancedSearchPureUtils';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import './data-quality-dashboard.style.less';
import { DqDashboardChartFilters } from './DataQualityDashboard.interface';
import DqDashboardSectionContent, {
  DQ_DASHBOARD_SECTIONS,
} from './DqDashboardSectionContent.component';
import { useDataQualityDashboardFilters } from './useDataQualityDashboardFilters';

const DataQualityDashboard = ({
  initialFilters,
  hideFilterBar = false,
  hiddenFilters = [],
  isGovernanceView = false,
  className,
}: {
  initialFilters?: DqDashboardChartFilters;
  hideFilterBar?: boolean;
  hiddenFilters?: Array<
    | 'owner'
    | 'tier'
    | 'certification'
    | 'tags'
    | 'glossaryTerms'
    | 'dataProducts'
  >;
  isGovernanceView?: boolean;
  className?: string;
}) => {
  const { t } = useTranslation();

  const {
    chartFilter,
    defaultFilters,
    pieChartFilters,
    defaultRange,
    filters,
    showFilterBar,
    hasVisibleFilters,
    onDateRangeChange,
  } = useDataQualityDashboardFilters({
    initialFilters,
    hideFilterBar,
    hiddenFilters,
  });

  const cardClassName = classNames('data-quality-dashboard-card-section', {
    'tw:ring-0': isGovernanceView,
    'tw:shadow-none': isGovernanceView,
  });

  const cardBodyClass = 'tw:p-6';

  const filterBarContent = (
    <div
      className={classNames(
        'tw:flex tw:items-center tw:w-full',
        showFilterBar && hasVisibleFilters
          ? 'tw:justify-between'
          : 'tw:justify-end'
      )}>
      {showFilterBar && hasVisibleFilters && (
        <div className="tw:flex tw:items-center tw:gap-4 tw:w-full">
          {filters.map((filter) => {
            if (filter.type === 'owner') {
              return (
                <Tooltip
                  isDisabled={filter.selectedOwnerKeys.length === 0}
                  key={filter.key}
                  placement="top"
                  title={getSelectedOptionLabelString(
                    filter.selectedOwnerKeys,
                    true
                  )}>
                  <TooltipTrigger>
                    <UserTeamSelectableList
                      hasPermission
                      owner={filter.selectedOwners}
                      popoverProps={{ placement: 'bottomLeft' }}
                      onUpdate={filter.onChange}>
                      <div
                        className="tw:flex tw:items-center tw:gap-1  tw:rounded-md quick-filter-dropdown-trigger-btn"
                        data-testid={`search-dropdown-${filter.key}`}
                        title={
                          filter.selectedOwnerKeys.length > 0
                            ? getSelectedOptionLabelString(
                                filter.selectedOwnerKeys,
                                true
                              )
                            : undefined
                        }>
                        <div className="tw:flex tw:items-center tw:gap-0">
                          <span>{filter.label}</span>
                          {filter.selectedOwnerKeys.length > 0 && (
                            <span>
                              {': '}
                              <span className="text-primary font-medium">
                                {getSelectedOptionLabelString(
                                  filter.selectedOwnerKeys
                                )}
                              </span>
                            </span>
                          )}
                        </div>
                        <DropDownIcon
                          className="flex self-center"
                          height={12}
                          width={12}
                        />
                      </div>
                    </UserTeamSelectableList>
                  </TooltipTrigger>
                </Tooltip>
              );
            }

            return (
              <SearchDropdown
                hideCounts
                key={filter.key}
                label={filter.label}
                searchKey={filter.searchKey}
                triggerButtonSize="middle"
                {...filter.searchProps}
              />
            );
          })}
        </div>
      )}
      <div
        className={classNames(
          { 'tw:mr-1': !showFilterBar },
          'tw:flex tw:shrink-0 tw:items-center tw:gap-4'
        )}>
        <span className="data-insight-label-text text-xs tw:whitespace-nowrap">
          {`${formatDate(chartFilter.startTs, true)} - ${formatDate(
            chartFilter.endTs,
            true
          )}`}
        </span>
        <DatePickerMenu
          defaultDateRange={defaultRange}
          handleDateRangeChange={onDateRangeChange}
          showSelectedCustomRange={false}
        />
      </div>
    </div>
  );

  const chartCards = DQ_DASHBOARD_SECTIONS.map((section) => (
    <Grid.Item className="export-pdf-container" key={section.key} span={24}>
      <Card className={cardClassName}>
        <div className={cardBodyClass}>
          <PageHeader
            data={{
              header: t(section.header.header),
              subHeader: t(section.header.subHeader),
            }}
          />
          <DqDashboardSectionContent
            defaultFilters={defaultFilters}
            pieChartFilters={pieChartFilters}
            sectionKey={section.key}
          />
        </div>
      </Card>
    </Grid.Item>
  ));

  if (isGovernanceView) {
    return (
      <div
        className={classNames('data-quality-governance-layout', className)}
        data-testid="dq-dashboard-container">
        <div className="data-quality-governance-filter-bar">
          {filterBarContent}
        </div>
        <div className="data-quality-governance-charts">
          <Grid rowGap="6">{chartCards}</Grid>
        </div>
      </div>
    );
  }

  return (
    <Grid
      className={classNames('m-b-md', className)}
      data-testid="dq-dashboard-container"
      rowGap="6">
      <Grid.Item span={24}>{filterBarContent}</Grid.Item>
      {chartCards}
    </Grid>
  );
};

export default DataQualityDashboard;
