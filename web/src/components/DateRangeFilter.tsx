import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  RotateCcw,
  CalendarDays,
  CalendarX,
  CalendarClock,
  Clock,
  History,
  Check,
} from 'lucide-react';

export interface DateRangeFilterProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (startDate: string, endDate: string) => void;
  className?: string;
  align?: 'left' | 'right';
  placeholder?: string;
}

const MONTH_NAMES_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function toDateStr(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateStr(str: string): Date | null {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseDateStr(dateStr);
  if (!date) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseDateStr(dateStr);
  if (!date) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface CalendarDay {
  dateString: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

function generateMonthDays(year: number, month: number): CalendarDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayStr = toDateStr(new Date());

  const days: CalendarDay[] = [];

  // Prev month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      dateString: dateStr,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      dateString: dateStr,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Next month leading days (to complete 5 or 6 full weeks - 35 or 42 slots)
  const totalSlots = days.length <= 35 ? 35 : 42;
  const remainingSlots = totalSlots - days.length;
  for (let d = 1; d <= remainingSlots; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      dateString: dateStr,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  return days;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  className = '',
  align = 'right',
  placeholder = 'Pick a date',
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active range in current editing session
  const [tempStart, setTempStart] = useState<string>(startDate || '');
  const [tempEnd, setTempEnd] = useState<string>(endDate || '');
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Year & Month for Month 1 (Left month)
  const initialDate = useMemo(() => {
    return parseDateStr(startDate) || parseDateStr(endDate) || new Date();
  }, [startDate, endDate]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Month 2 is viewMonth + 1
  const month2 = viewMonth === 11 ? 0 : viewMonth + 1;
  const year2 = viewMonth === 11 ? viewYear + 1 : viewYear;

  // Month & Year dropdown controls
  const [showMonthSelect1, setShowMonthSelect1] = useState(false);
  const [showYearSelect1, setShowYearSelect1] = useState(false);
  const [showMonthSelect2, setShowMonthSelect2] = useState(false);
  const [showYearSelect2, setShowYearSelect2] = useState(false);

  // Year options: past 6 years to next 2 years
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear - 6; y <= currentYear + 3; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setTempStart(startDate || '');
      setTempEnd(endDate || '');
      setHoverDate(null);
      const activeDate = parseDateStr(startDate) || parseDateStr(endDate) || new Date();
      setViewYear(activeDate.getFullYear());
      setViewMonth(activeDate.getMonth());
    }
  }, [isOpen, startDate, endDate]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowMonthSelect1(false);
        setShowYearSelect1(false);
        setShowMonthSelect2(false);
        setShowYearSelect2(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Presets definition
  const presets = useMemo(() => {
    const today = new Date();
    const todayStr = toDateStr(today);

    // Yesterday
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    const yestStr = toDateStr(yest);

    // Last 7 days
    const l7 = new Date();
    l7.setDate(today.getDate() - 6);
    const l7Str = toDateStr(l7);

    // This month (1st of month to today)
    const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstThisMonthStr = toDateStr(firstThisMonth);

    // Last month (1st of last month to last day of last month)
    const firstLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const firstLastMonthStr = toDateStr(firstLastMonth);
    const lastDayLastMonthStr = toDateStr(lastDayLastMonth);

    // This year (Jan 1 of this year to today)
    const firstThisYear = new Date(today.getFullYear(), 0, 1);
    const firstThisYearStr = toDateStr(firstThisYear);

    return [
      { id: 'today', label: 'TODAY', icon: CalendarIcon, range: [todayStr, todayStr] as [string, string] },
      { id: 'yesterday', label: 'YESTERDAY', icon: History, range: [yestStr, yestStr] as [string, string] },
      { id: 'last_7_days', label: 'LAST 7 DAYS', icon: Clock, range: [l7Str, todayStr] as [string, string] },
      { id: 'this_month', label: 'THIS MONTH', icon: CalendarDays, range: [firstThisMonthStr, todayStr] as [string, string] },
      { id: 'last_month', label: 'LAST MONTH', icon: CalendarDays, range: [firstLastMonthStr, lastDayLastMonthStr] as [string, string] },
      { id: 'this_year', label: 'THIS YEAR', icon: CalendarIcon, range: [firstThisYearStr, todayStr] as [string, string] },
    ];
  }, []);

  const handleApplyPreset = (range: [string, string]) => {
    setTempStart(range[0]);
    setTempEnd(range[1]);
    setHoverDate(null);
    onChange(range[0], range[1]);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempStart('');
    setTempEnd('');
    setHoverDate(null);
    onChange('', '');
    setIsOpen(false);
  };

  // Month navigation
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

  // Range day click logic
  const handleDayClick = (dateStr: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      // Pick first date
      setTempStart(dateStr);
      setTempEnd('');
      setHoverDate(null);
    } else if (tempStart && !tempEnd) {
      // Pick second date
      let start = tempStart;
      let end = dateStr;
      if (end < start) {
        start = dateStr;
        end = tempStart;
      }
      setTempStart(start);
      setTempEnd(end);
      setHoverDate(null);
      // Automatically apply when range is completed
      onChange(start, end);
      setIsOpen(false);
    }
  };

  const hasFilter = Boolean(startDate || endDate);

  // Active range calculation for day cells
  const effectiveStart = tempStart;
  const effectiveEnd = tempEnd || (hoverDate && tempStart ? hoverDate : '');
  const [rangeStart, rangeEnd] = useMemo(() => {
    if (!effectiveStart && !effectiveEnd) return ['', ''];
    if (effectiveStart && !effectiveEnd) return [effectiveStart, effectiveStart];
    if (effectiveStart > effectiveEnd) return [effectiveEnd, effectiveStart];
    return [effectiveStart, effectiveEnd];
  }, [effectiveStart, effectiveEnd]);

  // Days for month 1 and month 2
  const month1Days = useMemo(() => generateMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const month2Days = useMemo(() => generateMonthDays(year2, month2), [year2, month2]);

  // Trigger button label
  const triggerLabel = useMemo(() => {
    if (!startDate && !endDate) return placeholder;
    if (startDate && endDate) {
      if (startDate === endDate) {
        return formatDisplayDate(startDate);
      }
      return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
    }
    if (startDate) return `From ${formatShortDate(startDate)}`;
    return `Until ${formatShortDate(endDate)}`;
  }, [startDate, endDate, placeholder]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button with Filter / Calendar icon */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-xs transition select-none ${
          hasFilter
            ? 'border-blue-400 bg-blue-50 text-blue-900 ring-2 ring-blue-500/10 hover:bg-blue-100/70 hover:border-blue-500'
            : isOpen
            ? 'border-slate-400 bg-white text-slate-900 ring-2 ring-slate-400/20 shadow-sm'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        }`}
        title="Filter date range"
      >
        <CalendarIcon
          className={`h-4 w-4 shrink-0 ${
            hasFilter ? 'text-blue-600' : 'text-slate-500'
          }`}
        />
        <span className="truncate max-w-[200px]">{triggerLabel}</span>

        {hasFilter && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-1 rounded-md p-0.5 text-blue-500 hover:bg-blue-200/80 hover:text-blue-800 transition"
            title="Clear date filter"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {/* Modern Popover: Dual Month with Presets Sidebar */}
      {isOpen && (
        <div
          className={`absolute z-[9999] mt-1.5 w-[620px] rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ maxWidth: 'calc(100vw - 20px)' }}
        >
          <div className="flex flex-row">
            {/* Left Sidebar: PRESETS */}
            <div className="w-[150px] shrink-0 border-r border-slate-100 p-2.5 bg-slate-50/70 flex flex-col justify-between rounded-l-2xl">
              <div>
                <div className="mb-2 px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  PRESETS
                </div>
                <div className="space-y-0.5">
                  {presets.map((preset) => {
                    const Icon = preset.icon;
                    const isPresetActive =
                      tempStart === preset.range[0] && tempEnd === preset.range[1];

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset.range)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition ${
                          isPresetActive
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-800 hover:bg-white hover:text-blue-600 hover:shadow-2xs'
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${isPresetActive ? 'text-white' : 'text-slate-500'}`} />
                        <span className="truncate">{preset.label}</span>
                        {isPresetActive && <Check className="h-3 w-3 ml-auto text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Area: Dual Month Calendar View */}
            <div className="flex-1 p-3">
              {/* Dual Month Container */}
              <div className="flex flex-row gap-3 relative">
                {/* Month 1 (Left) */}
                <div className="w-[210px] shrink-0">
                  {/* Month 1 Header */}
                  <div className="flex items-center justify-between mb-2 px-0.5">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Previous month"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex items-center gap-1">
                      {/* Month dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowMonthSelect1(!showMonthSelect1);
                            setShowYearSelect1(false);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-800 hover:bg-slate-200/80 transition"
                        >
                          <span>{MONTH_NAMES_SHORT[viewMonth]}</span>
                          <span className="text-[9px] text-slate-500">▼</span>
                        </button>
                        {showMonthSelect1 && (
                          <div className="absolute z-20 top-full mt-1 left-0 w-28 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg p-1">
                            {MONTH_NAMES_SHORT.map((name, idx) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  setViewMonth(idx);
                                  setShowMonthSelect1(false);
                                }}
                                className={`w-full text-left px-2 py-1 text-[11px] rounded-lg ${
                                  viewMonth === idx ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Year dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowYearSelect1(!showYearSelect1);
                            setShowMonthSelect1(false);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-800 hover:bg-slate-200/80 transition"
                        >
                          <span>{viewYear}</span>
                          <span className="text-[9px] text-slate-500">▼</span>
                        </button>
                        {showYearSelect1 && (
                          <div className="absolute z-20 top-full mt-1 left-0 w-20 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg p-1">
                            {yearOptions.map((y) => (
                              <button
                                key={y}
                                type="button"
                                onClick={() => {
                                  setViewYear(y);
                                  setShowYearSelect1(false);
                                }}
                                className={`w-full text-left px-2 py-1 text-[11px] rounded-lg ${
                                  viewYear === y ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {y}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-5" /> {/* Placeholder spacer */}
                  </div>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-0.5 text-center mb-0.5">
                    {WEEKDAYS.map((day) => (
                      <span key={day} className="text-[10px] font-bold text-slate-900 py-0.5">
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {month1Days.map((day, idx) => {
                      const dateStr = day.dateString;
                      const isStart = dateStr === rangeStart;
                      const isEnd = dateStr === rangeEnd;
                      const isInRange =
                        rangeStart &&
                        rangeEnd &&
                        dateStr > rangeStart &&
                        dateStr < rangeEnd;

                      return (
                        <div
                          key={dateStr + idx}
                          className={`relative flex items-center justify-center ${
                            isInRange
                              ? 'bg-blue-50/80'
                              : isStart && rangeEnd && rangeStart !== rangeEnd
                              ? 'bg-gradient-to-r from-transparent to-blue-50/80 rounded-l-lg'
                              : isEnd && rangeStart && rangeStart !== rangeEnd
                              ? 'bg-gradient-to-l from-transparent to-blue-50/80 rounded-r-lg'
                              : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleDayClick(dateStr)}
                            onMouseEnter={() => {
                              if (tempStart && !tempEnd) {
                                setHoverDate(dateStr);
                              }
                            }}
                            className={`h-7 w-7 text-[11px] rounded-lg flex flex-col items-center justify-center font-bold transition relative z-10 ${
                              isStart || isEnd
                                ? 'bg-blue-600 text-white font-extrabold shadow-xs hover:bg-blue-700'
                                : isInRange
                                ? 'text-blue-900 font-bold hover:bg-blue-100 rounded-none'
                                : day.isCurrentMonth
                                ? day.isToday
                                  ? 'text-blue-600 font-extrabold underline decoration-2 underline-offset-2 hover:bg-slate-100'
                                  : 'text-slate-900 hover:bg-slate-100'
                                : 'text-slate-300 font-normal hover:bg-slate-50'
                            }`}
                          >
                            <span>{day.dayNumber}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Month 2 (Right) */}
                <div className="w-[210px] shrink-0">
                  {/* Month 2 Header */}
                  <div className="flex items-center justify-between mb-2 px-0.5">
                    <div className="w-5" /> {/* Placeholder spacer */}

                    <div className="flex items-center gap-1">
                      {/* Month dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowMonthSelect2(!showMonthSelect2);
                            setShowYearSelect2(false);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-800 hover:bg-slate-200/80 transition"
                        >
                          <span>{MONTH_NAMES_SHORT[month2]}</span>
                          <span className="text-[9px] text-slate-500">▼</span>
                        </button>
                        {showMonthSelect2 && (
                          <div className="absolute z-20 top-full mt-1 left-0 w-28 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg p-1">
                            {MONTH_NAMES_SHORT.map((name, idx) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  const targetPrev = idx === 0 ? 11 : idx - 1;
                                  const targetYear = idx === 0 ? year2 - 1 : year2;
                                  setViewMonth(targetPrev);
                                  setViewYear(targetYear);
                                  setShowMonthSelect2(false);
                                }}
                                className={`w-full text-left px-2 py-1 text-[11px] rounded-lg ${
                                  month2 === idx ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Year dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowYearSelect2(!showYearSelect2);
                            setShowMonthSelect2(false);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-800 hover:bg-slate-200/80 transition"
                        >
                          <span>{year2}</span>
                          <span className="text-[9px] text-slate-500">▼</span>
                        </button>
                        {showYearSelect2 && (
                          <div className="absolute z-20 top-full mt-1 left-0 w-20 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg p-1">
                            {yearOptions.map((y) => (
                              <button
                                key={y}
                                type="button"
                                onClick={() => {
                                  const diff = y - year2;
                                  setViewYear(viewYear + diff);
                                  setShowYearSelect2(false);
                                }}
                                className={`w-full text-left px-2 py-1 text-[11px] rounded-lg ${
                                  year2 === y ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {y}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Next month"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-0.5 text-center mb-0.5">
                    {WEEKDAYS.map((day) => (
                      <span key={day} className="text-[10px] font-bold text-slate-900 py-0.5">
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {month2Days.map((day, idx) => {
                      const dateStr = day.dateString;
                      const isStart = dateStr === rangeStart;
                      const isEnd = dateStr === rangeEnd;
                      const isInRange =
                        rangeStart &&
                        rangeEnd &&
                        dateStr > rangeStart &&
                        dateStr < rangeEnd;

                      return (
                        <div
                          key={dateStr + idx}
                          className={`relative flex items-center justify-center ${
                            isInRange
                              ? 'bg-blue-50/80'
                              : isStart && rangeEnd && rangeStart !== rangeEnd
                              ? 'bg-gradient-to-r from-transparent to-blue-50/80 rounded-l-lg'
                              : isEnd && rangeStart && rangeStart !== rangeEnd
                              ? 'bg-gradient-to-l from-transparent to-blue-50/80 rounded-r-lg'
                              : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleDayClick(dateStr)}
                            onMouseEnter={() => {
                              if (tempStart && !tempEnd) {
                                setHoverDate(dateStr);
                              }
                            }}
                            className={`h-7 w-7 text-[11px] rounded-lg flex flex-col items-center justify-center font-bold transition relative z-10 ${
                              isStart || isEnd
                                ? 'bg-blue-600 text-white font-extrabold shadow-xs hover:bg-blue-700'
                                : isInRange
                                ? 'text-blue-900 font-bold hover:bg-blue-100 rounded-none'
                                : day.isCurrentMonth
                                ? day.isToday
                                  ? 'text-blue-600 font-extrabold underline decoration-2 underline-offset-2 hover:bg-slate-100'
                                  : 'text-slate-900 hover:bg-slate-100'
                                : 'text-slate-300 font-normal hover:bg-slate-50'
                            }`}
                          >
                            <span>{day.dayNumber}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bar: Selected Range & Clear Action */}
          <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between bg-white rounded-b-2xl">
            <div>
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                SELECTED RANGE
              </div>
              <div className="text-[11px] font-bold text-slate-800 mt-0.5">
                {tempStart && tempEnd ? (
                  <span>
                    {formatDisplayDate(tempStart)} – {formatDisplayDate(tempEnd)}
                  </span>
                ) : tempStart && !tempEnd ? (
                  <span className="text-blue-600 animate-pulse">
                    {formatDisplayDate(tempStart)} (select end date)
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal">No range selected</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <CalendarX className="h-3.5 w-3.5 text-slate-500" />
                <span>CLEAR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateRangeFilter;
