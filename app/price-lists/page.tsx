"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

interface PriceListFile {
  name: string;
  size: number;
  modified: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function extractDateFromFilename(filename: string): string {
  // Match date pattern DD.MM.YY at end of filename (before extension)
  const match = filename.match(/(\d{2})\.(\d{2})\.(\d{2})\.(xlsx?|xls)$/i);
  if (!match) return "";

  const [, day, month, year] = match;
  const date = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PriceLists() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState<PriceListFile[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/price-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError("Invalid password");
        setLoading(false);
        return;
      }

      const data = await response.json();
      setFiles(data.files);
      setIsAuthenticated(true);
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  };

  const handleDownload = async (filename: string) => {
    setDownloadingFile(filename);
    try {
      const response = await fetch("/api/price-lists/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, filename }),
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setError("Failed to download file");
    }
    setDownloadingFile(null);
  };

  return (
    <div className="min-h-screen bg-[#1a1f26]">
      {/* Header */}
      <header className="px-6 md:px-[100px] lg:px-[140px] py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/images/logo.png"
            alt="The Coral Farm"
            width={40}
            height={60}
            className="transition-transform duration-300 group-hover:scale-105"
          />
          <span className="text-white font-extrabold tracking-wider hidden sm:block">
            THE CORAL FARM
          </span>
        </Link>
        <Link
          href="/"
          className="text-white/60 hover:text-white transition-colors duration-200 text-sm font-medium"
        >
          Back to Home
        </Link>
      </header>

      <main className="px-6 md:px-[100px] lg:px-[140px] py-12">
        <div className="max-w-2xl mx-auto">
          {!isAuthenticated ? (
            /* Login Form */
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 md:p-12">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#0984E3]/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-[#0984E3]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Price Lists
                </h1>
                <p className="text-white/50 max-w-md mx-auto">
                  Enter your password to access our next import lists and plan
                  your shipments.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Access Price Lists</span>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* File List */
            <div>
              <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Price Lists
                </h1>
                <p className="text-white/50">
                  {files.length} {files.length === 1 ? "file" : "files"}{" "}
                  available
                </p>
              </div>

              {files.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-white/30"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-white/50">No price lists available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((file) => (
                    <div
                      key={file.name}
                      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[16px] p-4 md:p-5 flex items-center justify-between gap-4 group hover:bg-white/[0.07] hover:border-white/15 transition-all duration-200"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-6 h-6 text-emerald-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">
                            {file.name.replace(/\s*\d{2}\.\d{2}\.\d{2}\.(xlsx?|xls)$/i, "")}
                          </p>
                          <p className="text-white/40 text-sm">
                            {formatFileSize(file.size)} &middot;{" "}
                            {extractDateFromFilename(file.name)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDownload(file.name)}
                        disabled={downloadingFile === file.name}
                        className="flex-shrink-0 px-4 py-2 bg-[#0984E3]/20 hover:bg-[#0984E3]/30 border border-[#0984E3]/30 text-[#0984E3] font-medium rounded-xl transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
                      >
                        {downloadingFile === file.name ? (
                          <div className="w-4 h-4 border-2 border-[#0984E3]/30 border-t-[#0984E3] rounded-full animate-spin" />
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        )}
                        <span className="hidden sm:inline">Download</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
