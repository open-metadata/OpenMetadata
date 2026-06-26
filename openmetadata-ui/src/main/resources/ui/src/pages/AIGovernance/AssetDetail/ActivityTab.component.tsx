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

import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getGovernanceActivity,
  GovernanceActivityEvent,
} from '../../../rest/aiGovernanceAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  Card,
  Empty,
  Skeleton,
  Tag,
  Timeline,
} from '../components/AIGovUntitled.component';
import { AIAssetView } from './AssetDetail.types';

interface ActivityTabProps {
  view: AIAssetView;
}

const EVENT_TONE: Record<string, string> = {
  ShadowAIDetected: 'red',
  SubmittedForReview: 'blue',
  Approved: 'green',
  Rejected: 'red',
  Assessed: 'blue',
  NextReviewScheduled: 'default',
};

const ActivityTab = ({ view }: ActivityTabProps) => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<GovernanceActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await getGovernanceActivity({
          entityType: view.entityType,
          entityId: view.id,
          limit: 50,
        });
        if (!cancelled) {
          setEvents(response.events);
        }
      } catch (error) {
        if (!cancelled) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [view.entityType, view.id]);

  if (loading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (events.length === 0) {
    return (
      <Card>
        <Empty
          description={t('label.no-entity', { entity: t('label.activity') })}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  return (
    <Card>
      <Timeline
        items={events.map((event) => ({
          color: EVENT_TONE[event.type] ?? 'blue',
          children: (
            <div>
              <Tag color={EVENT_TONE[event.type] ?? 'default'}>
                {event.type}
              </Tag>{' '}
              {event.text}
              <div className="tw:text-xs tw:text-gray-500 tw:mt-1">
                {new Date(event.createdAt ?? event.at).toLocaleString()}
                {event.scheduledAt
                  ? ` · ${t('label.scheduled-for', {
                      date: new Date(event.scheduledAt).toLocaleDateString(),
                    })}`
                  : ''}
                {event.who ? ` · ${event.who}` : ''}
              </div>
            </div>
          ),
        }))}
      />
    </Card>
  );
};

export default ActivityTab;
