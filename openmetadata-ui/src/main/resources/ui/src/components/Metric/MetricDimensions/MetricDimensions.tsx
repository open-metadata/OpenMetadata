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
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Metric, MetricDimension } from '../../../generated/entity/data/metric';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import MetricSemanticList from '../MetricSemanticList/MetricSemanticList';

const MetricDimensions: FC = () => {
  const { t } = useTranslation();
  const { data: metricDetails } = useGenericContext<Metric>();

  return (
    <MetricSemanticList<MetricDimension>
      dataTestId="metric-dimensions-widget"
      entityLabel={t('label.dimension')}
      entityLabelLowercase={t('label.dimension-lowercase')}
      fieldKey="dimensions"
      getBadge={(item) => item.type}
      items={metricDetails.dimensions ?? []}
      title={t('label.dimension-plural')}
    />
  );
};

export default MetricDimensions;
