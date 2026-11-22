import React from 'react';
import { AppView } from '../types';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  isVerified: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onNavigate,
  isVerified,
}) => {
  const navItems: Array<{ id: AppView; label: string }> = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'norman', label: 'Norman HCI' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'report', label: 'Professor Report' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('workspace')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
        >
          Socratic AI
        </button>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${
                  isActive
                    ? 'border-sky-700 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate(activeView === 'report' ? 'workspace' : 'report')}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-800 hover:bg-sky-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          >
            {activeView === 'report'
              ? 'Back to Workspace'
              : isVerified
                ? 'Verified Report'
                : 'Professor Report'}
          </button>
        </div>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="md:hidden border-t border-slate-200 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto bg-slate-50"
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-sky-800 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
