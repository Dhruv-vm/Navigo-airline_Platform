"use client"

/**
 * Client-side helper for administrative console requests.
 * Extracts the verified admin JWT from localStorage.
 */
export function getAdminAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("navigo_admin_token") || localStorage.getItem("token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}
