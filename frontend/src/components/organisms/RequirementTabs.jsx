"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AddedRequirements from "@/components/organisms/AddedRequirements";
import RequirementWatch from "@/components/organisms/RequirementWatch";
import { watchCounts } from "@/lib/watch/actions";
import { resetShown } from "@/lib/watch/custom";

function Tabs({ reference }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab = params.get("tab") === "watch" ? "watch" : "library";
  const { pending } = watchCounts();
  const fromUrl = params.get("change");
  // The open change is kept here as well as in the address, so a click opens it at once and the back button still works.
  const [change, setChange] = useState(fromUrl);
  useEffect(() => setChange(fromUrl), [fromUrl]);
  // Arriving on the page starts the watch empty, and drops an open change left in the address.
  useEffect(() => {
    resetShown();
    setChange(null);
    if (params.get("change")) router.replace(`${path}?tab=${tab}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = (t, extra = "") => router.replace(`${path}?tab=${t}${extra}`, { scroll: false });
  const switchTab = (t) => {
    if (t === "watch" && tab !== "watch") resetShown(); // opening the watch tab starts it empty
    setChange(null);
    go(t);
  };
  const select = (id) => {
    setChange(id);
    go("watch", id ? `&change=${encodeURIComponent(id)}` : "");
  };
  return (
    <>
      <div className="ev-tabs" role="tablist" aria-label="Requirements">
        <button type="button" role="tab" aria-selected={tab === "library"} className={tab === "library" ? "on" : undefined} onClick={() => switchTab("library")}>
          Requirement library
        </button>
        <button type="button" role="tab" aria-selected={tab === "watch"} className={tab === "watch" ? "on" : undefined} onClick={() => switchTab("watch")}>
          Requirement watch
          <span className="ev-count">{pending}</span>
        </button>
      </div>
      <div role="tabpanel" className="ev-panel">
        {tab === "library" ? (
          <>
            <AddedRequirements />
            {reference}
          </>
        ) : (
          <RequirementWatch selected={change} onSelect={select} />
        )}
      </div>
    </>
  );
}

/** The Requirements page's tabs: the requirement library (the existing content) and the requirement watch. */
export default function RequirementTabs(props) {
  return (
    <Suspense>
      <Tabs {...props} />
    </Suspense>
  );
}
