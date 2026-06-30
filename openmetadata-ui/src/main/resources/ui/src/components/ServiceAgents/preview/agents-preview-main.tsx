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

import { ToastProvider } from '@openmetadata/ui-core-components';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import '../../../styles/index';
import i18n from '../../../utils/i18next/LocalUtil';
import AgentsPage from '../AgentsPage.component';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <I18nextProvider i18n={i18n}>
      <div style={{ display: 'flex', height: '100vh' }}>
        <AgentsPage />
      </div>
      <ToastProvider />
    </I18nextProvider>
  );
}
