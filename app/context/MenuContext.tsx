// app/context/MenuContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface MenuContextType {
    isMenuOpen: boolean;
    openMenu: () => void;
    closeMenu: () => void;
}

const MenuContext = createContext<MenuContextType>({
    isMenuOpen: false,
    openMenu: () => { },
    closeMenu: () => { },
});

export const useMenu = () => useContext(MenuContext);

export function MenuProvider({ children }: { children: React.ReactNode }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const openMenu = () => setIsMenuOpen(true);
    const closeMenu = () => setIsMenuOpen(false);

    return (
        <MenuContext.Provider value={{ isMenuOpen, openMenu, closeMenu }}>
            {children}
        </MenuContext.Provider>
    );
}
