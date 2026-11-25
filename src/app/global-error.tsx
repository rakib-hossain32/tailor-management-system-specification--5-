"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { toast.error("এই মুহূর্তে পাতা খোলা যাচ্ছে না। আবার চেষ্টা করুন।", { id: "global-error" }); }, []);
  return <html lang="bn"><body><Toaster richColors closeButton /><main style={{ maxWidth: 560, margin: "80px auto", padding: 24, fontFamily: "sans-serif" }}><h1>পাতা খোলা যাচ্ছে না</h1><p>কিছুক্ষণ পরে আবার চেষ্টা করুন।</p><button onClick={reset}>আবার চেষ্টা করুন</button></main></body></html>;
}
