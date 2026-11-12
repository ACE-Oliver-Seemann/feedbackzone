import Link from "next/link";
import { t } from "@/lib/texts.sk";

export const metadata = { title: t.errors.notFoundTitle };

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-sm font-semibold text-teal-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold">{t.errors.notFoundTitle}</h1>
      <p className="mt-2 text-slate-600">{t.errors.notFoundText}</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-teal-700 px-4 py-3 text-sm font-medium text-white hover:bg-teal-800"
      >
        {t.errors.backHome}
      </Link>
    </main>
  );
}
