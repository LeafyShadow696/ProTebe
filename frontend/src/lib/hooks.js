import { useEffect } from 'react';

/**
 * While `isActive` is true, adds `sheet-open` to <body>.
 * Used by bottom sheets / modals to hide the BottomTabBar via CSS rule in index.css.
 * Reference-counted so multiple stacked sheets work correctly.
 */
let openCount = 0;

export function useSheetLock(isActive) {
  useEffect(() => {
    if (!isActive) return undefined;
    openCount += 1;
    document.body.classList.add('sheet-open');
    return () => {
      openCount -= 1;
      if (openCount <= 0) {
        openCount = 0;
        document.body.classList.remove('sheet-open');
      }
    };
  }, [isActive]);
}
