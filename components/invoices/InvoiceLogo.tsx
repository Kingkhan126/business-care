"use client";

import * as React from "react";
import { invoiceLogoSource } from "@/lib/branding/invoice-logo";

function LoadedInvoiceLogo({ src, name }: { src: string; name: string }) {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const imageRef = React.useCallback((image: HTMLImageElement | null) => {
    if (image?.complete) {
      if (image.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    }
  }, []);
  if (failed) return null;
  return (
    // Native image loading preserves signed/data URLs and works unchanged in browser PDF output.
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={imageRef} src={src} alt={`${name} logo`} data-invoice-logo loading="eager" decoding="sync"
      onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
      style={{ display: loaded ? "block" : "none", maxWidth: "min(160px, 100%)", width: "auto", height: "auto", maxHeight: 72, objectFit: "contain", marginBottom: 12 }} />
  );
}

export function InvoiceLogo({ logoUrl, name }: { logoUrl?: string | null; name: string }) {
  const source = invoiceLogoSource(logoUrl);
  return source ? <LoadedInvoiceLogo key={source} src={source} name={name} /> : null;
}
