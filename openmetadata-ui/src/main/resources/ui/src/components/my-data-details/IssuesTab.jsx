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

import PropTypes, { arrayOf } from 'prop-types';
import React, { useEffect, useState } from 'react';

const IssuesTab = ({ issues }) => {
  const [issueList, setIssueList] = useState([]);
  const openIssues = issues.filter((issue) => {
    return issue.issueStatus === 'Open';
  });
  const closedIssues = issues.filter((issue) => {
    return issue.issueStatus === 'Closed';
  });

  useEffect(() => {
    const visibleIssues = issues.filter((issue) => {
      return issue.issueStatus === 'Open';
    });
    setIssueList(visibleIssues);
  }, [issues]);

  const setVisibleIssues = (e) => {
    const isOpenIssues = e.target.id === 'open';
    setIssueList(isOpenIssues ? openIssues : closedIssues);
  };

  return (
    <div>
      <div className="d-flex flex-auto issue-header">
        <button
          className="btn btn-sm btn-link"
          data-testid="open-button"
          id="open"
          onClick={setVisibleIssues}>
          <i className="fas fa-exclamation-circle" /> {openIssues.length} Open
        </button>
        <button
          className="btn btn-sm btn-link"
          data-testid="closed-button"
          id="closed"
          onClick={setVisibleIssues}>
          <i className="fas fa-check-circle ml-3" /> {closedIssues.length}{' '}
          Closed
        </button>
      </div>
      {issueList.map((issue, index) => {
        return (
          <div
            className="d-flex issue-list"
            data-testid="issue-row"
            key={index}>
            <div className="d-flex flex-shrink-0 align-items-center">
              {issue.issueStatus === 'Open' ? (
                <i className="fas fa-exclamation-circle" data-testid="icon" />
              ) : (
                <i className="fas fa-check-circle" data-testid="icon" />
              )}
            </div>
            <div className="ml-3">
              <h6 className="issue-title" data-testid="issue-title">
                {issue.issueTitle}
              </h6>
              <div className="mt-1" data-testid="issue-details">
                #{issue.issueNumber} opened {issue.issueOpenedOn} by{' '}
                {issue.issueOpenedBy}
              </div>
            </div>
            <div className="d-flex flex-shrink-0 ml-5 align-items-center">
              {issue.issueTags.map((tag, index) => {
                return (
                  <span
                    className="issue-label"
                    data-testid="issue-tag"
                    key={index}>
                    {tag}
                  </span>
                );
              })}
            </div>
            <div className="d-flex flex-shrink-0 col-2 ml-auto align-items-center">
              <div className="flex-shrink-0">
                {issue.contributors.map((contributor, index) => {
                  return (
                    <img
                      alt={contributor.name}
                      className="m-1"
                      data-testid="contributor"
                      height="24"
                      key={index}
                      src={contributor.avatar}
                      width="24"
                    />
                  );
                })}
              </div>
              <div className="ml-5 flex-shrink-0">
                {issue.commentCount !== 0 && (
                  <>
                    <i className="far fa-comment-alt" />{' '}
                    <span data-testid="commentCount">{issue.commentCount}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

IssuesTab.propTypes = {
  issues: arrayOf(
    PropTypes.shape({
      issueStatus: PropTypes.string,
      issueTitle: PropTypes.string,
      issueTags: arrayOf(PropTypes.string),
      issueNumber: PropTypes.number,
      issueOpenedOn: PropTypes.string,
      issueOpenedBy: PropTypes.string,
      contributors: arrayOf(
        PropTypes.shape({
          avatar: PropTypes.string,
          name: PropTypes.string,
        })
      ),
      commentCount: PropTypes.number,
    })
  ),
};

export default IssuesTab;
