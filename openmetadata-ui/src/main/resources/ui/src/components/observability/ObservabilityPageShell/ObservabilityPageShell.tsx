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

import classNames from 'classnames';
import { HTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import DocumentTitle from '../../common/DocumentTitle/DocumentTitle';

interface ObservabilityPageShellProps
  extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  contentClassName?: string;
  header: ReactNode;
  /**
   * Document title. The detail pages using this shell (`TestCaseDetail`,
   * `TestSuiteDetail`) pass a fetched entity name, which is more specific
   * than anything derivable from the URL. Those routes carry `:fqn`, so they
   * are never kept alive and their Helmet mounts after any shell-level title
   * on each navigation and wins.
   */
  pageTitle: string;
}

const ObservabilityPageShell = ({
  children,
  className,
  contentClassName,
  header,
  pageTitle,
  ...props
}: ObservabilityPageShellProps) => (
  <div
    className="tw:isolate tw:h-full tw:min-h-0"
    data-testid="observability-page-shell">
    <div
      {...props}
      className={classNames(
        'tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:p-2',
        className
      )}>
      <DocumentTitle title={pageTitle} />
      <div className="tw:shrink-0" data-testid="observability-page-header">
        {header}
      </div>
      <div
        className={classNames(
          'tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-4',
          contentClassName
        )}
        data-testid="observability-page-content">
        {children}
      </div>
    </div>
  </div>
);

export default ObservabilityPageShell;
