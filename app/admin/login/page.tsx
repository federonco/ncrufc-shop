"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Login failed");
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Could not reach server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-md">
        <h1 className="text-xl font-black tracking-tight text-gray-900">Admin Login</h1>
        <p className="mt-1 text-sm text-gray-500">NCRUFC Shop</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="block text-xs font-bold text-gray-600">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="mt-0.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-orange-300 focus:ring-2 focus:ring-orange-100 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-bold text-gray-600">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-0.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-orange-300 focus:ring-2 focus:ring-orange-100 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] rounded-xl bg-orange-500 px-4 py-3 font-black text-white shadow-sm hover:bg-orange-600 transition disabled:opacity-50 active:translate-y-px"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <Link
          href="/shop"
          className="mt-4 block text-center text-sm text-gray-500 hover:text-orange-600 transition"
        >
          ← Back to shop
        </Link>
      </div>
    </div>
  );
}
