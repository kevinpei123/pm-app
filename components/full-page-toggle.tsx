"use client";

import { useEffect } from "react";

export default function FullPageToggle({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    document.body.dataset.fullPage = "true";
    return () => {
      delete document.body.dataset.fullPage;
    };
  }, [enabled]);

  return null;
}
