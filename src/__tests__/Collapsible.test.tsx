import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import Collapsible from '../Collapsible';

// The component measures content height via View.measure() before the first
// expand. That call is not available in the JS test environment — it lives
// behind requestAnimationFrame (stale → measuring → measure()). Blocking rAF
// keeps the component in the "stale" state so the render-logic tests below
// remain unaffected and no native call is attempted.
jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 0);

describe('Collapsible', () => {
  it('renders children when collapsed (renderChildrenCollapsed defaults to true)', () => {
    const { getByText } = render(
      <Collapsible collapsed>
        <Text>content</Text>
      </Collapsible>
    );
    expect(getByText('content')).toBeTruthy();
  });

  it('does not render children when collapsed and renderChildrenCollapsed is false', () => {
    const { queryByText } = render(
      <Collapsible collapsed renderChildrenCollapsed={false}>
        <Text>content</Text>
      </Collapsible>
    );
    expect(queryByText('content')).toBeNull();
  });

  it('renders children when not collapsed', () => {
    const { getByText } = render(
      <Collapsible collapsed={false}>
        <Text>content</Text>
      </Collapsible>
    );
    expect(getByText('content')).toBeTruthy();
  });
});
