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

import { Box, Card, Grid, Typography } from '@openmetadata/ui-core-components';
import { Copy01 } from '@openmetadata/ui-core-components/icons';
import { Button, Tooltip } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import classNames from 'classnames';
import { isUndefined, split } from 'lodash';
import { Duration } from 'luxon';
import Qs from 'qs';
import { FC, lazy, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as ExitFullScreen } from '../../../assets/svg/exit-full-screen.svg';
import { ReactComponent as FullScreen } from '../../../assets/svg/full-screen.svg';
import {
  ONE_MINUTE_IN_MILLISECOND,
  PIPE_SYMBOL,
} from '../../../constants/constants';
import {
  QUERY_DATE_FORMAT,
  QUERY_LINE_HEIGHT,
} from '../../../constants/Query.constant';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../hooks/useFqn';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { parseSearchParams } from '../../../utils/Query/QueryUtils';
import queryClassBase from '../../../utils/QueryClassBase';
import { getEntityDetailsPath, getQueryPath } from '../../../utils/RouterUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import QueryCardExtraOption from './QueryCardExtraOption/QueryCardExtraOption.component';
import QueryUsedByOtherTable from './QueryUsedByOtherTable/QueryUsedByOtherTable.component';
import './table-queries.style.less';
import { QueryCardProp } from './TableQueries.interface';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../SchemaEditor/SchemaEditor'))
);

