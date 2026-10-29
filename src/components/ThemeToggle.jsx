import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { setTheme, useTheme } from '../theme.js';

export function ThemeToggle() {
  const theme = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const label = nextTheme === 'light' ? '明亮模式' : '暗夜模式';
  const Icon = nextTheme === 'light' ? Sun : Moon;
  return <button type="button" className="theme-toggle" aria-label={`切换到${label}`} title={`切换到${label}`} onClick={() => setTheme(nextTheme)}><Icon size={18} aria-hidden="true"/><span className="theme-toggle-label">{label}</span></button>;
}
