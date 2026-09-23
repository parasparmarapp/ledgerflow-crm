import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  sublabel?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string | number | undefined;
  onChange: (value: any) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
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
  error,
  disabled = false,
  searchable,
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
        (opt.sublabel && opt.sublabel.toLowerCase().includes(query))
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

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between"
        >
          <span>
            {label} {required && <span className="text-red-500">*</span>}
          </span>
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
        className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer select-none text-xs font-medium ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-xs text-slate-900'
            : error
            ? 'bg-red-50/50 border-red-300 text-slate-900 hover:border-red-400'
            : 'bg-white border-slate-300 hover:border-slate-400 text-slate-900 hover:bg-slate-50/50 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="shrink-0 text-slate-500">{selectedOption.icon}</span>
          )}
          {selectedOption ? (
            <div className="min-w-0 truncate">
              <span className="font-semibold text-slate-900">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-[11px] text-slate-400 ml-1.5 font-normal">
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-normal truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-amber-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box if Searchable */}
          {isSearchable && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Type to filter..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
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
            className="max-h-60 overflow-y-auto py-1.5 px-1 space-y-0.5 text-xs focus:outline-hidden"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-3 text-center text-slate-400 text-xs italic">
                No matching options found
              </li>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = highlightedIndex === index;

                return (
                  <li
                    key={String(opt.value) + index}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (!opt.disabled) handleSelect(opt.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition select-none ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed bg-transparent'
                        : isSelected
                        ? 'bg-amber-50 text-amber-900 font-semibold'
                        : isHighlighted
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {opt.icon && <span className="shrink-0 text-slate-500">{opt.icon}</span>}
                      <div className="min-w-0 truncate">
                        <span className={isSelected ? 'font-semibold text-amber-900' : 'font-medium'}>
                          {opt.label}
                        </span>
                        {opt.sublabel && (
                          <span className="text-[10px] text-slate-400 block truncate font-normal">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-2" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  );
}

export default Select;
