import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'amoled' | 'dracula' | 'nord' | 'cyberpunk' | 'synthwave';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        // Remove all theme classes
        document.documentElement.classList.remove(
          'theme-light',
          'theme-amoled',
          'theme-dracula',
          'theme-nord',
          'theme-cyberpunk',
          'theme-synthwave'
        );
        
        // Add new theme class if not default dark
        if (theme !== 'dark') {
          document.documentElement.classList.add(`theme-${theme}`);
        }
        
        set({ theme });
      },
    }),
    {
      name: 'odnix-theme',
      onRehydrateStorage: () => (state) => {
        // Apply theme on rehydration
        if (state?.theme && state.theme !== 'dark') {
          document.documentElement.classList.add(`theme-${state.theme}`);
        }
      },
    }
  )
);
