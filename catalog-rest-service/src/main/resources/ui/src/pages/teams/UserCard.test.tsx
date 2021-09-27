import { findByTestId, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import UserCard from './UserCard';

const mockItem = {
  description: 'description1',
  name: 'name1',
  id: 'id1',
};

const mockRemove = jest.fn();

jest.mock('../../components/common/avatar/Avatar', () => {
  return jest.fn().mockReturnValue(<p data-testid="avatar">Avatar</p>);
});

jest.mock('../../utils/SvgUtils', () => {
  return {
    __esModule: true,
    default: jest.fn().mockReturnValue(<p data-testid="svg-icon">SVGIcons</p>),
    Icons: {
      TABLE: 'table',
      TOPIC: 'topic',
      DASHBOARD: 'dashboard',
    },
  };
});

describe('Test userCard component', () => {
  it('Component should render', async () => {
    const { container } = render(<UserCard isIconVisible item={mockItem} />, {
      wrapper: MemoryRouter,
    });

    const cardContainer = await findByTestId(container, 'user-card-container');
    const avatar = await findByTestId(container, 'avatar');

    expect(avatar).toBeInTheDocument();
    expect(cardContainer).toBeInTheDocument();
  });

  it('Data should render', async () => {
    const { container } = render(<UserCard item={mockItem} />, {
      wrapper: MemoryRouter,
    });

    expect(await findByTestId(container, 'data-container')).toBeInTheDocument();
  });

  it('If isActionVisible is passed it should show delete icon', async () => {
    const { container } = render(
      <UserCard isActionVisible item={mockItem} onRemove={mockRemove} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const remove = await findByTestId(container, 'remove');

    expect(remove).toBeInTheDocument();

    fireEvent.click(remove);

    expect(mockRemove).toBeCalled();
  });

  it('If dataset is provided, it should display accordingly', async () => {
    const { container } = render(
      <UserCard isDataset isIconVisible item={mockItem} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const svgIcon = await findByTestId(container, 'svg-icon');
    const datasetLink = await findByTestId(container, 'dataset-link');

    expect(svgIcon).toBeInTheDocument();
    expect(datasetLink).toBeInTheDocument();
  });
});
