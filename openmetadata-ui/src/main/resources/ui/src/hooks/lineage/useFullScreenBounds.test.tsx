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
import { useFullScreenBounds } from './useFullScreenBounds';

const Probe = ({ isFullScreen }: { isFullScreen: boolean }) => {
  const { ref, bounds } = useFullScreenBounds(isFullScreen);

  return <div data-testid="lineage-root" ref={ref} style={bounds} />;
};

const renderInContentColumn = (isFullScreen: boolean) => {
  const column = document.createElement('div');
  column.className = 'page-layout-v1-center';
  column.getBoundingClientRect = () =>
    ({ top: 22, left: 310, width: 1268, height: 872 } as DOMRect);
  document.body.appendChild(column);

  return render(<Probe isFullScreen={isFullScreen} />, { container: column });
};

describe('useFullScreenBounds', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('pins the full-screen view over the page content column', () => {
    renderInContentColumn(true);

    expect(screen.getByTestId('lineage-root')).toHaveStyle({
      top: '22px',
      left: '310px',
      width: '1268px',
      height: '872px',
    });
  });

  it('leaves the view in flow when not full screen', () => {
    renderInContentColumn(false);

    expect(screen.getByTestId('lineage-root').getAttribute('style')).toBeNull();
  });
});
