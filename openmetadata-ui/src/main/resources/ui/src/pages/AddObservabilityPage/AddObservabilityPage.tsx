/*
 *  Copyright 2024 Collate.
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

import { Card } from 'antd';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import { withPageLayout } from '../../hoc/withPageLayout';
import { AddObservabilityPageProps } from './AddObservabilityPage.interface';
import ObservabilityAlertForm from './components/ObservabilityAlertForm';
import { useObservabilityAlertForm } from './hooks/useObservabilityAlertForm';

function AddObservabilityPage(_props: Readonly<AddObservabilityPageProps>) {
  const { t } = useTranslation();
  const formState = useObservabilityAlertForm();
  const { alert, isEditMode, isLoading } = formState;

  if (isLoading || (isEditMode && isEmpty(alert))) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      hideSecondPanel
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container ',
        allowScroll: true,
        children: (
          <Card className="steps-form-container">
            <ObservabilityAlertForm {...formState} />
          </Card>
        ),
        minWidth: 700,
        flex: 0.7,
        wrapInCard: false,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.observability'),
      })}
      secondPanel={{
        children: <></>,
        minWidth: 0,
        className: 'content-resizable-panel-container',
      }}
    />
  );
}

export default withPageLayout(AddObservabilityPage);
