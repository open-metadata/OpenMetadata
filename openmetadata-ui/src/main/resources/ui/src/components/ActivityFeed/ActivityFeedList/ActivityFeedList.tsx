/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { FC, Fragment, useEffect, useMemo, useState } from 'react';
import { confirmStateInitialValue } from '../../../constants/feed.constants';
import { FeedFilter } from '../../../enums/mydata.enum';
import { Thread, ThreadType } from '../../../generated/entity/feed/thread';
import { withLoader } from '../../../hoc/withLoader';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import { dropdownIcon as DropDownIcon } from '../../../utils/svgconstant';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import DropDownList from '../../dropdown/DropDownList';
import { ConfirmState } from '../ActivityFeedCard/ActivityFeedCard.interface';
import ActivityFeedPanel from '../ActivityFeedPanel/ActivityFeedPanel';
import DeleteConfirmationModal from '../DeleteConfirmationModal/DeleteConfirmationModal';
import NoFeedPlaceholder from '../NoFeedPlaceholder/NoFeedPlaceholder';
import { ActivityFeedListProp } from './ActivityFeedList.interface';
import { filterList, threadFilterList } from './ActivityFeedList.util';
import FeedListBody from './FeedListBody';
import FeedListSeparator from './FeedListSeparator';

const ActivityFeedList: FC<ActivityFeedListProp> = ({
  className,
  feedList,
  withSidePanel = false,
  isEntityFeed = false,
  postFeedHandler,
  entityName,
  deletePostHandler,
  updateThreadHandler,
  onFeedFiltersUpdate,
}) => {
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
  const [feedFilter, setFeedFilter] = useState<FeedFilter>(FeedFilter.ALL);
  const [threadType, setThreadType] = useState<ThreadType>();

  const handleDropDown = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    setFeedFilter((value as FeedFilter) || FeedFilter.ALL);
    setFieldListVisible(false);
  };

  const onDiscard = () => {
    setConfirmationState(confirmStateInitialValue);
  };

  const onPostDelete = () => {
    if (confirmationState.postId && confirmationState.threadId) {
      deletePostHandler?.(confirmationState.threadId, confirmationState.postId);
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
  const handleThreadTypeDropDownChange = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    setThreadType(
      value === 'ALL' ? undefined : (value as ThreadType) ?? undefined
    );
    setShowThreadTypeList(false);
  };

  const feedFilterList = useMemo(
    () =>
      isEntityFeed
        ? filterList.filter((f) => f.value === 'ALL' || f.value === 'MENTIONS')
        : filterList.slice(),
    [isEntityFeed]
  );

  useEffect(() => {
    onFeedFiltersUpdate && onFeedFiltersUpdate(feedFilter, threadType);
  }, [threadType, feedFilter]);

  const getFilterDropDown = () => {
    return (
      <div className="tw-flex tw-justify-between">
        {/* Feed filter */}
        <div className="tw-relative tw-mt-5 tw-mr-5">
          <Button
            className="hover:tw-no-underline focus:tw-no-underline"
            data-testid="feeds"
            size="custom"
            tag="button"
            variant="link"
            onClick={() => setFieldListVisible((visible) => !visible)}>
            <span className="tw-font-medium tw-text-grey">
              {feedFilterList.find((f) => f.value === feedFilter)?.name}
            </span>
            <DropDownIcon />
          </Button>
          {fieldListVisible && (
            <DropDownList
              dropDownList={feedFilterList}
              value={feedFilter}
              onSelect={handleDropDown}
            />
          )}
        </div>
        {/* Thread filter */}
        <div className="tw-relative tw-mt-5">
          <Button
            className="hover:tw-no-underline focus:tw-no-underline"
            data-testid="thread-filter"
            size="custom"
            tag="button"
            variant="link"
            onClick={() => setShowThreadTypeList((visible) => !visible)}>
            <SVGIcons alt="filter" icon={Icons.FILTERS} width="14px" />
            <span className="tw-font-medium tw-text-grey tw-ml-1">
              {
                threadFilterList.find((f) => f.value === (threadType ?? 'ALL'))
                  ?.name
              }
            </span>
            <DropDownIcon />
          </Button>
          {showThreadTypeList && (
            <DropDownList
              dropDownList={threadFilterList}
              value={threadType}
              onSelect={handleThreadTypeDropDownChange}
            />
          )}
        </div>
      </div>
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
    <div className={classNames(className)} id="feedData">
      {feedList.length > 0 ? (
        <Fragment>
          {getFilterDropDown()}
          {relativeDays.map((d, i) => {
            return (
              <div data-testid={`feed${i}`} key={i}>
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
            <Fragment>
              <ActivityFeedPanel
                deletePostHandler={deletePostHandler}
                open={!isUndefined(selectedThread) && isPanelOpen}
                postFeed={postFeed}
                selectedThread={selectedThread}
                updateThreadHandler={updateThreadHandler}
                onCancel={onCancel}
              />
            </Fragment>
          ) : null}
        </Fragment>
      ) : (
        <Fragment>
          {entityName ? (
            <NoFeedPlaceholder entityName={entityName} />
          ) : (
            <Fragment>
              <FeedListSeparator
                className="tw-relative tw-mt-1 tw-mb-3.5 tw-pb-5"
                relativeDay=""
              />
              <>No conversations found. Try changing the filter.</>
            </Fragment>
          )}
        </Fragment>
      )}
      {confirmationState.state && (
        <DeleteConfirmationModal
          onDelete={onPostDelete}
          onDiscard={onDiscard}
        />
      )}
    </div>
  );
};

export default withLoader<ActivityFeedListProp>(ActivityFeedList);
