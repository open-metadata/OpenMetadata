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
import { Button, Dropdown, Tooltip } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
import { isEmpty, isEqual, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString from 'qs';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactComponent as SettingIcon } from '../../../../../assets/svg/ic-settings-primery.svg';
import {
  DEFAULT_RANGE_DATA,
  DEFAULT_SELECTED_RANGE,
} from '../../../../../constants/profiler.constant';
import { useTourProvider } from '../../../../../context/TourProvider/TourProvider';
import { EntityTabs, EntityType } from '../../../../../enums/entity.enum';
import { ProfilerDashboardType } from '../../../../../enums/table.enum';
import { Operation } from '../../../../../generated/entity/policies/policy';
import LimitWrapper from '../../../../../hoc/LimitWrapper';
import useCustomLocation from '../../../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../../../hooks/useFqn';
import { getPrioritizedEditPermission } from '../../../../../utils/PermissionsUtils';
import {
  getAddCustomMetricPath,
  getEntityDetailsPath,
} from '../../../../../utils/RouterUtils';
import MuiDatePickerMenu from '../../../../common/MuiDatePickerMenu/MuiDatePickerMenu';
import { TestLevel } from '../../../../DataQuality/AddDataQualityTest/components/TestCaseFormV1.interface';
import { ProfilerTabPath } from '../../ProfilerDashboard/profilerDashboard.interface';
import ColumnPickerMenu from '../../TableProfiler/ColumnPickerMenu';
import profilerClassBase from '../../TableProfiler/ProfilerClassBase';
import { useTableProfiler } from '../../TableProfiler/TableProfilerProvider';

const TabFilters = () => {
  const { isTourOpen } = useTourProvider();
  const location = useCustomLocation();
  const { subTab: activeTab = profilerClassBase.getDefaultTabKey(isTourOpen) } =
    useParams<{ subTab: ProfilerTabPath }>();

  const { formType, activeColumnFqn, dateRangeObject } = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    const startTs = searchData.startTs
      ? Number(searchData.startTs)
      : DEFAULT_RANGE_DATA.startTs;
    const endTs = searchData.endTs
      ? Number(searchData.endTs)
      : DEFAULT_RANGE_DATA.endTs;

    return {
      activeColumnFqn: searchData.activeColumnFqn as string,
      formType:
        activeTab === ProfilerTabPath.COLUMN_PROFILE
          ? TestLevel.COLUMN
          : TestLevel.TABLE,
      dateRangeObject: {
        startTs,
        endTs,
        key: (searchData.key as string) ?? DEFAULT_SELECTED_RANGE.key,
        title: (searchData.title as string) ?? DEFAULT_SELECTED_RANGE.title,
      } as DateRangeObject,
    } as {
      activeColumnFqn: string;
      formType: TestLevel | ProfilerDashboardType;
      dateRangeObject: DateRangeObject;
    };
  }, [location.search, activeTab, isTourOpen]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const {
    permissions,
    isTableDeleted = false,
    onSettingButtonClick,
    onTestCaseDrawerOpen,
    table,
  } = useTableProfiler();

  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn: datasetFQN } = useFqn();
  const editDataProfile =
    permissions &&
    getPrioritizedEditPermission(permissions, Operation.EditDataProfile);

  const handleTestCaseClick = () => {
    onTestCaseDrawerOpen(formType as TestLevel);
    setIsMenuOpen(false);
  };

  const handleCustomMetricClick = () => {
    navigate(
      getAddCustomMetricPath(formType as ProfilerDashboardType, datasetFQN)
    );
    setIsMenuOpen(false);
  };

  const addMenuItems = [
    {
      id: 'test-case',
      label: t('label.test-case'),
      onAction: handleTestCaseClick,
    },
    {
      id: 'custom-metric',
      label: t('label.custom-metric'),
      onAction: handleCustomMetricClick,
    },
  ];

  const handleDateRangeChange = (value: DateRangeObject) => {
    const updatedFilter = pick(value, ['startTs', 'endTs', 'key', 'title']);
    const existingFilters = pick(dateRangeObject, ['startTs', 'endTs']);

    if (!isEqual(existingFilters, pick(updatedFilter, ['startTs', 'endTs']))) {
      const param = location.search;
      const searchData = QueryString.parse(
        param.startsWith('?') ? param.substring(1) : param
      );

      navigate(
        {
          pathname: getEntityDetailsPath(
            EntityType.TABLE,
            datasetFQN,
            EntityTabs.PROFILER,
            activeTab
          ),
          search: QueryString.stringify({
            ...searchData,
            ...updatedFilter,
          }),
        },
        {
          replace: true,
        }
      );
    }
  };

  const updateActiveColumnFqn = (key: string) => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    navigate({
      pathname: getEntityDetailsPath(
        EntityType.TABLE,
        datasetFQN,
        EntityTabs.PROFILER,
        activeTab
      ),
      search: QueryString.stringify({
        ...searchData,
        activeColumnFqn: key,
      }),
    });
  };

  return (
    <div className="tw:flex tw:items-center tw:justify-end tw:gap-5">
      {!isEmpty(activeColumnFqn) && (
        <div className="tw:flex tw:items-center tw:gap-2">
          <span className="tw:text-sm tw:font-medium tw:text-primary">
            {`${t('label.column')}:`}
          </span>
          <ColumnPickerMenu
            activeColumnFqn={activeColumnFqn}
            columns={table?.columns || []}
            handleChange={updateActiveColumnFqn}
          />
        </div>
      )}

      {[
        ProfilerTabPath.COLUMN_PROFILE,
        ProfilerTabPath.DATA_QUALITY,
        ProfilerTabPath.OVERVIEW,
        ProfilerTabPath.INCIDENTS,
      ].includes(activeTab) && isEmpty(activeColumnFqn) ? null : (
        <div className="tw:flex tw:items-center tw:gap-2">
          <span className="tw:text-sm tw:font-medium tw:text-primary">
            {`${t('label.date')}:`}
          </span>
          <MuiDatePickerMenu
            showSelectedCustomRange
            defaultDateRange={dateRangeObject}
            handleDateRangeChange={handleDateRangeChange}
            size="small"
          />
        </div>
      )}

      {editDataProfile && !isTableDeleted && (
        <>
          <LimitWrapper resource="dataQuality">
            <Dropdown.Root isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <Button
                color="primary"
                data-testid="profiler-add-table-test-btn"
                iconTrailing={<ChevronDown className="tw:size-4" />}
                size="sm">
                {t('label.add')}
              </Button>
              <Dropdown.Popover className="tw:w-max">
                <Dropdown.Menu items={addMenuItems}>
                  {(item) => (
                    <Dropdown.Item
                      id={item.id}
                      label={item.label}
                      onAction={item.onAction}
                    />
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </LimitWrapper>
          <Tooltip placement="top" title={t('label.setting-plural')}>
            <Button
              color="secondary"
              data-testid="profiler-setting-btn"
              size="sm"
              onClick={onSettingButtonClick}>
              <SettingIcon />
            </Button>
          </Tooltip>
        </>
      )}
    </div>
  );
};

export default TabFilters;
