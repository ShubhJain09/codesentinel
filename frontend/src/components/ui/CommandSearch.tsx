import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Command,
  ArrowRight,
  Shield,
  Clock,
  Database,
  Activity,
  FileCode,
  Zap,
  Settings,
  AlertTriangle,
  Play,
  X,
  Users,
  KeyRound,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Administration' | 'Actions' | 'Investigations';
  icon: LucideIcon | React.ComponentType<{ className?: string; size?: number | string }>;
  shortcut?: string;
  perform: () => void;
}

interface CommandSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerDemoScan?: () => void;
}

/**
 * CommandSearch component adapted for the Agndex Dark Charcoal Design System.
 * Matches #0E0F12 / #18191E palette with subtle borders and fuchsia accent.
 */
export function CommandSearch({
  isOpen,
  onClose,
  onTriggerDemoScan,
}: CommandSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const commands: CommandItem[] = [
    {
      id: 'cmd-center',
      title: 'Go to Command Center',
      category: 'Navigation',
      icon: Shield,
      shortcut: 'G C',
      perform: () => {
        navigate('/app');
        onClose();
      },
    },
    {
      id: 'admin-cc',
      title: 'Open Admin Control Center',
      category: 'Administration',
      icon: ShieldCheck,
      shortcut: 'G A',
      perform: () => {
        navigate('/app/admin/control-center');
        onClose();
      },
    },
    {
      id: 'findings',
      title: 'Inspect Vulnerability Findings',
      category: 'Navigation',
      icon: AlertTriangle,
      shortcut: 'G F',
      perform: () => {
        navigate('/app/findings');
        onClose();
      },
    },
    {
      id: 'scans',
      title: 'View Scan History & Audit Logs',
      category: 'Navigation',
      icon: Clock,
      shortcut: 'G S',
      perform: () => {
        navigate('/app/scans');
        onClose();
      },
    },
    {
      id: 'pipeline',
      title: 'Review Webhook Pipeline Status',
      category: 'Navigation',
      icon: Activity,
      shortcut: 'G P',
      perform: () => {
        navigate('/app/pipeline');
        onClose();
      },
    },
    {
      id: 'repos',
      title: 'Manage Allowlisted Repositories',
      category: 'Navigation',
      icon: Database,
      shortcut: 'G R',
      perform: () => {
        navigate('/app/repositories');
        onClose();
      },
    },
    {
      id: 'integrations',
      title: 'API Keys & GitHub Webhook Ingress',
      category: 'Navigation',
      icon: KeyRound,
      perform: () => {
        navigate('/app/integrations');
        onClose();
      },
    },
    {
      id: 'team-roles',
      title: 'Team Directory & Role Permissions',
      category: 'Administration',
      icon: Users,
      perform: () => {
        navigate('/app/admin');
        onClose();
      },
    },
    {
      id: 'my-profile',
      title: 'My Profile & Account Credentials',
      category: 'Navigation',
      icon: Users,
      shortcut: 'G U',
      perform: () => {
        navigate('/app/profile');
        onClose();
      },
    },
    {
      id: 'settings',
      title: 'System Settings & Security Profile',
      category: 'Navigation',
      icon: Settings,
      perform: () => {
        navigate('/app/settings');
        onClose();
      },
    },
    {
      id: 'docs',
      title: 'Open Technical Documentation',
      category: 'Navigation',
      icon: FileCode,
      perform: () => {
        navigate('/docs');
        onClose();
      },
    },
    {
      id: 'demo-scan',
      title: 'Execute Controlled Fixture Scan (insecure_example.py)',
      category: 'Actions',
      icon: Play,
      shortcut: '↵',
      perform: () => {
        if (onTriggerDemoScan) onTriggerDemoScan();
        onClose();
      },
    },
    {
      id: 'eval-finding',
      title: 'Investigate CWE-95 Dynamic eval() Rule',
      category: 'Investigations',
      icon: Zap,
      perform: () => {
        navigate('/app/findings?severity=ERROR');
        onClose();
      },
    },
    {
      id: 'shell-finding',
      title: 'Investigate CWE-78 Subprocess Shell Rule',
      category: 'Investigations',
      icon: Zap,
      perform: () => {
        navigate('/app/findings?severity=WARNING');
        onClose();
      },
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Lock body scroll and focus immediately without perceptible delay
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      inputRef.current?.focus();
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }

      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].perform();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          {/* Dark Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0E0F12]/80 backdrop-blur-md"
          />

          {/* Dark Dialog Matching Agndex Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="relative w-full max-w-xl bg-[#18191E] rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-10 text-zinc-100"
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-white/5 bg-[#18191E]">
              <Search size={18} className="text-zinc-400 mr-3 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search workspace... (Esc to close)"
                className="w-full text-sm text-white placeholder-zinc-500 focus:outline-none bg-transparent font-sans"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close command search"
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500 font-mono">
                  No matching commands found for &quot;{query}&quot;
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCommands.map((cmd, idx) => {
                    const isSelected = selectedIndex === idx;
                    const Icon = cmd.icon;

                    return (
                      <div
                        key={cmd.id}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={cmd.perform}
                        className={cn(
                          'flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-colors',
                          isSelected
                            ? 'bg-[#202227] text-white border border-white/10 font-medium'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors',
                              isSelected
                                ? 'bg-[#D946EF] text-white'
                                : 'bg-white/5 text-zinc-400'
                            )}
                          >
                            <Icon size={13} />
                          </div>
                          <span className="truncate">{cmd.title}</span>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider ml-1">
                            · {cmd.category}
                          </span>
                        </div>

                        {cmd.shortcut && (
                          <kbd className="px-2 py-0.5 rounded bg-white/10 border border-white/5 text-[10px] font-mono text-zinc-300">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dark Footer */}
            <div className="px-4 py-2.5 bg-[#121316] border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <div className="flex items-center gap-3">
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Command size={11} />
                <span>CodeSentinel Workspace</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default CommandSearch;
