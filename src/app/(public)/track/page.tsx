import { TrackForm } from "@/components/TrackForm";
import { SectionHead } from "@/components/public/PublicPage";
export const metadata = { title: "অর্ডার ট্র্যাকিং" };
export default function TrackPage() { return <section className="mx-auto max-w-[1000px] px-4 py-12 sm:px-6"><SectionHead eyebrow="অর্ডার ট্র্যাকিং" title="অর্ডারের অবস্থা দেখুন" sub="অর্ডারের ফোন নম্বর ও অর্ডার নম্বর দিন।" /><TrackForm /></section>; }