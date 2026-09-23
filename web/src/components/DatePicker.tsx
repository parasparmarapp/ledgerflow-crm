import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface DatePickerProps {
  value: string; // Expected in YYYY-MM-DD format
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Helpers
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date...',
  label,
  error,
  disabled = false,
  min,
  max,
  className = '',
  id,
  name,
  required = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial view year and month from value or today
  const initialDate = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Update view month/year if value changes externally while closed
  useEffect(() => {
    if (!isOpen && value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [value, isOpen]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calendar grid calculation
  const calendarDays = useMemo(() => {
    // Days in current month
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // Day of the week for 1st day of month (0 = Sun, 1 = Mon ... 6 = Sat)
    // We adjust so 0 = Monday, 6 = Sunday
    let firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    // Days in previous month
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: {
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isDisabled: boolean;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];

    const todayStr = getTodayString();

    // Previous month trailing days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateString: dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isDisabled: Boolean((min && dateStr < min) || (max && dateStr > max)),
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateString: dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isDisabled: Boolean((min && dateStr < min) || (max && dateStr > max)),
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    // Next month trailing days to complete 42 or 35 slots (6 weeks grid)
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remainingSlots = totalSlots - days.length;
    for (let d = 1; d <= remainingSlots; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateString: dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isDisabled: Boolean((min && dateStr < min) || (max && dateStr > max)),
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    return days;
  }, [viewYear, viewMonth, min, max, value]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const today = getTodayString();
    onChange(today);
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
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

      {/* Hidden input for standard forms */}
      {name && <input type="hidden" name={name} value={value || ''} />}

      {/* Trigger Button / Input Display */}
      <div className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
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
          <div className="flex items-center gap-2 min-w-0">
            <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
            <span className={value ? 'font-semibold text-slate-900' : 'text-slate-400 font-normal'}>
              {value ? formatDisplayDate(value) : placeholder}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                title="Clear date"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Calendar Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 mt-1.5 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 animate-in fade-in zoom-in-95 duration-100">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 tracking-tight">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className="text-[11px] font-semibold text-slate-400 py-1"
              >
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              return (
                <button
                  key={day.dateString + idx}
                  type="button"
                  disabled={day.isDisabled}
                  onClick={() => handleSelectDay(day.dateString)}
                  className={`h-8 sm:h-9 text-xs rounded-xl flex flex-col items-center justify-center font-medium transition relative ${
                    day.isDisabled
                      ? 'text-slate-300 opacity-40 cursor-not-allowed'
                      : day.isSelected
                      ? 'bg-amber-600 text-white font-bold shadow-xs hover:bg-amber-700'
                      : day.isCurrentMonth
                      ? 'text-slate-800 hover:bg-amber-50 hover:text-amber-900'
                      : 'text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span>{day.dayNumber}</span>
                  {day.isToday && !day.isSelected && (
                    <span className="w-1 h-1 rounded-full bg-amber-500 absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Shortcuts */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-amber-700 font-bold hover:text-amber-800 hover:underline px-1 py-0.5 rounded cursor-pointer"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-500 hover:text-slate-700 px-1 py-0.5 rounded cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-700 px-1 py-0.5 rounded cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  );
}

export default DatePicker;
