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
import { fireEvent, render, screen } from '@testing-library/react';
import { ServiceCategory } from '../../../../../enums/service.enum';
import { PipelineType } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { FailingService } from '../../PlatformHealthWidget/useIngestionPipelineStats';
import FailingServiceRow from './FailingServiceRow';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('../../../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: { getServiceLogo: () => 'logo.svg' },
}));

jest.mock('../../../../../utils/date-time/DateTimeUtils', () => ({
  getRelativeTime: () => '2 hours ago',
}));

const SERVICE: FailingService = {
  displayName: 'Snowflake Prod',
  fqn: 'snowflake_prod',
  id: 'svc-1',
  lastRunTs: 1000,
  name: 'snowflake_prod',
  pipelineType: PipelineType.AutoClassification,
  reason: '',
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  serviceType: 'Snowflake',
  state: 'failed',
};

const renderRow = (service: Partial<FailingService> = {}) => {
  const onOpen = jest.fn();
  render(
    <ul>
      <FailingServiceRow service={{ ...SERVICE, ...service }} onOpen={onOpen} />
    </ul>
  );

  return onOpen;
};

describe('FailingServiceRow', () => {
  // The badge used to print the raw enum ("autoClassification").
  it('labels the pipeline type with a translated name, not the enum value', () => {
    renderRow();

    expect(screen.getByText('label.auto-classification')).toBeInTheDocument();
    expect(screen.queryByText('autoClassification')).toBeNull();
  });

  it('falls back to the ingestion label for a type with no label of its own', () => {
    renderRow({ pipelineType: PipelineType.ElasticSearchReindex });

    expect(screen.getByText('label.ingestion')).toBeInTheDocument();
  });

  it('shows the run error when the server gave a usable one', () => {
    renderRow({ reason: 'Authentication failed' });

    expect(screen.getByText('Authentication failed')).toBeInTheDocument();
  });

  it('builds the fallback reason from one translated sentence', () => {
    renderRow({ pipelineType: PipelineType.Metadata });

    expect(
      screen.getByText(
        'message.pipeline-type-pipeline-failed {"pipelineType":"label.metadata"}'
      )
    ).toBeInTheDocument();
  });

  it('words a partially failed run as such', () => {
    renderRow({ state: 'partialSuccess' });

    expect(
      screen.getByText(
        'message.pipeline-type-pipeline-partially-failed {"pipelineType":"label.auto-classification"}'
      )
    ).toBeInTheDocument();
  });

  it('opens the service on click', () => {
    const onOpen = renderRow();

    fireEvent.click(screen.getByTestId('failing-service-svc-1'));

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'svc-1' })
    );
  });
});
