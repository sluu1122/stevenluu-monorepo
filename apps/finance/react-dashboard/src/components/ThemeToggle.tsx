import { Switch } from '@repo/ui/components/switch';
import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <label className="flex items-center justify-between gap-2 text-[12px] text-dim">
      <span className="font-mono tracking-[0.03em]">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
      <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} aria-label="Toggle dark mode" />
    </label>
  );
}
