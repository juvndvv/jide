import { useState } from 'react';

export interface UsePaletteOpenResult {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export function usePaletteOpen(): UsePaletteOpenResult {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
