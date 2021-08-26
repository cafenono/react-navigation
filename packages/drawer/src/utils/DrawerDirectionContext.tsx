import * as React from 'react';

const DrawerDirectionContext =
  React.createContext<'left' | 'right' | 'closed' | undefined>(undefined);

export default DrawerDirectionContext;
