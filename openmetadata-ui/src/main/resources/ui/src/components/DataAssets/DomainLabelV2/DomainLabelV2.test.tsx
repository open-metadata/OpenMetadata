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
import { EntityReference } from '../../../generated/entity/type';
import { DomainLabelV2 } from './DomainLabelV2';

const mockDomains: EntityReference[] = [
  {
    id: 'dom-1',
    type: 'domain',
    name: 'source',
    fullyQualifiedName: 'source',
  },
];

const mockContext: {
  data: {
    id: string;
    fullyQualifiedName: string;
    deleted: boolean;
    domains: EntityReference[];
  };
  type: string;
  permissions: { EditAll: boolean };
} = {
  data: {
    id: 'entity-1',
    fullyQualifiedName: 'entity_one',
    deleted: false,
    domains: mockDomains,
  },
  type: 'dataProduct',
  permissions: { EditAll: true },
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => mockContext,
}));

jest.mock('../../common/WidgetCard/WidgetCard', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => (
    <div data-testid="widget-title">{title}</div>
  ),
}));

jest.mock(
  '../../common/DomainSelectableList/DomainSelectableList.component',
  () =>
    jest.fn().mockImplementation(() => <div data-testid="selectable-list" />)
);

const mockToggle = jest.fn();

jest.mock('../../common/DomainSelect/DomainSelect', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const renderTrigger = props.renderTrigger as (p: {
      toggle: () => void;
    }) => React.ReactNode;

    return (
      <div data-testid="domain-select-mock">
        {renderTrigger({ toggle: mockToggle })}
      </div>
    );
  },
}));

jest.mock('../../../utils/DomainUtils', () => ({
  renderDomainLink: jest.fn().mockReturnValue(<span>domain-link</span>),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'label.domain': 'Domain',
        'label.domain-plural': 'Domains',
      };

      return translations[key] ?? key;
    },
  }),
}));

describe('DomainLabelV2 heading label', () => {
  it('renders singular "Domain" heading when multiple is false', () => {
    render(<DomainLabelV2 showDomainHeading multiple={false} />);

    expect(screen.getByTestId('widget-title')).toHaveTextContent('Domain');
    expect(screen.getByTestId('widget-title')).not.toHaveTextContent('Domains');
  });

  it('renders plural "Domains" heading when multiple is true', () => {
    render(<DomainLabelV2 multiple showDomainHeading />);

    expect(screen.getByTestId('widget-title')).toHaveTextContent('Domains');
  });

  it('defaults to singular "Domain" heading when multiple is not passed', () => {
    render(<DomainLabelV2 showDomainHeading />);

    expect(screen.getByTestId('widget-title')).toHaveTextContent('Domain');
  });
});

describe('DomainLabelV2 picker trigger', () => {
  beforeEach(() => jest.clearAllMocks());

  // The widget re-renders while a PATCH settles; a re-render that replaces the
  // trigger's DOM node between mousedown and mouseup makes the browser drop the
  // click outright, so the press must land on pointerdown instead.
  it('opens the picker on pointerdown', () => {
    render(<DomainLabelV2 />);

    fireEvent.pointerDown(screen.getByTestId('edit-domain'), { button: 0 });

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('does not toggle again on the click that follows a pointerdown', () => {
    render(<DomainLabelV2 />);

    const trigger = screen.getByTestId('edit-domain');
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.click(trigger, { detail: 1 });

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('opens the picker on a click with no pointerdown (screen reader, programmatic)', () => {
    render(<DomainLabelV2 />);

    fireEvent.click(screen.getByTestId('edit-domain'), { detail: 0 });

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('opens the picker on Enter', () => {
    render(<DomainLabelV2 />);

    fireEvent.keyDown(screen.getByTestId('edit-domain'), { key: 'Enter' });

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
