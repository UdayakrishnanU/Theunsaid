"use client";

import { useEffect } from "react";

export default function RedirectClient({ id }: { id: string }) {
  useEffect(() => {
    window.location.replace(`/#p=${id}`);
  }, [id]);

  return (
    <div style={{ padding: "80px 24px", textAlign: "center", color: "var(--faint)" }}>
      Opening the post…
    </div>
  );
}
