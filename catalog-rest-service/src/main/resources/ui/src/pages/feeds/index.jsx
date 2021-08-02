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

import React, { useEffect, useState } from 'react';
import { getAllFeeds } from '../../axiosAPIs/feedsAPI';
import { getAllTables } from '../../axiosAPIs/tableAPI';
import { getTeams, getUserById } from '../../axiosAPIs/userAPI';
import PageContainer from '../../components/containers/PageContainer';
import Conversation from '../../components/feeds/Conversation';
import FeedsLeftPanel from '../../components/feeds/FeedsLeftPanel';
import Loader from '../../components/Loader/Loader';
import {
  formatFeedDataResponse,
  getEntityByTypeAndId,
} from '../../utils/APIUtils';

const viewCap = 5;

const FeedsPage = () => {
  const [feeds, setFeeds] = useState([]);
  const [tablesData, setTablesData] = useState([]);
  const [teamsData, setTeamsData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllFeeds = () => {
    setIsLoading(true);
    getAllFeeds()
      .then((res) => {
        let feeds = [];
        const feedData = formatFeedDataResponse(res.data.data);
        feedData.forEach((feed) => {
          const newFeed = feed;
          getEntityByTypeAndId(feed.toEntity, feed.entity).then((res) => {
            newFeed.toEntity = res.data.name;
            getUserById(feed.title).then((res) => {
              const { displayName, profile } = res.data;
              newFeed.title = displayName;
              newFeed.profileUrl = profile?.images?.image24;
              let subthreadCount = 0;
              let subThreads = [];
              if (feed.subThreads.length) {
                feed.subThreads.forEach((subThread) => {
                  const newThread = subThread;
                  getUserById(subThread.title).then((res) => {
                    const { displayName, profile } = res.data;
                    subthreadCount++;
                    newThread.title = displayName;
                    newThread.profileUrl = profile?.images?.image24;
                    subThreads = [...subThreads, newThread];
                    if (subthreadCount === feed.subThreads.length) {
                      newFeed.subThreads = subThreads;
                      feeds = [...feeds, newFeed];
                      setFeeds(feeds);
                    }
                  });
                });
              } else {
                newFeed.subThreads = [];
                feeds = [...feeds, newFeed];
                setFeeds(feeds);
              }
            });
          });
        });
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchAllFeeds();

    getAllTables().then((res) => {
      setTablesData(res.data.data);
    });

    getTeams().then((res) => {
      setTeamsData(res.data.data);
    });
  }, []);

  const onReply = () => {
    fetchAllFeeds();
  };

  const fetchLeftPanelContent = () => {
    return (
      <FeedsLeftPanel tables={tablesData} teams={teamsData} viewCap={viewCap} />
    );
  };

  return (
    <>
      {!isLoading ? (
        <PageContainer
          className="py-0"
          leftPanelContent={fetchLeftPanelContent()}>
          <div className="container-fluid">
            <div className="row min-h-100">
              <div className="col-sm-8 py-3">
                {/* <Timebar title="Today" /> */}
                {feeds.map((feed, index) => (
                  <Conversation
                    conversationIndex={index}
                    handleReply={onReply}
                    key={feed.title + index}
                    thread={{ ...feed }}
                  />
                ))}
              </div>
              <div className="col-sm-4 py-3">
                <h6>Announcements</h6>
                <div className="announcement-holder mb-2">
                  <div className="announcement-row">
                    <a className="link-text" href="/">
                      Upcoming fact_order schema changes.
                    </a>
                  </div>
                  <div className="announcement-row">
                    <a className="link-text" href="/">
                      dim_address SLA changes
                    </a>
                  </div>
                  <div className="announcement-row">
                    <a className="link-text" href="/">
                      Tier-1/Tier-2 dataset quality requirements
                    </a>
                  </div>
                  <div className="announcement-row">
                    <a className="link-text" href="/">
                      Level 5 incident involving Tier-1 dataset fact_products is
                      resolved. Please see the postmortem here.
                    </a>
                  </div>
                </div>
                <div className="explore-task-link mb-2">
                  <div>
                    <a className="link-text" href="/">
                      Explore more <i className="fas fa-long-arrow-alt-right" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      ) : (
        <Loader />
      )}
    </>
  );
};

export default FeedsPage;
