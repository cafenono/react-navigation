import * as React from 'react';

import DrawerDirectionContext from './DrawerDirectionContext';
import DrawerStatusContext from './DrawerStatusContext';

/**
 * Hook to detect if the drawer's status in a parent navigator.
 * Returns 'open' if the drawer is open, 'closed' if the drawer is closed.
 */
export default function useDrawerStatus() {
  const drawerStatus = React.useContext(DrawerStatusContext);
  const drawerDirection = React.useContext(DrawerDirectionContext);

  if (drawerStatus === undefined) {
    throw new Error(
      "Couldn't find a drawer. Is your component inside a drawer navigator?"
    );
  }

  return { status: drawerStatus, direction: drawerDirection };
}
