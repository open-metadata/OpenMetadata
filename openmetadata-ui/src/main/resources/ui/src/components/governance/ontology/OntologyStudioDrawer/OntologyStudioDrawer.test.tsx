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
import { render, screen } from '@testing-library/react';
import OntologyStudioDrawer from './OntologyStudioDrawer';
import { OntologyStudioDrawerHostContext } from './OntologyStudioDrawer.context';

const WIDTH_CLASSES = ['tw:w-[40vw]', 'tw:min-w-105'];

const renderInShell = (placement?: 'beside' | 'overlay') => {
  const shell = document.createElement('main');
  document.body.appendChild(shell);
  render(
    <OntologyStudioDrawerHostContext.Provider value={shell}>
      <div data-testid="canvas-row">
        <OntologyStudioDrawer placement={placement} testId="drawer">
          content
        </OntologyStudioDrawer>
      </div>
    </OntologyStudioDrawerHostContext.Provider>
  );

  return shell;
};

describe('OntologyStudioDrawer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens full height in the Studio shell and leaves a gap of the same width beside the canvas', () => {
    const shell = renderInShell();
    const drawer = screen.getByTestId('drawer');
    const gap = screen.getByTestId('ontology-studio-drawer-gap');

    expect(shell).toContainElement(drawer);
    expect(screen.getByTestId('canvas-row')).toContainElement(gap);
    expect(drawer).toHaveClass('tw:top-2', 'tw:bottom-2', ...WIDTH_CLASSES);
    expect(gap).toHaveClass(...WIDTH_CLASSES);
  });

  it('covers the area without a gap when it is an overlay', () => {
    renderInShell('overlay');

    expect(screen.getByTestId('drawer')).toHaveClass(...WIDTH_CLASSES);
    expect(
      screen.queryByTestId('ontology-studio-drawer-gap')
    ).not.toBeInTheDocument();
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
});
