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
import QueryBuilderButton, {
  createQueryBuilderButtons,
} from './QueryBuilderButton';
import {
  COMPACT_BUTTON_PRESET,
  CONDITION_BUTTON_PRESET,
  EXPLORE_BUTTON_PRESET,
} from './QueryBuilderButton.constants';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../utils/i18next/LocalUtil', () => ({
  t: (key: string) => key,
}));

const renderButton = (
  buttonProps: Record<string, unknown> | undefined,
  preset = CONDITION_BUTTON_PRESET
) =>
  render(
    <QueryBuilderButton
      buttonProps={buttonProps as never}
      preset={preset as never}
    />
  );

describe('QueryBuilderButton', () => {
  it('should render the rule delete affordance', () => {
    const onClick = jest.fn();
    renderButton({ type: 'delRule', onClick });

    const del = screen.getByTestId(CONDITION_BUTTON_PRESET.testIds.delRule);
    fireEvent.click(del);

    expect(onClick).toHaveBeenCalled();
  });

  // A `rule_group` is a structural wrapper, so it removes like a rule.
  it('should render the rule-group delete affordance', () => {
    renderButton({ type: 'delRuleGroup', onClick: jest.fn() });

    expect(
      screen.getByTestId(CONDITION_BUTTON_PRESET.testIds.delRuleGroup)
    ).toBeInTheDocument();
  });

  it('should render the group delete affordance', () => {
    const onClick = jest.fn();
    renderButton({ type: 'delGroup', onClick }, EXPLORE_BUTTON_PRESET);

    fireEvent.click(screen.getByTestId(EXPLORE_BUTTON_PRESET.testIds.delGroup));

    expect(onClick).toHaveBeenCalled();
  });

  it('should render a labelled add-rule button', () => {
    const onClick = jest.fn();
    renderButton({ type: 'addRule', onClick });

    const add = screen.getByTestId(CONDITION_BUTTON_PRESET.testIds.addRule);
    // react-aria buttons fire `onPress` from pointer events, not `click`
    fireEvent.pointerDown(add, { pointerId: 1, button: 0 });
    fireEvent.pointerUp(add, { pointerId: 1, button: 0 });
    fireEvent.click(add);

    expect(onClick).toHaveBeenCalled();
  });

  it('should render the add-group button', () => {
    renderButton(
      { type: 'addGroup', onClick: jest.fn() },
      EXPLORE_BUTTON_PRESET
    );

    expect(
      screen.getByTestId(EXPLORE_BUTTON_PRESET.testIds.addGroup)
    ).toBeInTheDocument();
  });

  // RAQB renders the add button with no handler while a group is read-only.
  it('should not throw when the add button has no handler', () => {
    renderButton({ type: 'addRule' });

    const add = screen.getByTestId(CONDITION_BUTTON_PRESET.testIds.addRule);

    expect(() => {
      fireEvent.pointerDown(add, { pointerId: 1, button: 0 });
      fireEvent.pointerUp(add, { pointerId: 1, button: 0 });
      fireEvent.click(add);
    }).not.toThrow();
  });

  // A preset without its own wording falls back to the shared label rather
  // than rendering an icon with no accessible name.
  it('should fall back to a default label when the preset has none', () => {
    const preset = { ...COMPACT_BUTTON_PRESET, addRuleLabel: undefined };
    renderButton({ type: 'addRule', onClick: jest.fn() }, preset as never);

    expect(
      screen.getByTestId(COMPACT_BUTTON_PRESET.testIds.addRule)
    ).toBeInTheDocument();
  });

  // RAQB omits the handler while a builder is read-only; the affordance still
  // renders, it just does nothing.
  it('should render a delete affordance with no handler', () => {
    renderButton({ type: 'delRule' });

    expect(() =>
      fireEvent.click(
        screen.getByTestId(CONDITION_BUTTON_PRESET.testIds.delRule)
      )
    ).not.toThrow();
  });

  it('should render a group delete with no handler', () => {
    renderButton({ type: 'delGroup' }, EXPLORE_BUTTON_PRESET);

    expect(() =>
      fireEvent.click(
        screen.getByTestId(EXPLORE_BUTTON_PRESET.testIds.delGroup)
      )
    ).not.toThrow();
  });

  it('should render nothing for a button type it does not own', () => {
    const { container } = renderButton({ type: 'somethingElse' });

    expect(container).toBeEmptyDOMElement();
  });

  it('should render nothing when RAQB passes no button props', () => {
    const { container } = renderButton(undefined);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('createQueryBuilderButtons', () => {
  it('should adapt the component to the RAQB callback shape', () => {
    const renderFn = createQueryBuilderButtons(CONDITION_BUTTON_PRESET);
    const { container } = render(
      <>{(renderFn as (p: unknown) => JSX.Element)({ type: 'delRule' })}</>
    );

    expect(container).not.toBeEmptyDOMElement();
  });
});
