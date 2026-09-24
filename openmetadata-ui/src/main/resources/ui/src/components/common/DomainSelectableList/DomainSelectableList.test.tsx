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
import { fireEvent, render, screen } from '@testing-library/react';
import { EntityReference } from '../../../generated/entity/type';
import DomainSelectableList from './DomainSelectableList.component';

const domainSelectMock = jest.fn();

jest.mock('../DomainSelect/DomainSelect', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    domainSelectMock(props);
    const renderTrigger = props.renderTrigger as
      | ((p: { toggle: () => void }) => React.ReactNode)
      | undefined;

    return (
      <div data-testid="domain-select-mock">
        {renderTrigger?.({ toggle: props.onOpenChange as () => void })}
      </div>
    );
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => ({ isVersionView: false }),
}));

const lastProps = () =>
  domainSelectMock.mock.calls[domainSelectMock.mock.calls.length - 1][0];

const onUpdate = jest.fn().mockResolvedValue(undefined);

describe('DomainSelectableList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should render the default edit trigger when no children are given', () => {
    render(<DomainSelectableList hasPermission onUpdate={onUpdate} />);

    expect(screen.getByTestId('add-domain')).toBeInTheDocument();
  });

  it('should render a custom child trigger when provided', () => {
    render(
      <DomainSelectableList hasPermission onUpdate={onUpdate}>
        <button data-testid="custom-trigger">Edit</button>
      </DomainSelectableList>
    );

    expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('add-domain')).not.toBeInTheDocument();
  });

  it('should forward multiple, selectedDomain and restrictedDomains to DomainSelect', () => {
    const selectedDomain: EntityReference = {
      id: 'd1',
      type: 'domain',
      name: 'Finance',
      fullyQualifiedName: 'Finance',
    };
    render(
      <DomainSelectableList
        hasPermission
        multiple
        restrictedDomains={[selectedDomain]}
        selectedDomain={selectedDomain}
        onUpdate={onUpdate}
      />
    );

    expect(lastProps().multiple).toBe(true);
    expect(lastProps().selectedDomain).toBe(selectedDomain);
    expect(lastProps().restrictedDomains).toEqual([selectedDomain]);
    expect(lastProps().triggerVariant).toBe('button');
  });

  it('should map controlled popover open state onto DomainSelect isOpen', () => {
    render(
      <DomainSelectableList
        hasPermission
        popoverProps={{ open: true }}
        onUpdate={onUpdate}
      />
    );

    expect(lastProps().isOpen).toBe(true);
  });

  it('should call popover onOpenChange and onCancel when the picker closes', () => {
    const onOpenChange = jest.fn();
    const onCancel = jest.fn();
    render(
      <DomainSelectableList
        hasPermission
        popoverProps={{ onOpenChange }}
        onCancel={onCancel}
        onUpdate={onUpdate}
      />
    );

    lastProps().onOpenChange(false);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCancel).toHaveBeenCalled();
  });

  it('should open the picker on pointerdown, not on click', () => {
    // A re-render between mousedown and mouseup replaces the trigger's DOM node,
    // and the browser then never dispatches the click at all — opening on
    // pointerdown is what makes the press survive that race.
    const onOpenChange = jest.fn();
    render(
      <DomainSelectableList
        hasPermission
        popoverProps={{ onOpenChange }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.pointerDown(screen.getByTestId('add-domain'), { button: 0 });

    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('should not toggle again on the click that follows a pointerdown', () => {
    const onOpenChange = jest.fn();
    render(
      <DomainSelectableList
        hasPermission
        popoverProps={{ onOpenChange }}
        onUpdate={onUpdate}
      />
    );

    const trigger = screen.getByTestId('add-domain');
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.click(trigger, { detail: 1 });

    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('should open the picker on a keyboard-synthesized click', () => {
    const onOpenChange = jest.fn();
    render(
      <DomainSelectableList
        hasPermission
        popoverProps={{ onOpenChange }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('add-domain'), { detail: 0 });

    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('should not render a default trigger in version view', () => {
    jest
      .spyOn(
        require('../../Customization/GenericProvider/GenericContext'),
        'useGenericContext'
      )
      .mockReturnValue({ isVersionView: true });

    render(<DomainSelectableList hasPermission onUpdate={onUpdate} />);

    expect(screen.queryByTestId('add-domain')).not.toBeInTheDocument();
  });
});
