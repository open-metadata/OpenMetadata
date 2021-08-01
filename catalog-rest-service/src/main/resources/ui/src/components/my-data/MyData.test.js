import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { dataDetails } from '../../pages/my-data/index.mock';
import MyData from './MyData';

describe('Test MyData Component', () => {
  const { testdata1, testdata2, testdata3 } = dataDetails;

  it('Renders the proper HTML for a my-data item', () => {
    const { container } = render(<MyData dataDetails={testdata1} />, {
      wrapper: MemoryRouter,
    });
    const dataNameElement = getByTestId(container, 'data-name');
    const badgeElement = getByTestId(container, 'badge');
    // const likeCountElement = getByTestId(container, 'like-button');
    // const ellipsisSvg = getByTestId(container, 'ellipsis');
    const descriptionElement = getByTestId(container, 'desc-container');

    // const statsElement = getByTestId(container, 'stats-container');
    expect(dataNameElement.textContent).toBe('fact_order ');
    expect(badgeElement.textContent).toBe('table');
    // expect(likeCountElement).toBeInTheDocument();
    // expect(ellipsisSvg).toBeInTheDocument();
    expect(descriptionElement).toBeInTheDocument();
    // expect(statsElement).toBeInTheDocument();
  });

  it('Renders the query details component when badge is QUERY and not render the description component', () => {
    const { queryByTestId, container } = render(
      <MyData dataDetails={testdata2} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const dataNameElement = getByTestId(container, 'data-name');
    const badgeElement = getByTestId(container, 'badge');
    // const likeCountElement = getByTestId(container, 'like-button');
    // const ellipsisSvg = getByTestId(container, 'ellipsis');
    const queryElement = getByTestId(container, 'query-container');

    // const statsElement = getByTestId(container, 'stats-container');
    expect(queryByTestId('desc-container')).toBeNull();
    expect(dataNameElement.textContent).toBe('product_categories ');
    expect(badgeElement.textContent).toBe('query');
    // expect(likeCountElement).toBeInTheDocument();
    // expect(ellipsisSvg).toBeInTheDocument();
    expect(queryElement).toBeInTheDocument();
    // expect(statsElement).toBeInTheDocument();
  });

  it('Renders the description component badge is not QUERY and not render the query details component', () => {
    const { queryByTestId, container } = render(
      <MyData dataDetails={testdata3} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const dataNameElement = getByTestId(container, 'data-name');
    const badgeElement = getByTestId(container, 'badge');
    // const likeCountElement = getByTestId(container, 'like-button');
    // const ellipsisSvg = getByTestId(container, 'ellipsis');
    const descriptionElement = getByTestId(container, 'desc-container');

    // const statsElement = getByTestId(container, 'stats-container');
    expect(queryByTestId('query-container')).toBeNull();
    expect(dataNameElement.textContent).toBe('customer_cart_checkout ');
    expect(badgeElement.textContent).toBe('table');
    // expect(likeCountElement).toBeInTheDocument();
    // expect(ellipsisSvg).toBeInTheDocument();
    expect(descriptionElement).toBeInTheDocument();
    // expect(statsElement).toBeInTheDocument();
  });
});
