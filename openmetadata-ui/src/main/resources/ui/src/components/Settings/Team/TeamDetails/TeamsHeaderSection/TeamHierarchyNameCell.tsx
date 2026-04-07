import { useLayoutEffect, useCallback, useRef, useState, FC } from 'react';
import {
  getEntityName,
  highlightSearchText,
} from '../../../../../utils/EntityUtils';
import { Link } from 'react-router-dom';
import { getTeamsWithFqnPath } from '../../../../../utils/RouterUtils';
import { stringToHTML } from '../../../../../utils/StringsUtils';
import { Tooltip } from 'antd';
import { Team } from '../../../../../generated/entity/teams/team';

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
