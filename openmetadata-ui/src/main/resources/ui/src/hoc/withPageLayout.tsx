/*
 *  Copyright 2025 Collate.
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
import { ComponentType, FC } from 'react';
import PageLayoutV1 from '../components/PageLayoutV1/PageLayoutV1';

export const withPageLayout = <P extends { pageTitle: string }>(
  Component: ComponentType<P>
) => {
  const WrappedComponent: FC<Exclude<P, 'pageTitle'>> = (props) => {
    return (
      <PageLayoutV1 pageTitle={props.pageTitle}>
        <Component {...props} />
      </PageLayoutV1>
    );
  };

  return WrappedComponent;
};
