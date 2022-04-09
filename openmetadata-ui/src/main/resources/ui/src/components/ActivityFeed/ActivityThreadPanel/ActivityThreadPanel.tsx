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

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { EntityThread } from 'Models';
import React, { FC, Fragment, RefObject, useEffect, useState } from 'react';
import AppState from '../../../AppState';
import { getAllFeeds } from '../../../axiosAPIs/feedsAPI';
import { confirmStateInitialValue } from '../../../constants/feed.constants';
import { observerOptions } from '../../../constants/Mydata.constants';
import { Paging } from '../../../generated/type/paging';
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll';
import jsonData from '../../../jsons/en';
import { getEntityField } from '../../../utils/FeedUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../Loader/Loader';
import { ConfirmState } from '../ActivityFeedCard/ActivityFeedCard.interface';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import FeedPanelHeader from '../ActivityFeedPanel/FeedPanelHeader';
import FeedPanelOverlay from '../ActivityFeedPanel/FeedPanelOverlay';
import DeleteConfirmationModal from '../DeleteConfirmationModal/DeleteConfirmationModal';
import ActivityThread from './ActivityThread';
import ActivityThreadList from './ActivityThreadList';
import { ActivityThreadPanelProp } from './ActivityThreadPanel.interface';

const ActivityThreadPanel: FC<ActivityThreadPanelProp> = ({
  threadLink,
  className,
  onCancel,
  open,
  postFeedHandler,
  createThread,
  deletePostHandler,
}) => {
  const [threads, setThreads] = useState<EntityThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EntityThread>();
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [showNewConversation, setShowNewConversation] =
    useState<boolean>(false);

  const [confirmationState, setConfirmationState] = useState<ConfirmState>(
    confirmStateInitialValue
  );

  const [elementRef, isInView] = useInfiniteScroll(observerOptions);

  const [paging, setPaging] = useState<Paging>({} as Paging);

  const [isThreadLoading, setIsThreadLoading] = useState(false);

  const getThreads = (after?: string) => {
    setIsThreadLoading(true);
    getAllFeeds(threadLink, after)
      .then((res: AxiosResponse) => {
        const { data, paging: pagingObj } = res.data;
        setThreads((prevData) => {
          if (after) {
            return [...prevData, ...data];
          } else {
            return [...data];
          }
        });
        setPaging(pagingObj);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-thread-error']
        );
      })
      .finally(() => {
        setIsThreadLoading(false);
      });
  };

  const onDiscard = () => {
    setConfirmationState(confirmStateInitialValue);
  };

  const onPostDelete = () => {
    if (confirmationState.postId && confirmationState.threadId) {
      deletePostHandler?.(confirmationState.threadId, confirmationState.postId);
    }
    onDiscard();
    setTimeout(() => {
      getThreads();
    }, 500);
  };

  const onConfirmation = (data: ConfirmState) => {
    setConfirmationState(data);
  };

  const entityField = getEntityField(threadLink);

  const onShowNewConversation = (value: boolean) => {
    setShowNewConversation(value);
  };

  const postFeed = (value: string) => {
    postFeedHandler?.(value, selectedThread?.id ?? selectedThreadId);
    setTimeout(() => {
      getThreads();
    }, 500);
  };

  const onThreadIdSelect = (id: string) => {
    setSelectedThreadId(id);
  };

  const onThreadSelect = (id: string) => {
    const thread = threads.find((f) => f.id === id);
    if (thread) {
      setSelectedThread(thread);
    }
  };

  const onBack = () => {
    setSelectedThread(undefined);
  };

  const onPostThread = (value: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;
    const data = {
      message: value,
      from: currentUser,
      about: threadLink,
    };
    createThread(data);
    setTimeout(() => {
      getThreads();
    }, 500);
  };

  const getLoader = () => {
    return isThreadLoading ? <Loader /> : null;
  };

  const fetchMoreThread = (
    isElementInView: boolean,
    pagingObj: Paging,
    isLoading: boolean
  ) => {
    if (isElementInView && pagingObj?.after && !isLoading) {
      getThreads(pagingObj.after);
    }
  };

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

  useEffect(() => {
    onThreadSelect(selectedThread?.id as string);
  }, [threads]);

  useEffect(() => {
    getThreads();
  }, [threadLink]);

  useEffect(() => {
    fetchMoreThread(isInView as boolean, paging, isThreadLoading);
  }, [paging, isThreadLoading, isInView]);

  return (
    <div className={classNames('tw-h-full', className)}>
      <FeedPanelOverlay
        className="tw-z-10 tw-fixed tw-inset-0 tw-top-16 tw-h-full tw-w-3/5 tw-bg-black tw-opacity-40"
        onCancel={onCancel}
      />
      <div
        className={classNames(
          'tw-top-16 tw-right-0 tw-bottom-0 tw-w-2/5 tw-bg-white tw-fixed tw-shadow-md tw-transform tw-ease-in-out tw-duration-1000 tw-overflow-y-auto tw-z-10',
          {
            'tw-translate-x-0': open,
            'tw-translate-x-full': !open,
          }
        )}>
        <FeedPanelHeader
          className="tw-px-4 tw-shadow-sm"
          entityField={entityField as string}
          noun="Conversations"
          onCancel={onCancel}
          onShowNewConversation={
            threads.length > 0 && isUndefined(selectedThread)
              ? onShowNewConversation
              : undefined
          }
        />

        {!isUndefined(selectedThread) ? (
          <Fragment>
            <p
              className="tw-py-3 tw-cursor-pointer link-text tw-pl-5"
              onClick={onBack}>
              {'< Back'}
            </p>
            <ActivityThread
              className="tw-pb-6 tw-pl-5"
              postFeed={postFeed}
              selectedThread={selectedThread}
              onConfirmation={onConfirmation}
            />
          </Fragment>
        ) : (
          <Fragment>
            {showNewConversation || threads.length === 0 ? (
              <div className="tw-pt-6">
                <p className="tw-ml-9 tw-mr-2 tw-my-2">
                  You are starting a new conversation
                </p>
                <ActivityFeedEditor
                  buttonClass="tw-mr-4"
                  className="tw-ml-5 tw-mr-2"
                  placeHolder="Enter a message"
                  onSave={onPostThread}
                />
              </div>
            ) : null}
            <ActivityThreadList
              className="tw-py-6 tw-pl-5"
              postFeed={postFeed}
              selectedThreadId={selectedThreadId}
              threads={threads}
              onConfirmation={onConfirmation}
              onThreadIdSelect={onThreadIdSelect}
              onThreadSelect={onThreadSelect}
            />
            <div
              data-testid="observer-element"
              id="observer-element"
              ref={elementRef as RefObject<HTMLDivElement>}>
              {getLoader()}
            </div>
          </Fragment>
        )}
      </div>
      {confirmationState.state && (
        <DeleteConfirmationModal
          onDelete={onPostDelete}
          onDiscard={onDiscard}
        />
      )}
    </div>
  );
};

export default ActivityThreadPanel;
