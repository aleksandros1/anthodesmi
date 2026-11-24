"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Bouquet = dynamic(() => import("@/components/Bouquet"), { ssr: false });

export default function Home() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return <main className="stage">{ready && <Bouquet />}</main>;
}