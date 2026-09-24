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
import { Badge, Tooltip } from '@openmetadata/ui-core-components';
import { Link } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { TermReference } from '../../../generated/entity/data/glossaryTerm';
import { VersionStatus } from '../../../utils/EntityVersionUtils.interface';

// `data-diff` marks version-view additions/removals for tests; the legacy
// `.diff-added` class is not used because its global styles override Badge's.
const getVersionBadgeProps = (versionStatus?: VersionStatus) => {
  if (versionStatus?.added) {
    return { color: 'success' as const, className: undefined, diff: 'added' };
  }
  if (versionStatus?.removed) {
    return {
      color: 'error' as const,
      className: 'tw:line-through',
      diff: 'removed',
    };
  }

  return { color: 'gray' as const, className: undefined, diff: undefined };
};

export const SynonymBadge = ({
  synonym,
  versionStatus,
}: {
  synonym: string;
  versionStatus?: VersionStatus;
}) => {
  const { color, className, diff } = getVersionBadgeProps(versionStatus);

  return (
    <Badge
      className={classNames('tw:max-w-50', className)}
      color={color}
      data-diff={diff}
      data-testid={synonym}
      size="sm"
      title={synonym}
      type="color">
      <span className="tw:truncate">{synonym}</span>
    </Badge>
  );
};

export const ReferenceBadge = ({
  reference,
  versionStatus,
}: {
  reference: TermReference;
  versionStatus?: VersionStatus;
}) => {
  const { color, className, diff } = getVersionBadgeProps(versionStatus);

  return (
    <Tooltip placement="bottom left" title={reference.name}>
      <a
        className="tw:no-underline"
        data-diff={diff}
        data-testid={`reference-link-${reference.name}`}
        href={reference.endpoint}
        rel="noopener noreferrer"
        target="_blank">
        <Badge
          className={classNames('tw:max-w-50 tw:gap-1', className)}
          color={color}
          size="sm"
          type="color">
          <Link
            className="tw:size-3.5 tw:shrink-0"
            data-testid="external-link-icon"
          />
          <span className="tw:truncate">{reference.name}</span>
        </Badge>
      </a>
    </Tooltip>
  );
};
