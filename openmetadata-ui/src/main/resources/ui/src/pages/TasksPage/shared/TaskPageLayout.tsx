/*
 *  Copyright 2022 Collate.
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

import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import React, { FC, HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Props extends HTMLAttributes<HTMLDivElement> {}

const TaskPageLayout: FC<Props> = ({ children }) => {
  const { t } = useTranslation();

  return (
    <PageContainerV1>
      <PageLayoutV1 center pageTitle={t('label.task')}>
        {children}
      </PageLayoutV1>
    </PageContainerV1>
  );
};

export default TaskPageLayout;
