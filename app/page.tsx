"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Bouquet = dynamic(() => import("@/components/Bouquet"), { ssr: false });

export default function Home() {
  // το 3D μπουκέτο φορτώνει μόνο στον browser (όχι στο prerender του build)
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <main className="stage" style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }}>
      {ready && <Bouquet />}
    </main>
  );
}