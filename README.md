# react-native-collapsible

Animated collapsible component for React Native. Measures content height before expanding so the animation always fills exactly the right amount of space — no hard-coded heights needed. Useful for accordions, expandable sections, and any show/hide UI pattern.

## Installation

```sh
npm install react-native-collapsible
```

## Usage

```tsx
import React, { useState } from 'react';
import { Button, Text, View } from 'react-native';
import Collapsible from 'react-native-collapsible';

export default function App() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <View>
      <Button title="Toggle" onPress={() => setCollapsed(c => !c)} />
      <Collapsible collapsed={collapsed}>
        <Text>This content is revealed with an animated height transition.</Text>
      </Collapsible>
    </View>
  );
}
```

### Accordion example

```tsx
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Collapsible from 'react-native-collapsible';

const items = [
  { title: 'Section 1', body: 'Content for section 1' },
  { title: 'Section 2', body: 'Content for section 2' },
];

export default function Accordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <View>
      {items.map((item, index) => (
        <View key={index}>
          <Pressable onPress={() => setOpenIndex(openIndex === index ? null : index)}>
            <Text>{item.title}</Text>
          </Pressable>
          <Collapsible collapsed={openIndex !== index}>
            <Text>{item.body}</Text>
          </Collapsible>
        </View>
      ))}
    </View>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collapsed` | `boolean` | `true` | Whether the content is hidden |
| `collapsedHeight` | `number` | `0` | Height when collapsed (peek effect) |
| `duration` | `number` | `800` | Animation duration in ms |
| `easing` | `EasingFunction` | `Easing.inOut(Easing.cubic)` | Animation easing |
| `align` | `'top' \| 'center' \| 'bottom'` | `'top'` | Content alignment during transition |
| `enablePointerEvents` | `boolean` | `false` | Allow touch events when collapsed |
| `renderChildrenCollapsed` | `boolean` | `true` | Keep children mounted when collapsed |
| `style` | `StyleProp<ViewStyle>` | — | Style for the inner content container |
| `onAnimationEnd` | `() => void` | — | Called when the animation completes |

## How it works

When content is first expanded, the component renders it off-screen with `opacity: 0` to measure its natural height. Once measured, it animates from `collapsedHeight` to that measured height. Subsequent toggles reuse the cached height and skip the measurement step unless the content changes.

## License

MIT
