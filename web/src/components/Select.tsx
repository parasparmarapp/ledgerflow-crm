import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  sublabel?: string;
  group?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string | number | undefined;
  onChange: (value: any) => void;
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  label,
  icon,
  error,
  disabled = false,
  searchable,
  clearable = false,
  className = '',
  id,
  name,
  required = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Auto-enable search if there are more than 6 options unless explicitly specified
  const isSearchable = searchable ?? options.length > 6;

  // Selected option lookup
  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value));
  }, [options, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(query)) ||
        (opt.group && opt.group.toLowerCase().includes(query))
    );
  }, [options, searchQuery]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && isSearchable) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    if (!isOpen) {
      setHighlightedIndex(-1);
    }
  }, [isOpen, isSearchable]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const option = filteredOptions[highlightedIndex];
        if (!option.disabled) {
          handleSelect(option.value);
        }
      }
    }
  };

  const handleSelect = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"
        >
          {icon && <span className="text-slate-400">{icon}</span>}
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Hidden input for form data */}
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition outline-none cursor-pointer select-none text-sm font-medium ${
          disabled
            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
            : isOpen
            ? 'bg-white border-amber-400 ring-4 ring-amber-100 shadow-sm text-slate-900'
            : error
            ? 'bg-red-50/30 border-red-300 text-slate-900 hover:border-red-400'
            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900 focus:border-amber-400 focus:ring-4 focus:ring-amber-100'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedOption?.icon ? (
            <span className="shrink-0 text-slate-400">{selectedOption.icon}</span>
          ) : icon && !label ? (
            <span className="shrink-0 text-slate-400">{icon}</span>
          ) : null}

          {selectedOption ? (
            <div className="min-w-0 truncate flex items-center gap-2">
              <span className="font-semibold text-slate-900 truncate">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-xs text-slate-400 shrink-0 font-normal">
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-normal truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleClear(e as any);
              }}
              title="Clear selection"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-amber-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box if Searchable */}
          {isSearchable && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Type to filter..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 font-medium transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 text-sm focus:outline-none"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-4 text-center text-slate-400 text-xs italic">
                No matching options found
              </li>
            ) : (
              (() => {
                let lastGroup: string | undefined = undefined;

                return filteredOptions.map((opt, index) => {
                  const isSelected = String(opt.value) === String(value);
                  const isHighlighted = highlightedIndex === index;
                  const showGroupHeader = opt.group && opt.group !== lastGroup;
                  if (opt.group) lastGroup = opt.group;

                  return (
                    <React.Fragment key={String(opt.value) + '-' + index}>
                      {showGroupHeader && (
                        <li
                          className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/60 rounded-md mt-1 first:mt-0 select-none"
                          role="presentation"
                        >
                          {opt.group}
                        </li>
                      )}
                      <li
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          if (!opt.disabled) handleSelect(opt.value);
                        }}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition select-none ${
                          opt.disabled
                            ? 'opacity-40 cursor-not-allowed bg-transparent'
                            : isSelected
                            ? 'bg-amber-50 text-amber-900 font-semibold ring-1 ring-amber-200/50'
                            : isHighlighted
                            ? 'bg-slate-50 text-slate-900 font-medium'
                            : 'text-slate-700 hover:bg-slate-50 font-normal'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {opt.icon && <span className="shrink-0 text-slate-400">{opt.icon}</span>}
                          <div className="min-w-0 truncate">
                            <span className={isSelected ? 'font-semibold text-amber-900' : ''}>
                              {opt.label}
                            </span>
                            {opt.sublabel && (
                              <span className="text-xs text-slate-400 block truncate font-normal mt-0.5">
                                {opt.sublabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-amber-600 shrink-0 ml-2" />
                        )}
                      </li>
                    </React.Fragment>
                  );
                });
              })()
            )}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-rose-500 mt-1.5 font-medium">{error}</p>}
    </div>
  );
}

export default Select;
