/*
 *  Copyright 2023 Collate.
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
import PageLayoutV1 from './PageLayoutV1';

jest.mock('../common/DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation(() => <div>DocumentTitle</div>)
);

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({
    pathname: '/',
  }),
}));

describe('PageLayoutV1', () => {
  it('Should render with the left panel, center content, and right panel', () => {
    const leftPanelText = 'Left panel';
    const centerText = 'Center content';
    const rightPanelText = 'Right panel';
    const { getByText } = render(
      <PageLayoutV1
        center
        leftPanel={<div>{leftPanelText}</div>}
        pageTitle="Test Page"
        rightPanel={<div>{rightPanelText}</div>}>
        {centerText}
      </PageLayoutV1>
    );

    expect(getByText(leftPanelText)).toBeInTheDocument();
    expect(getByText(centerText)).toBeInTheDocument();
    expect(getByText(rightPanelText)).toBeInTheDocument();
  });

  it('Should render with only the center content', () => {
    const centerText = 'Center content';
    const { getByText, queryByTestId } = render(
      <PageLayoutV1 pageTitle="Test Page">{centerText}</PageLayoutV1>
    );

    expect(queryByTestId('page-layout-v1')).toBeInTheDocument();
    expect(getByText(centerText)).toBeInTheDocument();
    expect(queryByTestId('left-panelV1')).not.toBeInTheDocument();
    expect(queryByTestId('right-panelV1')).not.toBeInTheDocument();
  });

  it('Should render without fullHeight wrapper by default', () => {
    const centerText = 'Center content';
    const { container } = render(
      <PageLayoutV1 pageTitle="Test Page">{centerText}</PageLayoutV1>
    );

    expect(
      container.querySelector('.page-layout-v1-vertical-scroll')
    ).toBeInTheDocument();
  });

  it('Should render with fullHeight wrapper when fullHeight is true', () => {
    const centerText = 'Center content';
    const { container } = render(
      <PageLayoutV1
        fullHeight
        mainContainerClassName="test-full-height"
        pageTitle="Test Page">
        {centerText}
      </PageLayoutV1>
    );

    expect(container.querySelector('.test-full-height')).toBeInTheDocument();
    expect(
      container.querySelector('.page-layout-v1-vertical-scroll')
    ).toBeInTheDocument();
  });

  it('Should apply default height when fullHeight is true and no pageContainerStyle.height is provided', () => {
    const centerText = 'Center content';
    const { getByTestId } = render(
      <PageLayoutV1 fullHeight pageTitle="Test Page">
        {centerText}
      </PageLayoutV1>
    );

    const pageLayout = getByTestId('page-layout-v1');

    expect(pageLayout).toHaveStyle({ height: 'calc(100vh - 64px)' });
    expect(pageLayout).toHaveStyle({ overflow: 'hidden' });
  });

  it('Should not override pageContainerStyle.height when fullHeight is true and height is already provided', () => {
    const centerText = 'Center content';
    const customHeight = '500px';
    const { getByTestId } = render(
      <PageLayoutV1
        fullHeight
        pageContainerStyle={{ height: customHeight }}
        pageTitle="Test Page">
        {centerText}
      </PageLayoutV1>
    );

    const pageLayout = getByTestId('page-layout-v1');

    expect(pageLayout).toHaveStyle({ height: customHeight });
  });

  it('Should not apply fullHeight styles when fullHeight is false', () => {
    const centerText = 'Center content';
    const { getByTestId } = render(
      <PageLayoutV1 pageTitle="Test Page">{centerText}</PageLayoutV1>
    );

    const pageLayout = getByTestId('page-layout-v1');

    expect(pageLayout).not.toHaveStyle({ height: 'calc(100vh - 64px)' });
  });

  it('Should merge custom pageContainerStyle with fullHeight styles', () => {
    const centerText = 'Center content';
    const { getByTestId } = render(
      <PageLayoutV1
        fullHeight
        pageContainerStyle={{ backgroundColor: 'red' }}
        pageTitle="Test Page">
        {centerText}
      </PageLayoutV1>
    );

    const pageLayout = getByTestId('page-layout-v1');

    expect(pageLayout).toHaveStyle({
      height: 'calc(100vh - 64px)',
      overflow: 'hidden',
      backgroundColor: 'red',
    });
  });
});
