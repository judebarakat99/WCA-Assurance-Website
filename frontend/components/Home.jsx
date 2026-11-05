"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import AppView from "./AppView";
import {pathFor} from "../lib/engine";

// The home page shows the Readiness Room (the original default view) and
// redirects old hash bookmarks (#tower, #venue-RUH, ...) to their new routes.
export default function Home(){
  const router=useRouter();
  const [redirecting,setRedirecting]=useState(false);
  useEffect(()=>{
    const h=(window.location.hash||"").replace("#","");
    if(h&&h!=="readiness"){
      setRedirecting(true);
      router.replace(pathFor(h));
    }
  },[router]);
  if(redirecting) return <main className="wrap" id="view"></main>;
  return <AppView view="readiness" />;
}
