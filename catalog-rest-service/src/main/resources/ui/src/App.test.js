import { render } from '@testing-library/react';
import React from 'react';
import App from './App';

it('renders learn react link', () => {
  const { getAllByTestId } = render(<App />);
  const linkElement = getAllByTestId(/content-wrapper/i);
  linkElement.map((elm) => expect(elm).toBeInTheDocument());
});
