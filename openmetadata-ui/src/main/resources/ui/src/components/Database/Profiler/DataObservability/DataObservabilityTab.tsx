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
import { Tabs } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import Qs from 'qs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ReactComponent as DropDownIcon } from '../../../../assets/svg/drop-down.svg';
import { PAGE_HEADERS } from '../../../../constants/PageHeaders.constant';
import { useTourProvider } from '../../../../context/TourProvider/TourProvider';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../../hooks/useFqn';
import { getDataQualityReport } from '../../../../rest/testAPI';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import TabsLabel from '../../../common/TabsLabel/TabsLabel.component';
import { ProfilerTabPath } from '../ProfilerDashboard/profilerDashboard.interface';
import profilerClassBase from '../TableProfiler/ProfilerClassBase';
import { TableProfilerProps } from '../TableProfiler/TableProfiler.interface';
import { TableProfilerProvider } from '../TableProfiler/TableProfilerProvider';
import './data-observability-tab.less';
import TabFilters from './TabFilters/TabFilters';

const DataObservabilityTab = (props: TableProfilerProps) => {
  const { t } = useTranslation();
  const { isTourOpen } = useTourProvider();
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { fqn: tableFqn } = useFqn();
  const { subTab: activeTab = profilerClassBase.getDefaultTabKey(isTourOpen) } =
    useParams<{ subTab: ProfilerTabPath }>();
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({
    [ProfilerTabPath.INCIDENTS]: 0,
  });

  const searchData = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData;
  }, [location.search]);

  const { activeColumnFqn } = searchData;

  const tabOptions = useMemo(() => {
    return profilerClassBase.getProfilerTabOptions();
  }, []);

  const activeTabComponent = useMemo(() => {
    const tabComponents = profilerClassBase.getProfilerTabs();
    const ActiveComponent = tabComponents[activeTab];

    if (!ActiveComponent) {
      return null;
    }

    return <ActiveComponent />;
  }, [activeTab]);

  const handleTabChange = (key: string) => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    navigate(
      {
        pathname: getEntityDetailsPath(
          EntityType.TABLE,
          tableFqn,
          EntityTabs.PROFILER,
          key as ProfilerTabPath
        ),
        search:
          key === ProfilerTabPath.INCIDENTS
            ? undefined
            : Qs.stringify(searchData),
      },
      {
        replace: true,
      }
    );
  };

  const fetchNewIncidentCount = async () => {
    const { data: newIncidentData } = await getDataQualityReport({
      q: JSON.stringify({
        query: {
          bool: {
            must: [
              {
                term: {
                  testCaseResolutionStatusType:
                    TestCaseResolutionStatusTypes.New,
                },
              },
              {
                wildcard: {
                  'testCase.entityFQN.keyword': `${tableFqn}*`,
                },
              },
            ],
          },
        },
      }),
      index: 'testCaseResolutionStatus',
      aggregationQuery:
        'bucketName=newIncidents:aggType=cardinality:field=stateId',
    });

    const { data: resolvedIncidentData } = await getDataQualityReport({
      q: JSON.stringify({
        query: {
          bool: {
            must: [
              {
                term: {
                  testCaseResolutionStatusType:
                    TestCaseResolutionStatusTypes.Resolved,
                },
              },
              {
                wildcard: {
                  'testCase.entityFQN.keyword': `${tableFqn}*`,
                },
              },
            ],
          },
        },
      }),
      index: 'testCaseResolutionStatus',
      aggregationQuery:
        'bucketName=newIncidents:aggType=cardinality:field=stateId',
    });

    const newIncidentCount =
      newIncidentData.length > 0 ? +newIncidentData[0].stateId : 0;
    const resolvedIncidentCount =
      resolvedIncidentData.length > 0 ? +resolvedIncidentData[0].stateId : 0;

    setTabCounts((prevCounts) => ({
      ...prevCounts,
      [ProfilerTabPath.INCIDENTS]: newIncidentCount - resolvedIncidentCount,
    }));
  };

  useEffect(() => {
    fetchNewIncidentCount();
  }, []);

  return (
    <TableProfilerProvider {...props}>
      <div
        className="data-observability-tab-container"
        data-testid="table-profiler-container"
        id="profilerDetails">
        <div className="tw:flex tw:items-center tw:justify-between">
          {isEmpty(activeColumnFqn) ? (
            <Tabs
              className="tw:w-auto"
              selectedKey={activeTab}
              onSelectionChange={(key) => handleTabChange(String(key))}>
              <Tabs.List type="button-border">
                {tabOptions.map(({ label, key }) => (
                  <Tabs.Item
                    className={({ isSelected, isHovered }) =>
                      isSelected || isHovered
                        ? 'tw:bg-brand-solid tw:text-primary_on-brand'
                        : ''
                    }
                    id={key}
                    key={key}>
                    <TabsLabel count={tabCounts?.[key]} id={key} name={label} />
                  </Tabs.Item>
                ))}
              </Tabs.List>
            </Tabs>
          ) : (
            <Link
              className="tw:flex tw:items-center tw:gap-1 tw:font-semibold tw:no-underline!"
              to={{
                pathname: getEntityDetailsPath(
                  EntityType.TABLE,
                  tableFqn,
                  EntityTabs.PROFILER,
                  ProfilerTabPath.COLUMN_PROFILE
                ),
                search: Qs.stringify({
                  ...searchData,
                  activeColumnFqn: undefined,
                }),
              }}>
              <DropDownIcon className="transform-90" height={16} width={16} />
              {t(PAGE_HEADERS.COLUMN_PROFILE.header)}
            </Link>
          )}
          <TabFilters />
        </div>
        <div className="data-observability-content-panel">
          {activeTabComponent}
        </div>
      </div>
    </TableProfilerProvider>
  );
};

export default DataObservabilityTab;
