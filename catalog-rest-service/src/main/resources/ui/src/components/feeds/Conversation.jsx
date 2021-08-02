/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import PropTypes from 'prop-types';
import React, { useState } from 'react';
import { Media } from 'react-bootstrap';
import placeholder from '../../assets/img/user-placeholder.png';
import { postFeedById } from '../../axiosAPIs/feedsAPI';
import useToastContext from '../../hooks/useToastContext';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { getRelativeTime } from '../../utils/TimeUtils';
import MarkdownEditor from '../common/editor/Editor';
// import ProfileIcon from './ProfileIcon';
import QuickReply from './QuickReply';

const Conversation = ({ handleReply, thread, conversationIndex }) => {
  const [showEditor, setShowEditor] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const showToast = useToastContext();

  const {
    profileUrl,
    title,
    relativeTime,
    toEntity,
    entity,
    message,
    quickReplies,
    // level = 0,
    subThreads,
    threadId,
  } = thread;
  const lastReplyTs =
    subThreads && subThreads.length
      ? subThreads[subThreads.length - 1]?.timestamp
      : null;
  const handleQuickReplayClick = () => {
    return;
  };

  const onCancel = () => {
    setShowEditor(false);
  };

  const onSave = (updatedHTML) => {
    const data = {
      message: updatedHTML,
      // from: '02ed08dd-ae82-4d37-a501-2af1e513848c',
      from: [
        '002edd71-f26d-48d2-aa76-cfe0767b8adc',
        'e871805a-2cea-4fd2-8fcc-339202a92150',
        '022edb80-9a75-4a2f-9756-d5e7e40431bb',
        '0a4ce909-2b4b-4012-8958-432ece4a3544',
        '0e3eb5cb-15b0-4348-b89a-bbde806d6116',
      ][Math.floor(Math.random() * 5)],
    };
    postFeedById(threadId, data).then(() => {
      setShowEditor(false);
      showToast({
        variant: 'info',
        body: 'Reply Posted Successfully!',
      });
      handleReply();
    });
    setShowEditor(false);
  };

  const onReply = () => {
    setShowEditor(true);
  };

  // const renderThread = (
  //   { mainThread, profileUrl, title, timestamp, quickReplies, message },
  //   depth
  // ) => {
  //   return (

  //     // <div
  //     //   className={`thread thread-${depth}`}
  //     //   key={`${title}-${timestamp}`}
  //     //   data-testid="thread">
  //     //   <div className="profile-image">
  //     //     <ProfileIcon imgSrc={profileUrl} title={title} />
  //     //   </div>
  //     //   <div className="chat-details">
  //     //     <div className="chat-header">
  //     //       <h5 className="mr-1">
  //     //         {title}
  //     //         <span className="time">{timestamp}</span>
  //     //       </h5>
  //     //       {mainThread && (
  //     //         <span>
  //     //           Suggested description change on{' '}
  //     //           <strong>{entityType + ' ' + toEntity}</strong>
  //     //         </span>
  //     //       )}
  //     //     </div>
  //     //     <div dangerouslySetInnerHTML={{ __html: message }} className="chat-message"></div>
  //     //     {quickReplies &&
  //     //       quickReplies.map(({ text }) => (
  //     //         <QuickReply
  //     //           key={text}
  //     //           text={text}
  //     //           onClick={handleQuickReplayClick}
  //     //         />
  //     //       ))}
  //     //   </div>
  //     //   {mainThread && handleReply && (
  //     //     <div className="action-buttons">
  //     //       <SVGIcons
  //     //         icon={Icons.DELETE}
  //     //         height={16}
  //     //         width={16}
  //     //         alt="Delete"
  //     //         title="Delete"
  //     //       />
  //     //       <SVGIcons
  //     //         icon={Icons.REPLY}
  //     //         alt="Reply"
  //     //         height={16}
  //     //         width={16}
  //     //         title="Reply"
  //     //         onClick={() => {
  //     //           handleReply(threadId);
  //     //         }}
  //     //       />
  //     //     </div>
  //     //   )}
  //     // </div>
  //   );
  // };

  return (
    <>
      {conversationIndex > 0 && <div className="horz-separator my-2" />}
      <Media data-testid="thread" key={`${title}-${conversationIndex}`}>
        <img
          alt="Generic placeholder"
          className="mr-2"
          height={24}
          src={profileUrl ? profileUrl : placeholder}
          width={24}
        />
        <Media.Body>
          <div className="chat-header">
            <span className="title mr-1">
              {title}
              <span className="time">{relativeTime}</span>
            </span>
          </div>
          <div className="chat-message">
            <div className="mb-1">
              <span>
                Suggested description change on{' '}
                <strong>{entity + ' ' + toEntity}</strong>
              </span>
            </div>
            <div dangerouslySetInnerHTML={{ __html: message }} />
          </div>
          {quickReplies &&
            quickReplies.map(({ text }) => (
              <QuickReply
                key={text}
                text={text}
                onClick={handleQuickReplayClick}
              />
            ))}
        </Media.Body>
        <div className="action-buttons">
          <SVGIcons
            alt="Delete"
            height={16}
            icon={Icons.DELETE}
            title="Delete"
            width={16}
          />
          <SVGIcons
            alt="Reply"
            height={16}
            icon={Icons.REPLY}
            title="Reply"
            width={16}
            onClick={() => {
              onReply(threadId);
            }}
          />
        </div>
      </Media>
      {subThreads &&
        subThreads.length > 0 &&
        (showAllReplies || subThreads.length === 1 ? (
          <>
            {subThreads.map((thread, index) => {
              const { profileUrl, title, relativeTime, quickReplies, message } =
                thread;

              return (
                <Media className="child" data-testid="thread" key={index}>
                  <img
                    alt="Generic placeholder"
                    className="mr-2"
                    height={24}
                    src={profileUrl ? profileUrl : placeholder}
                    width={24}
                  />
                  <Media.Body>
                    <div className="chat-header">
                      <span className="title mr-1">
                        {title}
                        <span className="time">{relativeTime}</span>
                      </span>
                    </div>
                    <div
                      className="chat-message"
                      dangerouslySetInnerHTML={{ __html: message }}
                    />
                    {quickReplies &&
                      quickReplies.map(({ text }) => (
                        <QuickReply
                          key={text}
                          text={text}
                          onClick={handleQuickReplayClick}
                        />
                      ))}
                  </Media.Body>
                  <div className="action-buttons">
                    <SVGIcons
                      alt="Delete"
                      height={16}
                      icon={Icons.DELETE}
                      title="Delete"
                      width={16}
                    />
                    <SVGIcons
                      alt="Reply"
                      height={16}
                      icon={Icons.REPLY}
                      title="Reply"
                      width={16}
                      onClick={() => {
                        onReply(threadId);
                      }}
                    />
                  </div>
                </Media>
              );
            })}
            {subThreads.length > 1 && (
              <span
                className="child alink"
                onClick={() => setShowAllReplies((show) => !show)}>
                Hide Replies
              </span>
            )}
          </>
        ) : (
          <div
            className="child thread-collapsed"
            data-testid="thread-collapsed">
            {subThreads
              .reverse()
              .slice(0, 3)
              .map((thread, index) => {
                const { profileUrl, title } = thread;

                return (
                  <img
                    alt="Generic placeholder"
                    height={24}
                    key={index}
                    src={profileUrl ? profileUrl : placeholder}
                    title={title}
                    width={24}
                  />
                );
              })}
            <span>
              <span
                className="alink ml-3"
                onClick={() => setShowAllReplies((show) => !show)}>
                {subThreads.length} Replies
              </span>
              {lastReplyTs && (
                <span className="last-reply-stamp ml-2">
                  Last reply {getRelativeTime(lastReplyTs)}
                </span>
              )}
            </span>
          </div>
        ))}
      {showEditor && (
        <MarkdownEditor
          placeholder="Reply..."
          onCancel={onCancel}
          onSave={onSave}
        />
      )}
    </>
  );
};

const ConversationPropTypes = {
  message: PropTypes.string.isRequired,
  timestamp: PropTypes.number.isRequired,
  relativeTime: PropTypes.string.isRequired,
  profileUrl: PropTypes.string,
  title: PropTypes.string.isRequired,
  quickReplies: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string,
    })
  ),
  level: PropTypes.number,
};

ConversationPropTypes.subThreads = PropTypes.arrayOf(
  PropTypes.shape(ConversationPropTypes)
);

Conversation.propTypes = {
  handleReply: PropTypes.func,
  thread: PropTypes.shape(ConversationPropTypes),
  conversationIndex: PropTypes.number,
};

export default Conversation;
