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
import {
  ENTITY_TABS_FILL_COLUMN_CLASS,
  ENTITY_TABS_FILL_GRID_CLASS,
} from './PageLayoutV1.constants';

const splitClasses = (classes: string) => classes.split(' ');

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

  it('Should apply the base and full-height classes when fullHeight is true', () => {
    const centerText = 'Center content';
    const { getByTestId } = render(
      <PageLayoutV1 fullHeight pageTitle="Test Page">
        {centerText}
      </PageLayoutV1>
    );

    const pageLayout = getByTestId('page-layout-v1');

    expect(pageLayout).toHaveClass('page-layout-v1');
    expect(pageLayout).toHaveClass('page-layout-v1-full-height');
  });

  it('Should not apply the full-height class when fullHeight is false', () => {
    const centerText = 'Center content';
    const { getByTestId } = render(
      <PageLayoutV1 pageTitle="Test Page">{centerText}</PageLayoutV1>
    );

    const pageLayout = getByTestId('page-layout-v1');

    expect(pageLayout).toHaveClass('page-layout-v1');
    expect(pageLayout).not.toHaveClass('page-layout-v1-full-height');
  });

  it('Should apply the default 16px horizontal padding class when no variant is provided', () => {
    const { getByTestId } = render(
      <PageLayoutV1 pageTitle="Test Page">Center content</PageLayoutV1>
    );

    const pageLayout = getByTestId('page-layout-v1');

    expect(pageLayout).toHaveClass('tw:px-4');
    expect(pageLayout).not.toHaveClass('tw:p-2');
    expect(pageLayout).toHaveAttribute('data-variant', 'default');
  });

  it('Should apply the compact 8px padding class when variant is compact', () => {
    const { getByTestId } = render(
      <PageLayoutV1 pageTitle="Test Page" variant="compact">
        Center content
      </PageLayoutV1>
    );

    const pageLayout = getByTestId('page-layout-v1');

    expect(pageLayout).toHaveClass('tw:p-2');
    expect(pageLayout).not.toHaveClass('tw:px-4');
    expect(pageLayout).toHaveAttribute('data-variant', 'compact');
  });

  it('Should append the consumer className after the base classes', () => {
    const centerText = 'Center content';
    const { getByTestId } = render(
      <PageLayoutV1 fullHeight className="tw:!h-auto" pageTitle="Test Page">
        {centerText}
      </PageLayoutV1>
    );

    const pageLayout = getByTestId('page-layout-v1');

    expect(pageLayout).toHaveClass('page-layout-v1');
    expect(pageLayout).toHaveClass('page-layout-v1-full-height');
    expect(pageLayout).toHaveClass('tw:!h-auto');
  });

  it('Should not apply the entity tabs fill classes by default', () => {
    const { getByTestId } = render(
      <PageLayoutV1 pageTitle="Test Page">Center content</PageLayoutV1>
    );

    const appliedFillClasses = (element: HTMLElement, classes: string) =>
      splitClasses(classes).filter((name) => element.classList.contains(name));

    expect(
      appliedFillClasses(
        getByTestId('page-layout-v1-grid'),
        ENTITY_TABS_FILL_GRID_CLASS
      )
    ).toEqual([]);
    expect(
      appliedFillClasses(
        getByTestId('page-layout-v1-column'),
        ENTITY_TABS_FILL_COLUMN_CLASS
      )
    ).toEqual([]);
  });

  it('Should apply the entity tabs fill classes when fillEntityTabs is true', () => {
    const { getByTestId } = render(
      <PageLayoutV1 fillEntityTabs pageTitle="Test Page">
        Center content
      </PageLayoutV1>
    );

    expect(getByTestId('page-layout-v1-grid')).toHaveClass(
      ...splitClasses(ENTITY_TABS_FILL_GRID_CLASS)
    );
    expect(getByTestId('page-layout-v1-column')).toHaveClass(
      ...splitClasses(ENTITY_TABS_FILL_COLUMN_CLASS)
    );
  });

  // ADR:2026-10-23-page-layout-wrappers-never-use-has-selectors
  it('Should never gate the entity tabs fill classes with a :has() variant', () => {
    const fillClasses = [
      ...splitClasses(ENTITY_TABS_FILL_GRID_CLASS),
      ...splitClasses(ENTITY_TABS_FILL_COLUMN_CLASS),
    ];

    expect(fillClasses.filter((name) => /has-\[|:has\(/.test(name))).toEqual(
      []
    );
  });
});
