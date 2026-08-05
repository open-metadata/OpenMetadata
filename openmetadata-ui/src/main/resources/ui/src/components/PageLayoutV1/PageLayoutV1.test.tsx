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

const CENTER_CONTENT = 'Center content';
const PAGE_LAYOUT_V1 = 'page-layout-v1';
const CALC_100VH_64PX = 'calc(100vh - 64px)';

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
    const centerText = CENTER_CONTENT;
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
    const centerText = CENTER_CONTENT;
    const { getByText, queryByTestId } = render(
      <PageLayoutV1 pageTitle="Test Page">{centerText}</PageLayoutV1>
    );

    expect(queryByTestId(PAGE_LAYOUT_V1)).toBeInTheDocument();
    expect(getByText(centerText)).toBeInTheDocument();
    expect(queryByTestId('left-panelV1')).not.toBeInTheDocument();
    expect(queryByTestId('right-panelV1')).not.toBeInTheDocument();
  });

  it('Should render without fullHeight wrapper by default', () => {
    const centerText = CENTER_CONTENT;
    const { container } = render(
      <PageLayoutV1 pageTitle="Test Page">{centerText}</PageLayoutV1>
    );

    expect(
      container.querySelector('.page-layout-v1-vertical-scroll')
    ).toBeInTheDocument();
  });

  it('Should render with fullHeight wrapper when fullHeight is true', () => {
    const centerText = CENTER_CONTENT;
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
    const centerText = CENTER_CONTENT;
    const { getByTestId } = render(
      <PageLayoutV1 fullHeight pageTitle="Test Page">
        {centerText}
      </PageLayoutV1>
    );

    const pageLayout = getByTestId(PAGE_LAYOUT_V1);

    expect(pageLayout).toHaveStyle({ height: CALC_100VH_64PX });
    expect(pageLayout).toHaveStyle({ overflow: 'hidden' });
  });

  it('Should not override pageContainerStyle.height when fullHeight is true and height is already provided', () => {
    const centerText = CENTER_CONTENT;
    const customHeight = '500px';
    const { getByTestId } = render(
      <PageLayoutV1
        fullHeight
        pageContainerStyle={{ height: customHeight }}
        pageTitle="Test Page">
        {centerText}
      </PageLayoutV1>
    );

    const pageLayout = getByTestId(PAGE_LAYOUT_V1);

    expect(pageLayout).toHaveStyle({ height: customHeight });
  });

  it('Should not apply fullHeight styles when fullHeight is false', () => {
    const centerText = CENTER_CONTENT;
    const { getByTestId } = render(
      <PageLayoutV1 pageTitle="Test Page">{centerText}</PageLayoutV1>
    );

    const pageLayout = getByTestId(PAGE_LAYOUT_V1);

    expect(pageLayout).not.toHaveStyle({ height: CALC_100VH_64PX });
  });

  it('Should apply the default 20px padding class when no variant is provided', () => {
    const { getByTestId } = render(
      <PageLayoutV1 pageTitle="Test Page">Center content</PageLayoutV1>
    );

    const pageLayout = getByTestId(PAGE_LAYOUT_V1);

    expect(pageLayout).toHaveClass('p-x-box');
    expect(pageLayout).not.toHaveClass('tw:p-2');
    expect(pageLayout).toHaveAttribute('data-variant', 'default');
  });

  it('Should apply the compact 8px padding class when variant is compact', () => {
    const { getByTestId } = render(
      <PageLayoutV1 pageTitle="Test Page" variant="compact">
        Center content
      </PageLayoutV1>
    );

    const pageLayout = getByTestId(PAGE_LAYOUT_V1);

    expect(pageLayout).toHaveClass('tw:p-2');
    expect(pageLayout).not.toHaveClass('p-x-box');
    expect(pageLayout).toHaveAttribute('data-variant', 'compact');
  });

  it('Should merge custom pageContainerStyle with fullHeight styles', () => {
    const centerText = CENTER_CONTENT;
    const { getByTestId } = render(
      <PageLayoutV1
        fullHeight
        pageContainerStyle={{ backgroundColor: 'red' }}
        pageTitle="Test Page">
        {centerText}
      </PageLayoutV1>
    );

    const pageLayout = getByTestId(PAGE_LAYOUT_V1);

    expect(pageLayout).toHaveStyle({
      height: CALC_100VH_64PX,
      overflow: 'hidden',
      backgroundColor: 'red',
    });
  });
});
