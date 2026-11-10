"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { bootRuntime, setRouterPush } from "@/legacy/engine";

// Boots the shared client runtime once (programme store, document listeners,
// assistant, 3D twin hooks) and gives in-app navigation the Next router.
export default function AppRuntime() {
  const router = useRouter();
  useEffect(() => {
    setRouterPush((path, opts) => router.push(path, opts));
    bootRuntime();
  }, [router]);
  return null;
}
