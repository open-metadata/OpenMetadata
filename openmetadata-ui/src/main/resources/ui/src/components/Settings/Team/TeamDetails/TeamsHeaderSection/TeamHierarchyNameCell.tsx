/*
 *  Copyright 2026 Collate.
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
import { Tooltip } from 'antd';
import { FC, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Team } from '../../../../../generated/entity/teams/team';
import {
  getEntityName,
  highlightSearchText,
} from '../../../../../utils/EntityUtils';
import { getTeamsWithFqnPath } from '../../../../../utils/RouterUtils';
import { stringToHTML } from '../../../../../utils/StringsUtils';

type TeamHierarchyNameCellProps = {
  record: Team;
  searchTerm?: string;
};

export const TeamHierarchyNameCell: FC<TeamHierarchyNameCellProps> = ({
  record,
  searchTerm = '',
}) => {
  const displayName = getEntityName(record);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const updateTruncation = useCallback(() => {
    const el = linkRef.current;
    if (!el) {
      return;
    }
    setIsTruncated(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    updateTruncation();
  }, [displayName, searchTerm, updateTruncation]);

  useLayoutEffect(() => {
    const el = linkRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      updateTruncation();
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [updateTruncation]);

  const link = (
    <Link
      className="link-hover teams-hierarchy-team-name-link"
      data-testid={`team-name-${record.name}`}
      ref={linkRef}
      to={getTeamsWithFqnPath(record.fullyQualifiedName || record.name)}>
      {stringToHTML(highlightSearchText(displayName, searchTerm))}
    </Link>
  );

  return (
    <span className="teams-hierarchy-team-name-cell">
      {isTruncated ? (
        <Tooltip placement="topLeft" title={displayName}>
          <span className="teams-hierarchy-team-name-tooltip-trigger">
            {link}
          </span>
        </Tooltip>
      ) : (
        <span className="teams-hierarchy-team-name-tooltip-trigger">
          {link}
        </span>
      )}
    </span>
  );
};
