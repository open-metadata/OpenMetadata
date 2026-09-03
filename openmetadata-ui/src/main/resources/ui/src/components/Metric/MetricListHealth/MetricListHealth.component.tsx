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
import { Box, Button } from '@openmetadata/ui-core-components';
import { RefreshCw01 } from '@untitledui/icons';
import { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Health } from '../../../generated/api/data/metricObservability';
import { useMetricObservability } from '../../../hooks/useMetricObservability';
import MetricHealthPill from '../MetricObservability/MetricHealthPill.component';

export interface MetricListHealthProps {
  metricId: string;
}

const MetricListHealth: FC<MetricListHealthProps> = ({ metricId }) => {
  const { t } = useTranslation();
  const healthSlotRef = useRef<HTMLSpanElement>(null);
  const [shouldLoad, setShouldLoad] = useState(
    () =>
      typeof window === 'undefined' ||
      typeof window.IntersectionObserver === 'undefined'
  );
  const { observability, error, isPending, refetch } = useMetricObservability(
    metricId,
    { enabled: shouldLoad }
  );

  useEffect(() => {
    if (shouldLoad) {
      return;
    }

    const healthSlot = healthSlotRef.current;
    if (!healthSlot || typeof window.IntersectionObserver === 'undefined') {
      setShouldLoad(true);

      return;
    }

    let observer: IntersectionObserver;

    try {
      observer = new window.IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setShouldLoad(true);
            observer.disconnect();
          }
        },
        { rootMargin: '200px 0px' }
      );
      observer.observe(healthSlot);
    } catch {
      setShouldLoad(true);

      return;
    }

    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <span
      aria-busy={!shouldLoad || isPending}
      aria-label={t('label.health')}
      data-testid={`metric-health-slot-${metricId}`}
      ref={healthSlotRef}
      role="group">
      {error ? (
        <Box align="center" gap={2}>
          <MetricHealthPill health={Health.Unknown} />
          <Button
            aria-label={t('label.try-again')}
            color="link-gray"
            data-testid={`retry-metric-health-${metricId}`}
            iconLeading={RefreshCw01}
            onPress={() => refetch()}
          />
        </Box>
      ) : (
        <MetricHealthPill
          health={observability?.health ?? Health.Unknown}
          isLoading={!shouldLoad || isPending}
          score={observability?.score}
        />
      )}
    </span>
  );
};

export default MetricListHealth;
