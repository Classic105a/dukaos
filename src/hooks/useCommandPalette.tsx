import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import CommandPalette from '@/components/command/CommandPalette';

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<CommandPaletteContextValue>({
  open: () => {},
  close: () => {},
  isOpen: false,
});

export const CommandPaletteProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Ctx.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
      <CommandPalette open={isOpen} onOpenChange={setIsOpen} />
    </Ctx.Provider>
  );
};

export const useCommandPalette = () => useContext(Ctx);