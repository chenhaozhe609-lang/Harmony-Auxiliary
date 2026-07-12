import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Shared dialog keyboard/focus behaviour (Task 6 §T6.6 accessibility): when a
// dialog/sheet becomes active, move focus into it and remember what had focus;
// pressing Escape closes it; on close, focus returns to the trigger. DOM and
// classNames are untouched, so verify selectors keep working.
export function useDialog(
  active: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>,
) {
  const restoreRef = useRef<HTMLElement | null>(null);

  // Focus in on open, restore on close. Keyed only on `active` so ordinary
  // re-renders (e.g. a fresh onClose identity) never steal or trap focus.
  useEffect(() => {
    if (!active) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const container = containerRef.current;
    if (container) {
      const target = container.querySelector<HTMLElement>(FOCUSABLE) ?? container;
      target.focus({ preventScroll: true });
    }
    return () => {
      restoreRef.current?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Escape closes the active dialog.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, onClose]);
}
