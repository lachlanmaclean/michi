import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Search, FileDown, Grid3x3, Sparkles, Printer, Combine, Coffee } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { fetchExportTally } from '@/utils/exportTally';

const FEATURES = [
  {
    icon: Combine,
    title: 'Multi-pocket custom art',
    description:
      'Combine adjacent pockets into one seamless panel for hero cards, extended artwork, and Michi Method-style spreads.',
  },
  {
    icon: Search,
    title: 'Search real card sets',
    description:
      'Look up official Pokémon cards by set and add them straight into your binder layout — no manual uploads needed.',
  },
  {
    icon: Grid3x3,
    title: 'Flexible grid layouts',
    description:
      'Choose 9-pocket, 8-pocket, 2×2 jumbo, 12-pocket, or define a fully custom row/column grid for any binder style.',
  },
  {
    icon: Sparkles,
    title: 'Crop, zoom & position',
    description:
      'Fine-tune every card image with pan, zoom, and combine tools so artwork lines up perfectly across pockets.',
  },
  {
    icon: Printer,
    title: 'Print-accurate output',
    description:
      'Cards render at exact standard trading card size (2.5" × 3.5") with optional crop marks and safe-area guides.',
  },
  {
    icon: FileDown,
    title: 'Export straight to PDF',
    description:
      'Generate a print-ready, multi-page PDF sized to Letter or A4 in one click — ready to take to any print shop.',
  },
];

const FAQS = [
  {
    q: 'What is the Michi Method?',
    a: 'The Michi Method is a popular way to design Pokémon binder pages where, instead of filling every pocket with a single card, you combine several pockets into one custom panel — a hero card, extended artwork, or a themed spread — mixed with regular single-card pockets and intentional negative space. Bindermon’s pocket-combining and crop tools are built specifically for laying out Michi Method pages.',
  },
  {
    q: 'Is Bindermon free to use?',
    a: 'Yes. Bindermon is completely free with no signup required. All binder data is stored locally in your browser.',
  },
  {
    q: 'What binder sizes does it support?',
    a: 'Standard 9-pocket, 8-pocket, 2×2 jumbo, and 12-pocket presets are built in, or you can set a custom row and column count for any binder page size.',
  },
  {
    q: 'Can I use my own card images?',
    a: 'Yes. You can upload your own images for any slot, or search official Pokémon card sets to add real card artwork directly.',
  },
  {
    q: 'Will the printed cards be the correct size?',
    a: 'Yes. Cards are laid out at exact standard trading card dimensions (2.5" × 3.5") so printed pages match real card sleeves and pocket pages.',
  },
  {
    q: 'What paper size can I export to?',
    a: 'Bindermon supports Letter and A4 page sizes, with the option to swap between portrait and landscape orientation before exporting your PDF.',
  },
];

export function LandingPage() {
  const [exportCount, setExportCount] = useState<number | null>(null);

  useEffect(() => {
    fetchExportTally().then(setExportCount);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-6 py-4">
        <LayoutGrid className="size-5 text-primary" />
        <span className="text-lg font-semibold tracking-tight">Bindermon</span>
        <nav className="ml-auto flex items-center gap-2">
          <a
            href="https://ko-fi.com/xhunternz"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Coffee className="size-4" />
            Consider supporting me
          </a>
          <Link to="/app" className={buttonVariants({ variant: 'default', size: 'sm' })}>
            Open Bindermon
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">
            Design Michi Method Pokémon Binders, Export a Print-Ready PDF
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-balance">
            Bindermon is a free, browser-based binder page creator built for the Michi Method —
            combine pockets into custom hero-card panels and themed spreads, search official
            Pokémon card sets, and export a print-ready PDF sized exactly for standard binder
            pages. No signup, no watermark.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/app" className={buttonVariants({ variant: 'default', size: 'lg' })}>
              Open Bindermon
            </Link>
          </div>
        </section>

        <section className="border-t border-border px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-center">
              Built for the Michi Method
            </h2>
            <p className="mt-4 text-muted-foreground text-center text-balance">
              The Michi Method is a popular way to lay out Pokémon binder pages: instead of one
              card per pocket, you combine several adjacent pockets into a single custom panel —
              a hero card, extended artwork, or a themed spread — mixed with regular single-card
              pockets and intentional negative space. Bindermon's pocket-combining, cropping, and
              positioning tools make it easy to design your own Michi Method binder pages and
              print them at exact card size.
            </p>
          </div>
        </section>

        <section className="border-t border-border bg-sidebar px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold tracking-tight text-center">
              Everything you need to build a printable binder
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-xl border border-border bg-card p-5">
                  <Icon className="size-5 text-primary" />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-center">
              How it works
            </h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3 text-center">
              <li>
                <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  1
                </div>
                <h3 className="mt-3 font-medium">Pick a grid layout</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Choose a preset pocket layout or set a custom row and column count.
                </p>
              </li>
              <li>
                <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  2
                </div>
                <h3 className="mt-3 font-medium">Add your cards</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Search official sets or upload your own images into each pocket.
                </p>
              </li>
              <li>
                <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  3
                </div>
                <h3 className="mt-3 font-medium">Export your PDF</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Download a print-ready PDF sized exactly for standard cards.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="border-t border-border bg-sidebar px-6 py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-center">
              Frequently asked questions
            </h2>
            <Accordion className="mt-8">
              {FAQS.map(({ q, a }) => (
                <AccordionItem key={q} value={q}>
                  <AccordionTrigger className="text-left">{q}</AccordionTrigger>
                  <AccordionContent>{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Ready to build your binder?</h2>
          <p className="mt-2 text-muted-foreground">Free to use, right in your browser.</p>
          <div className="mt-6">
            <Link to="/app" className={buttonVariants({ variant: 'default', size: 'lg' })}>
              Open Bindermon
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        Not affiliated with, endorsed, sponsored, or specifically approved by The Pokémon Company,
        Nintendo, or Game Freak. All card images belong to their respective owners.
        {exportCount !== null && (
          <p className="mt-2 opacity-60">{exportCount.toLocaleString()} binders exported to date</p>
        )}
      </footer>
    </div>
  );
}
