"use client";

import { useState } from "react";

interface DateTimePickerProps {
  selectedDate: Date | null;
  selectedTime: string;
  onDateChange: (date: Date | null) => void;
  onTimeChange: (time: string) => void;
}

const AVAILABLE_TIMES = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function DateTimePicker({
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
}: DateTimePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get day of week (0 = Sunday, convert to Monday = 0)
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: (number | null)[] = [];

    // Add empty slots for days before the first day
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isPast = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    return checkDate < today;
  };

  const handleDayClick = (day: number) => {
    if (isPast(day)) return;
    const newDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    onDateChange(newDate);
    setShowTimePicker(true);
  };

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="space-y-4">
      {/* Show Calendar only if no date selected yet */}
      {!selectedDate && (
        <>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <svg
                className="w-5 h-5 text-white/70"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h4 className="text-white font-semibold">
              {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h4>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <svg
                className="w-5 h-5 text-white/70"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-white/40 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div key={index} className="aspect-square">
                {day !== null && (
                  <button
                    type="button"
                    onClick={() => handleDayClick(day)}
                    disabled={isPast(day)}
                    className={`w-full h-full rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                      ${isPast(day)
                        ? "text-white/20 cursor-not-allowed"
                        : isSelected(day)
                        ? "bg-[#0984E3] text-white shadow-lg shadow-[#0984E3]/30"
                        : isToday(day)
                        ? "bg-white/10 text-white border border-[#0984E3]/50"
                        : "text-white/80 hover:bg-white/10"
                      }`}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Time Picker - shows after date is selected */}
      {selectedDate && (
        <div>
          {/* Selected date display with change option */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wider">Selected date</p>
              <p className="text-white font-semibold">
                {selectedDate.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDateChange(null)}
              className="text-white/60 text-sm font-medium px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 hover:text-white transition-all cursor-pointer"
            >
              Change
            </button>
          </div>

          <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-[#0984E3]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Select a time
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {AVAILABLE_TIMES.map((time) => (
              <button
                type="button"
                key={time}
                onClick={() => onTimeChange(time)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                  ${selectedTime === time
                    ? "bg-[#0984E3] text-white shadow-lg shadow-[#0984E3]/30"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
              >
                {formatTime(time)}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
