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

import { Button, Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmStateInitialValue } from '../../../constants/Feeds.constants';
import { FeedFilter } from '../../../enums/mydata.enum';
import { Thread, ThreadType } from '../../../generated/entity/feed/thread';
import { withLoader } from '../../../hoc/withLoader';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import { dropdownIcon as DropDownIcon } from '../../../utils/svgconstant';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import DropDownList from '../../dropdown/DropDownList';
import { ConfirmState } from '../ActivityFeedCard/ActivityFeedCard.interface';
import ActivityFeedPanel from '../ActivityFeedPanel/ActivityFeedPanel';
import DeleteConfirmationModal from '../DeleteConfirmationModal/DeleteConfirmationModal';
import NoFeedPlaceholder from '../NoFeedPlaceholder/NoFeedPlaceholder';
import { ActivityFeedListProp } from './ActivityFeedList.interface';
import './ActivityFeedList.less';
import {
  filterList,
  getFeedFilterDropdownIcon,
  getThreadFilterDropdownIcon,
  threadFilterList,
} from './ActivityFeedList.util';
import FeedListBody from './FeedListBody';
import FeedListSeparator from './FeedListSeparator';

const ActivityFeedList: FC<ActivityFeedListProp> = ({
  className,
  feedList,
  refreshFeedCount,
  onRefreshFeeds,
  withSidePanel = false,
  isEntityFeed = false,
  isFeedLoading,
  postFeedHandler,
  entityName,
  deletePostHandler,
  updateThreadHandler,
  onFeedFiltersUpdate,
  hideFeedFilter,
  hideThreadFilter,
  stickyFilter,
}) => {
  const { t } = useTranslation();
  const { updatedFeedList, relativeDays } =
    getFeedListWithRelativeDays(feedList);
  const [selectedThread, setSelectedThread] = useState<Thread>();
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  const [confirmationState, setConfirmationState] = useState<ConfirmState>(
    confirmStateInitialValue
  );
  const [fieldListVisible, setFieldListVisible] = useState<boolean>(false);
  const [showThreadTypeList, setShowThreadTypeList] = useState<boolean>(false);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>(
    isEntityFeed ? FeedFilter.ALL : FeedFilter.OWNER
  );
  const [threadType, setThreadType] = useState<ThreadType>();

  const handleDropDown = useCallback(
    (_e: React.MouseEvent<HTMLElement, MouseEvent>, value?: string) => {
      const feedType =
        (value as FeedFilter) ||
        (isEntityFeed ? FeedFilter.ALL : FeedFilter.OWNER);

      setFeedFilter(feedType);
      setFieldListVisible(false);
      onFeedFiltersUpdate && onFeedFiltersUpdate(feedType, threadType);
    },
    [setFeedFilter, setFieldListVisible, onFeedFiltersUpdate, threadType]
  );

  const onDiscard = () => {
    setConfirmationState(confirmStateInitialValue);
  };

  const onPostDelete = () => {
    if (confirmationState.postId && confirmationState.threadId) {
      deletePostHandler?.(
        confirmationState.threadId,
        confirmationState.postId,
        confirmationState.isThread
      );
    }
    onDiscard();
  };

  const onConfirmation = (data: ConfirmState) => {
    setConfirmationState(data);
  };

  const onThreadIdSelect = (id: string) => {
    setSelectedThreadId(id);
    setSelectedThread(undefined);
  };

  const onThreadIdDeselect = () => {
    setSelectedThreadId('');
  };

  const onThreadSelect = (id: string) => {
    const thread = feedList.find((f) => f.id === id);
    if (thread) {
      setSelectedThread(thread);
    }
  };

  const onViewMore = () => {
    setIsPanelOpen(true);
  };

  const onCancel = () => {
    setSelectedThread(undefined);
    setIsPanelOpen(false);
  };

  const postFeed = (value: string) => {
    postFeedHandler?.(value, selectedThread?.id ?? selectedThreadId);
  };

  // Thread filter change handler
  const handleThreadTypeDropDownChange = useCallback(
    (_e: React.MouseEvent<HTMLElement, MouseEvent>, value?: string) => {
      const threadType =
        value === 'ALL' ? undefined : (value as ThreadType) ?? undefined;
      setThreadType(threadType);
      setShowThreadTypeList(false);
      onFeedFiltersUpdate && onFeedFiltersUpdate(feedFilter, threadType);
    },
    [feedFilter, onFeedFiltersUpdate, setThreadType, setShowThreadTypeList]
  );

  const feedFilterList = useMemo(
    () =>
      isEntityFeed
        ? filterList.filter((f) => f.value === 'ALL' || f.value === 'MENTIONS')
        : filterList.slice(),
    [isEntityFeed]
  );

  const getFilterDropDown = () => {
    return hideFeedFilter && hideThreadFilter ? null : (
      <Row
        className={classNames(
          'filters-container',
          stickyFilter ? 'm-x-xs' : ''
        )}
        justify="space-between">
        {/* Feed filter */}
        <Col>
          {!hideFeedFilter && (
            <>
              <Button
                className="flex items-center"
                data-testid="feeds"
                icon={getFeedFilterDropdownIcon(feedFilter)}
                type="link"
                onClick={() => setFieldListVisible((visible) => !visible)}>
                <Typography.Text className="font-medium text-primary m-x-xss">
                  {feedFilterList.find((f) => f.value === feedFilter)?.name}
                </Typography.Text>
                <DropDownIcon className="dropdown-icon" />
              </Button>
              {fieldListVisible && (
                <DropDownList
                  dropDownList={feedFilterList}
                  value={feedFilter}
                  onSelect={handleDropDown}
                />
              )}
            </>
          )}
        </Col>
        {/* Thread filter */}
        <Col>
          {!hideThreadFilter && (
            <>
              <Button
                className="flex items-center"
                data-testid="thread-filter"
                icon={getThreadFilterDropdownIcon(threadType ?? 'ALL')}
                type="link"
                onClick={() => setShowThreadTypeList((visible) => !visible)}>
                <Typography.Text className="font-medium text-primary m-x-xss">
                  {
                    threadFilterList.find(
                      (f) => f.value === (threadType ?? 'ALL')
                    )?.name
                  }
                </Typography.Text>
                <DropDownIcon className="dropdown-icon" />
              </Button>
              {showThreadTypeList && (
                <DropDownList
                  horzPosRight
                  dropDownList={threadFilterList}
                  value={threadType}
                  onSelect={handleThreadTypeDropDownChange}
                />
              )}
            </>
          )}
        </Col>
      </Row>
    );
  };

  useEffect(() => {
    onThreadSelect(selectedThread?.id ?? selectedThreadId);
  }, [feedList]);

  useEffect(() => {
    const escapeKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', escapeKeyHandler);

    return () => {
      document.removeEventListener('keydown', escapeKeyHandler);
    };
  }, []);

  return (
    <div className={classNames(className, 'feed-list-container')} id="feedData">
      <div className={stickyFilter ? 'filters-wrapper' : ''}>
        {feedList.length === 0 && feedFilter === FeedFilter.OWNER && !threadType
          ? null
          : getFilterDropDown()}
      </div>
      {refreshFeedCount ? (
        <div className="tw-py-px tw-pt-3 tw-pb-3">
          <button className="tw-refreshButton " onClick={onRefreshFeeds}>
            {t('label.view-new-count', { count: refreshFeedCount })}{' '}
            {refreshFeedCount > 1
              ? t('label.activity-lowercase-plural')
              : t('label.activity-lowercase')}
          </button>
        </div>
      ) : null}
      {feedList.length > 0 ? (
        <>
          {relativeDays.map((d, i) => {
            return (
              <div data-testid={`feed${i}`} key={i}>
                <FeedListSeparator
                  className="relative m-y-xs"
                  relativeDay={d}
                />
                <FeedListBody
                  deletePostHandler={deletePostHandler}
                  isEntityFeed={isEntityFeed}
                  postFeed={postFeed}
                  relativeDay={d}
                  selectedThreadId={selectedThreadId}
                  updateThreadHandler={updateThreadHandler}
                  updatedFeedList={updatedFeedList}
                  withSidePanel={withSidePanel}
                  onConfirmation={onConfirmation}
                  onThreadIdDeselect={onThreadIdDeselect}
                  onThreadIdSelect={onThreadIdSelect}
                  onThreadSelect={onThreadSelect}
                  onViewMore={onViewMore}
                />
              </div>
            );
          })}
          {withSidePanel && selectedThread && isPanelOpen ? (
            <>
              <ActivityFeedPanel
                deletePostHandler={deletePostHandler}
                open={!isUndefined(selectedThread) && isPanelOpen}
                postFeed={postFeed}
                selectedThread={selectedThread}
                updateThreadHandler={updateThreadHandler}
                onCancel={onCancel}
              />
            </>
          ) : null}
        </>
      ) : (
        !isFeedLoading && (
          <div className="h-min-50" data-testid="no-data-placeholder-container">
            {entityName && feedFilter === FeedFilter.ALL && !threadType ? (
              <NoFeedPlaceholder entityName={entityName} />
            ) : !refreshFeedCount ? (
              <ErrorPlaceHolder>
                {t('message.no-data-available-for-selected-filter')}
              </ErrorPlaceHolder>
            ) : null}
          </div>
        )
      )}
      <DeleteConfirmationModal
        visible={confirmationState.state}
        onDelete={onPostDelete}
        onDiscard={onDiscard}
      />
    </div>
  );
};

export default withLoader<ActivityFeedListProp>(ActivityFeedList);