const QueryCard: FC<QueryCardProp> = ({
  isExpanded = false,
  className,
  query,
  selectedId,
  onQuerySelection,
  onQueryUpdate,
  permission,
  onUpdateVote,
  afterDeleteAction,
}: QueryCardProp) => {
  const { t } = useTranslation();
  const QueryExtras = queryClassBase.getQueryExtras();
  const { fqn: datasetFQN } = useFqn();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { onCopyToClipBoard } = useClipboard(query.query);
  const searchFilter = useMemo(
    () => parseSearchParams(location.search),
    [location.search]
  );

  const [isEditMode, setIsEditMode] = useState(false);
  const [sqlQuery, setSqlQuery] = useState({
    query: query.query,
    isLoading: false,
  });
  const [selectedTables, setSelectedTables] = useState<DefaultOptionType[]>();

  const { isAllowExpand, queryDate } = useMemo(() => {
    const queryArr = split(query.query, '\n');
    const queryDate = customFormatDateTime(
      query.queryDate || 0,
      QUERY_DATE_FORMAT
    );

    return { isAllowExpand: queryArr.length > QUERY_LINE_HEIGHT, queryDate };
  }, [query]);

  const duration = useMemo(() => {
    const durationInMilliSeconds = query.duration;

    if (isUndefined(durationInMilliSeconds)) {
      return undefined;
    }

    if (durationInMilliSeconds < 1) {
      return `${t('label.runs-for')} ${durationInMilliSeconds} ms`;
    }

    const duration = Duration.fromObject({
      milliseconds: durationInMilliSeconds,
    });

    let formatString;
    if (durationInMilliSeconds < ONE_MINUTE_IN_MILLISECOND) {
      formatString = "s.S 'sec'";
    } else {
      formatString = "m 'min' s 'sec'";
    }

    // Format the duration as a string using the chosen format string
    return duration.toFormat(`'${t('label.runs-for')}' ${formatString}`);
  }, [query]);

  const updateSqlQuery = async () => {
    setSqlQuery((pre) => ({ ...pre, isLoading: true }));

    const updatedData = {
      ...query,
      query: query.query !== sqlQuery.query ? sqlQuery.query : query.query,
      queryUsedIn: isUndefined(selectedTables)
        ? query.queryUsedIn
        : selectedTables.map((option) => {
            const existingTable = query.queryUsedIn?.find(
              (table) => table.id === option.value
            );

            return (
              existingTable ?? {
                id: (option.value as string) ?? '',
                displayName: option.labelName as string,
                type: EntityType.TABLE,
              }
            );
          }),
    };
    if (query.query !== sqlQuery.query || !isUndefined(selectedTables)) {
      await onQueryUpdate(updatedData, 'query');
    }

    setSqlQuery((pre) => ({ ...pre, isLoading: false }));
    setIsEditMode(false);
  };

  const handleQueryChange = (value: string) => {
    setSqlQuery((pre) => ({ ...pre, query: value }));
  };

  const handleExpandClick = () => {
    if (isExpanded) {
      navigate({
        search: Qs.stringify(searchFilter),
        pathname: getEntityDetailsPath(
          EntityType.TABLE,
          datasetFQN,
          EntityTabs.TABLE_QUERIES
        ),
      });
    } else {
      navigate({
        search: Qs.stringify({ ...searchFilter, query: query.id }),
        pathname: getQueryPath(datasetFQN, query.id ?? ''),
      });
    }
  };

  const handleCardClick = () => {
    onQuerySelection?.(query);
  };

  const renderCardTitle = () => (
    <Box
      inline
      align="center"
      className="layout-space layout-space-horizontal font-normal p-y-xs"
      gap={2}
      itemClassName="layout-space-item">
      <Typography className="text-sm">{queryDate}</Typography>
      {duration && (
        <>
          <Typography className="text-gray-400">{PIPE_SYMBOL}</Typography>
          <Typography className="text-sm" data-testid="query-run-duration">
            {duration}
          </Typography>
        </>
      )}
    </Box>
  );

  const renderExpandIcon = () =>
    isExpanded ? (
      <Tooltip title={t('label.exit-fit-to-screen')}>
        <ExitFullScreen height={16} width={16} />
      </Tooltip>
    ) : (
      <Tooltip title={t('label.fit-to-screen')}>
        <FullScreen height={16} width={16} />
      </Tooltip>
    );

  const renderEditActions = () =>
    isEditMode && (
      <Box
        inline
        align="end"
        className="layout-space layout-space-horizontal w-full justify-end p-r-md"
        gap={4}
        itemClassName="layout-space-item">
        <Button
          data-testid="cancel-query-btn"
          key="cancel"
          size="small"
          onClick={() => setIsEditMode(false)}>
          {t('label.cancel')}
        </Button>

        <Button
          data-testid="save-query-btn"
          key="save"
          loading={sqlQuery.isLoading}
          size="small"
          type="primary"
          onClick={updateSqlQuery}>
          {t('label.save')}
        </Button>
      </Box>
    );

  return (
    <Grid
      className="layout-row layout-grid"
      style={{ ...getLayoutGutter(0, 8) }}>
      <Grid.Item
        className="layout-column"
        span={isExpanded && QueryExtras ? 12 : 24}>
        {/* Light values reproduce the antd Card head this replaced. */}
        <Card
          className={classNames(
            'query-card-container tw:overflow-visible tw:text-sm tw:leading-[1.5715] tw:text-primary tw:tabular-nums',
            { selected: selectedId === query?.id },
            className
          )}
          onClick={handleCardClick}>
          <div
            className={classNames(
              'tw:-mb-px tw:flex tw:min-h-12 tw:items-center tw:border-b',
              'tw:border-black/6 tw:px-6 tw:text-base tw:leading-[1.5715]',
              'tw:font-medium tw:text-black/85 tw:dark:border-secondary',
              'tw:dark:text-primary'
            )}>
            <div className="tw:inline-block tw:flex-1 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap tw:py-4">
              {renderCardTitle()}
            </div>
            <div className="tw:ml-auto tw:text-sm tw:leading-[1.5715] tw:font-normal tw:text-primary">
              <QueryCardExtraOption
                afterDeleteAction={afterDeleteAction}
                permission={permission}
                query={query}
                onEditClick={setIsEditMode}
                onUpdateVote={onUpdateVote}
              />
            </div>
          </div>
          <div className="tw:pt-px">
            <Box
              inline
              align="center"
              className="layout-space layout-space-horizontal query-entity-button"
              gap={2}
              itemClassName="layout-space-item">
              <Button
                className="flex-center"
                data-testid="query-entity-expand-button"
                icon={renderExpandIcon()}
                onClick={handleExpandClick}
              />
              <Tooltip title={t('message.copy-to-clipboard')}>
                <Button
                  className="flex-center"
                  data-testid="query-entity-copy-button"
                  icon={<Copy01 size={16} />}
                  onClick={onCopyToClipBoard}
                />
              </Tooltip>
            </Box>

            <div
              className={classNames(
                'sql-editor-container',
                !isExpanded && {
                  'h-max-24': !isAllowExpand,
                  'h-24': !isEditMode,
                  'h-max-56': isEditMode && isAllowExpand,
                }
              )}>
              <SchemaEditor
                editorClass={classNames('custom-code-mirror-theme', {
                  'full-screen-editor-height': isExpanded,
                })}
                mode={{ name: CSMode.SQL }}
                options={{
                  styleActiveLine: isEditMode,
                  readOnly: isEditMode ? false : 'nocursor',
                }}
                showCopyButton={false}
                value={query.query ?? ''}
                onChange={handleQueryChange}
              />
            </div>
            <Grid className="layout-row layout-grid tw:items-center p-y-md border-top">
              <Grid.Item className="layout-column p-l-md" span={20}>
                <QueryUsedByOtherTable
                  isEditMode={isEditMode}
                  query={query}
                  onChange={(value) => setSelectedTables(value)}
                />
              </Grid.Item>
              <Grid.Item className="layout-column" span={4}>
                {renderEditActions()}
              </Grid.Item>
            </Grid>
          </div>
        </Card>
      </Grid.Item>
      {isExpanded && QueryExtras && <QueryExtras />}
    </Grid>
  );
};

export default QueryCard;
