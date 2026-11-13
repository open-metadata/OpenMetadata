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
import OntologyStudioDrawer from './OntologyStudioDrawer';
import { OntologyStudioDrawerHostContext } from './OntologyStudioDrawer.context';

const WIDTH_CLASSES = ['tw:w-[40vw]', 'tw:min-w-105'];

const renderInShell = () => {
  const shell = document.createElement('main');
  document.body.appendChild(shell);
  render(
    <OntologyStudioDrawerHostContext.Provider value={shell}>
      <div data-testid="canvas-row">
        <OntologyStudioDrawer testId="drawer">content</OntologyStudioDrawer>
      </div>
    </OntologyStudioDrawerHostContext.Provider>
  );

  return shell;
};

describe('OntologyStudioDrawer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens edge to edge over the canvas without pushing it aside', () => {
    const shell = renderInShell();
    const drawer = screen.getByTestId('drawer');

    expect(shell).toContainElement(drawer);
    expect(screen.getByTestId('canvas-row')).not.toContainElement(drawer);
    expect(drawer).toHaveClass(
      'tw:fixed',
      'tw:inset-y-0',
      'tw:right-0',
      ...WIDTH_CLASSES
    );
    expect(screen.getByTestId('canvas-row')).toBeEmptyDOMElement();
  });

  it('marks itself so the canvas toolbar can stay clear of it', () => {
    renderInShell();

    expect(screen.getByTestId('drawer')).toHaveAttribute('data-studio-drawer');
  });

  it('sits in the flow outside the Studio shell', () => {
    render(
      <div data-testid="canvas-row">
        <OntologyStudioDrawer testId="drawer">content</OntologyStudioDrawer>
      </div>
    );

    expect(screen.getByTestId('canvas-row')).toContainElement(
      screen.getByTestId('drawer')
    );
  });

  it('closes on a press outside it, but not on one inside it or its own overlays', () => {
    const onInteractOutside = jest.fn();
    const shell = document.createElement('main');
    document.body.appendChild(shell);
    render(
      <>
        <button data-testid="outside-tab" type="button">
          Tree
        </button>
        <div role="listbox">
          <span data-testid="owned-option">Option</span>
        </div>
        <OntologyStudioDrawerHostContext.Provider value={shell}>
          <OntologyStudioDrawer
            testId="drawer"
            onInteractOutside={onInteractOutside}>
            <span data-testid="inside">content</span>
          </OntologyStudioDrawer>
        </OntologyStudioDrawerHostContext.Provider>
      </>
    );

    fireEvent.pointerDown(screen.getByTestId('inside'));
    fireEvent.pointerDown(screen.getByTestId('owned-option'));

    expect(onInteractOutside).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByTestId('outside-tab'));

    expect(onInteractOutside).toHaveBeenCalledTimes(1);
  });
});
