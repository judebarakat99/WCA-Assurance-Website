"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";
import AppView from "./AppView";
import {pathFor} from "../lib/engine";

// The home page shows the Readiness Room (the original default view) and
// redirects old hash bookmarks (#tower, #venue-RUH, ...) to their new routes.
export default function Home(){
  const router=useRouter();
  useEffect(()=>{
    const h=(window.location.hash||"").replace("#","");
    if(h&&h!=="readiness"){
      router.replace(pathFor(h));
    }
  },[router]);
  return <AppView view="readiness" />;
}
