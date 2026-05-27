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

import { render } from '@testing-library/react';
import { SearchOutputType } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { EventTriggerFilterSection } from './EventTriggerFilterSection';

const queryBuilderSectionProps: Array<{ outputType?: SearchOutputType }> = [];

jest.mock('./QueryBuilderSection', () => ({
  QueryBuilderSection: (props: { outputType?: SearchOutputType }) => {
    queryBuilderSectionProps.push(props);

    return <div data-testid="mock-query-builder-section" />;
  },
}));

jest.mock('../../../../contexts/WorkflowModeContext', () => ({
  useWorkflowModeContext: jest.fn(() => ({
    isFormDisabled: false,
    mode: 'edit',
    isEditMode: true,
    isViewMode: false,
  })),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: (props: { onPress?: () => void; children?: React.ReactNode }) => (
    <button onClick={props.onPress}>{props.children}</button>
  ),
  Card: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
}));

jest.mock('@untitledui/icons', () => ({
  Plus: () => null,
  XClose: () => null,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('EventTriggerFilterSection', () => {
  beforeEach(() => {
    queryBuilderSectionProps.length = 0;
  });

  it('passes outputType=JSONLogic to QueryBuilderSection', () => {
    render(
      <EventTriggerFilterSection
        triggerFilter='{"==":[{"var":"name"},"mysql_sample"]}'
        onTriggerFilterChange={() => undefined}
      />
    );

    expect(queryBuilderSectionProps).toHaveLength(1);
    expect(queryBuilderSectionProps[0].outputType).toBe(
      SearchOutputType.JSONLogic
    );
  });

  it('does not pass outputType=ElasticSearch — RuleEngine does not accept ES queries and event-based workflows would silently fail', () => {
    render(
      <EventTriggerFilterSection
        triggerFilter='{"==":[{"var":"name"},"x"]}'
        onTriggerFilterChange={() => undefined}
      />
    );

    expect(queryBuilderSectionProps).toHaveLength(1);
    expect(queryBuilderSectionProps[0].outputType).not.toBe(
      SearchOutputType.ElasticSearch
    );
  });
});
