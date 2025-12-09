"use client";

import { useState } from "react";
import DateTimePicker from "./DateTimePicker";

interface BookingFormProps {
  compact?: boolean;
}

export default function BookingForm({ compact = false }: BookingFormProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !company || !phone || !selectedDate || !selectedTime) {
      setErrorMessage("Please fill in all fields");
      setSubmitStatus("error");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          company,
          phone,
          date: selectedDate.toISOString(),
          time: selectedTime,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit booking");
      }

      setSubmitStatus("success");
      setName("");
      setCompany("");
      setPhone("");
      setSelectedDate(null);
      setSelectedTime("");
      setShowDatePicker(false);
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus === "success") {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Booking received!</h3>
        <p className="text-white/60 text-sm mb-6">
          We&apos;ll be in touch shortly to confirm your appointment.
        </p>
        <button
          onClick={() => setSubmitStatus("idle")}
          className="text-[#0984E3] font-medium text-sm hover:underline cursor-pointer"
        >
          Book another appointment
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Show form fields only when date picker is closed */}
      {!showDatePicker && (
        <>
          {/* Name Input */}
          <div className="border-b border-white/30 pb-2 transition-all duration-200 hover:border-white/50 focus-within:border-white">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-base text-white outline-none placeholder-white/60 transition-all duration-200 focus:placeholder-white/80"
            />
          </div>

          {/* Company Input */}
          <div className="border-b border-white/30 pb-2 transition-all duration-200 hover:border-white/50 focus-within:border-white">
            <input
              type="text"
              placeholder="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-transparent text-base text-white outline-none placeholder-white/60 transition-all duration-200 focus:placeholder-white/80"
            />
          </div>

          {/* Phone Input */}
          <div className="border-b border-white/30 pb-2 transition-all duration-200 hover:border-white/50 focus-within:border-white">
            <input
              type="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent text-base text-white outline-none placeholder-white/60 transition-all duration-200 focus:placeholder-white/80"
            />
          </div>
        </>
      )}

      {/* Date & Time Selector Input */}
      <div
        onClick={() => setShowDatePicker(!showDatePicker)}
        className="border-b border-white/30 pb-2 transition-all duration-200 hover:border-white/50 cursor-pointer flex items-center justify-between"
      >
        <span className={selectedDate && selectedTime ? "text-white" : "text-white/60"}>
          {selectedDate && selectedTime
            ? `${selectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at ${formatTime(selectedTime)}`
            : "Select date & time"}
        </span>
        <svg
          className={`w-5 h-5 text-white/60 transition-transform duration-200 ${showDatePicker ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Date & Time Picker - Only shown when clicked */}
      {showDatePicker && (
        <div className="overflow-y-auto">
          <DateTimePicker
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onDateChange={setSelectedDate}
            onTimeChange={(time) => {
              setSelectedTime(time);
              setShowDatePicker(false);
            }}
          />
        </div>
      )}

      {/* Error Message - only show when picker is closed */}
      {!showDatePicker && submitStatus === "error" && (
        <div className="p-3 bg-red-500/30 border border-red-500/50 rounded-lg">
          <p className="text-red-300 text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Submit Button - only show when picker is closed */}
      {!showDatePicker && (
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full bg-[#0984E3] text-white font-bold ${compact ? "text-base py-4" : "text-lg py-4"} rounded-[14px] mt-4 cursor-pointer transition-all duration-200 hover:bg-[#0770c4] hover:scale-[1.02] active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Booking...
            </span>
          ) : (
            "BOOK NOW"
          )}
        </button>
      )}
    </form>
  );
}
