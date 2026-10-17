import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    const dark = theme === 'dark';
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    if (!theme) localStorage.setItem('theme', 'light');
  }, []);

  const toggle = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        "p-2 rounded-full transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "text-muted-foreground"
      )}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
