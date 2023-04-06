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

import Loader from 'components/Loader/Loader';
import { Status } from 'generated/system/eventPublisherJob';
import { t } from 'i18next';
import React from 'react';
import { ReactComponent as IconFailBadge } from '../assets/svg/fail-badge.svg';
import { ReactComponent as IconTaskOpen } from '../assets/svg/in-progress.svg';
import { ReactComponent as IconSuccessBadge } from '../assets/svg/success-badge.svg';

export const getStatusResultBadgeIcon = (status?: string) => {
  switch (status) {
    case Status.Completed:
      return <IconSuccessBadge height={14} width={14} />;

    case Status.Failed:
    case Status.ActiveWithError:
      return <IconFailBadge height={14} width={14} />;

    case Status.Running:
    case Status.Started:
      return <Loader size="x-small" />;

    case Status.Active:
    default:
      return <IconTaskOpen height={14} width={14} />;
  }
};

export const getEventPublisherStatusText = (status?: string) => {
  switch (status) {
    case Status.Failed:
      return t('label.failed');
    case Status.Running:
      return t('label.running');
    case Status.Completed:
      return t('label.completed');
    case Status.Active:
      return t('label.active');

    case Status.ActiveWithError:
      return t('label.active-with-error');

    case Status.Started:
      return t('label.started');

    default:
      return status || '';
  }
};
