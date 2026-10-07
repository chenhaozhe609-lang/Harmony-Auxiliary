// The multi-screen landing narrative (TASK6 §9):
//   hook (hero) → let me try (demo) → who it's for (bento) → what it does
//   (carousel) → act (CTA).
// English-only copy, monochrome black + ivory, scroll-snapped screens, and a
// single WebGL field (FloatingLines) that pauses when scrolled offscreen.
import { useEffect, useRef, useState } from "react";
import {
  FiBookOpen,
  FiDownload,
  FiEdit3,
  FiHeadphones,
  FiLayers,
  FiUploadCloud,
} from "react-icons/fi";
import FloatingLines from "../FloatingLines";
import Carousel, { type CarouselItem } from "./Carousel";
import HarmonyDemo from "./HarmonyDemo";
import "./Landing.css";

type LandingProps = {
  onEnterWorkspace: () => void;
  onEnterDemo: () => void;
  prefersReducedMotion: boolean;
};

const PERSONAS = [
  {
    tag: "01",
    name: "Composers",
    need: "Sketch a melody and hear full, theory-aware harmony in seconds.",
  },
  {
    tag: "02",
    name: "Content creators",
    need: "Turn a hummed idea into a finished progression to score your work.",
  },
  {
    tag: "03",
    name: "Students",
    need: "See the why behind every chord — function, fit, and voice leading.",
  },
];

const FEATURES: CarouselItem[] = [
  { id: 1, icon: <FiUploadCloud />, title: "Import MIDI", description: "Drop in a MIDI sketch and pick the melody track to harmonise." },
  { id: 2, icon: <FiEdit3 />, title: "Manual input", description: "No file? Place notes on the roll and build a phrase by hand." },
  { id: 3, icon: <FiLayers />, title: "Three styles", description: "Generate classical, pop, and colour-tension takes side by side." },
  { id: 4, icon: <FiHeadphones />, title: "Audition", description: "Play melody and harmony together with sampled or synth voices." },
  { id: 5, icon: <FiDownload />, title: "Export MIDI", description: "Send the result back out as MIDI, ready for your DAW." },
  { id: 6, icon: <FiBookOpen />, title: "Theory shown", description: "Every chord carries its function, roman numeral, and melody fit." },
];

export default function Landing({
  onEnterWorkspace,
  onEnterDemo,
  prefersReducedMotion,
}: LandingProps) {
  const [scrolled, setScrolled] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const [carouselWidth, setCarouselWidth] = useState(420);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);

  // Float-nav state: a touch more solid once the hero is left behind.
  useEffect(() => {
    const node = shellRef.current;
    if (!node) return;
    const onScroll = () => setScrolled(node.scrollTop > 40);
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  // Pause the WebGL field whenever the hero scrolls out of view (perf budget).
  useEffect(() => {
    const node = heroRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const measure = () => setCarouselWidth(Math.min(460, window.innerWidth - 48));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className="landing-shell landing-v2 stage-atmosphere" ref={shellRef}>
      <header
        className={`glass-nav ${scrolled ? "is-scrolled" : ""}`}
        aria-label="Landing navigation"
      >
        <div className="glass-nav-brand">
          <span className="brand-mark">H</span>
          <span className="glass-nav-name">Harmony Auxiliary</span>
        </div>
        <div className="glass-nav-actions">
          <button type="button" className="primary-button glass-nav-cta" onClick={onEnterWorkspace}>
            Open workspace
          </button>
        </div>
      </header>

      {/* 1 · Hero ------------------------------------------------------------ */}
      <section
        className="screen hero-screen"
        ref={heroRef}
        aria-label="Harmony Auxiliary"
      >
        <div className="hero-field" aria-hidden="true">
          <FloatingLines
            linesGradient={["#f3eee3", "#d7d1c5", "#a7a298"]}
            enabledWaves={["top", "middle", "bottom"]}
            lineCount={[6, 9, 12]}
            lineDistance={[8, 6, 5]}
            animationSpeed={prefersReducedMotion ? 0 : 0.42}
            interactive={!prefersReducedMotion}
            parallax={!prefersReducedMotion}
            bendRadius={6}
            bendStrength={-0.5}
            mixBlendMode="screen"
            paused={!heroVisible}
          />
        </div>
        <div className="hero-copy">
          <span className="landing-kicker">MIDI in · Harmony out</span>
          <h1 className="hero-title">
            Harmony, <span className="hero-grad">heard.</span>
          </h1>
          <p className="hero-sub">
            Shape a melody or MIDI sketch into playable harmony, the theory shown for every chord.
          </p>
          <p className="hero-tagline">Import · Generate · Audition · Export</p>
          <div className="hero-cta-row">
            <button type="button" className="primary-button" onClick={onEnterWorkspace}>
              Start harmonizing
            </button>
            <button type="button" className="ghost-button" onClick={onEnterDemo}>
              Try the demo
            </button>
          </div>
        </div>
      </section>

      {/* 2 · Interactive demo ----------------------------------------------- */}
      <section className="screen demo-screen" aria-label="Try harmony generation">
        <div className="screen-head">
          <span className="eyebrow">Let me try it</span>
          <h2>Generate harmony, right here.</h2>
        </div>
        <HarmonyDemo prefersReducedMotion={prefersReducedMotion} />
      </section>

      {/* 3 · Personas bento ------------------------------------------------- */}
      <section className="screen bento-screen" aria-label="Who it is for">
        <div className="screen-head">
          <span className="eyebrow">Who it's for</span>
          <h2>Made for the people who shape sound.</h2>
        </div>
        <div className="persona-bento">
          {PERSONAS.map((persona) => (
            <article key={persona.tag} className="persona-cell">
              <span className="persona-tag">{persona.tag}</span>
              <h3>{persona.name}</h3>
              <p>{persona.need}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 4 · Feature carousel ----------------------------------------------- */}
      <section className="screen carousel-screen" aria-label="What it does">
        <div className="screen-head">
          <span className="eyebrow">What it does</span>
          <h2>A compact harmony workflow.</h2>
        </div>
        <Carousel
          items={FEATURES}
          baseWidth={carouselWidth}
          autoplay={!prefersReducedMotion}
          autoplayDelay={4200}
          pauseOnHover
          loop
        />
      </section>

      {/* 5 · CTA ------------------------------------------------------------ */}
      <section className="screen cta-screen" aria-label="Get started">
        <h2 className="cta-title">Hear your next idea.</h2>
        <p className="cta-sub">A melody is all it takes.</p>
        <button type="button" className="primary-button cta-button" onClick={onEnterWorkspace}>
          Open the workspace
        </button>
      </section>
    </div>
  );
}
