import * as React from 'react';
import App from './App';
import { render, screen } from '@testing-library/react';
import user from '@testing-library/user-event';

test('Renders main page correctly', async () => {
  // setup
  render(<App />);
  const buttonCount = await screen.findByRole('button');

  // pre expectations
  expect(buttonCount.innerHTML).toBe('count is: 0');

  // init
  user.click(buttonCount);

  // post expectations
});
