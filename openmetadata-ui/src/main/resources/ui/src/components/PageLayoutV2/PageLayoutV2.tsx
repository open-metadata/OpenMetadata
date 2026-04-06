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
import { FC, ReactNode } from 'react';
import DocumentTitle from '../common/DocumentTitle/DocumentTitle';

interface PageLayoutV2Props {
  children: ReactNode;
  pageTitle: string;
  className?: string;
  mainContainerClassName?: string;
}

const PageLayoutV2: FC<PageLayoutV2Props> = ({
  children,
  pageTitle,
  className,
  mainContainerClassName,
}) => {
  return (
    <>
      <DocumentTitle title={pageTitle} />
      <div
        className={classNames('tw:flex tw:h-full tw:flex-col', className)}
        data-testid="page-layout-v2">
        <div
          className={classNames(
            'tw:flex-1 tw:overflow-y-auto',
            mainContainerClassName
          )}>
          {children}
        </div>
      </div>
    </>
  );
};

export default PageLayoutV2;
