"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { bootRuntime, setRouterPush } from "@/lib/runtime";

// Boots the client runtime once (programme store, 3D twin hooks) and gives
// in-app navigation the Next router.
export default function AppRuntime() {
  const router = useRouter();
  useEffect(() => {
    setRouterPush((path, opts) => router.push(path, opts));
    bootRuntime();
  }, [router]);
  return null;
}
