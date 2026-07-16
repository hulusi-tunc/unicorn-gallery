'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import {
  Eyebrow,
  GhostArrowLink,
  PrimaryPill,
  Scramble,
  SectionHeader,
} from '@/components/editorial';
import { editorialFonts, getNd } from '@/lib/tokens';

/**
 * Marketing landing — the public front door at `/`. Signed-in visitors are
 * redirected to /apps by the root page before this ever renders. Built from
 * the editorial primitives + SiteHeader/SiteFooter ported from Hubera, so the
 * aesthetic stays coherent with the rest of the gallery.
 */
export function Landing(): ReactNode {
  const { theme } = useTheme();
  const t = getNd(theme);

  const subcopy: CSSProperties = {
    margin: 0,
    maxWidth: '52ch',
    fontFamily: editorialFonts.body,
    fontSize: 'clamp(16px, 1.4vw, 19px)',
    lineHeight: 1.6,
    color: t.textSecondary,
  };

  return (
    <div style={{ background: t.black, minHeight: '100vh', color: t.textDisplay }}>
      <SiteHeader signedIn={false} />

      {/* ───────────────────────── Hero */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding:
            'clamp(140px, 18vh, 220px) clamp(24px, 5vw, 72px) clamp(80px, 10vw, 140px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        <Eyebrow tone="secondary">Unicorn Studio · Design Gallery</Eyebrow>

        <h1
          style={{
            margin: 0,
            fontFamily: editorialFonts.display,
            fontWeight: 500,
            fontSize: 'clamp(40px, 6.5vw, 84px)',
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            color: t.textDisplay,
            maxWidth: '16ch',
          }}
        >
          Every screen we ship,{' '}
          <span style={{ color: t.accent }}>
            <Scramble text="captured." trigger="mount" delay={350} />
          </span>
        </h1>

        <p style={subcopy}>
          The Mobbin-style gallery for the apps Unicorn Studio builds for its
          customers. Snap from Unicorn Capture, browse version history, and share
          a review link — without ever opening Figma.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            flexWrap: 'wrap',
            marginTop: 8,
          }}
        >
          <PrimaryPill as="link" href="/sign-in" size="lg">
            Sign in
          </PrimaryPill>
          <GhostArrowLink href="/sign-up" tone="primary">
            Create an account
          </GhostArrowLink>
        </div>
      </section>

      {/* ───────────────────────── Features */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 clamp(24px, 5vw, 72px) clamp(80px, 10vw, 140px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(40px, 5vw, 64px)',
        }}
      >
        <SectionHeader
          eyebrow="The workflow"
          title="From simulator to sign-off"
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 1,
            background: t.border,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} feature={f} t={t} />
          ))}
        </div>
      </section>

      {/* ───────────────────────── Closing CTA */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 clamp(24px, 5vw, 72px) clamp(80px, 12vw, 160px)',
        }}
      >
        <div
          style={{
            borderRadius: 24,
            border: `1px solid ${t.borderVisible}`,
            background: t.surface,
            padding: 'clamp(40px, 6vw, 80px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 24,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: editorialFonts.display,
              fontWeight: 500,
              fontSize: 'clamp(28px, 3.4vw, 44px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: t.textDisplay,
              maxWidth: '20ch',
            }}
          >
            Your apps are waiting in the gallery.
          </h2>
          <p style={{ ...subcopy, textAlign: 'center' }}>
            Sign in to review the latest screens, leave comments, and approve
            what your customers see next.
          </p>
          <PrimaryPill as="link" href="/sign-in" size="lg">
            Open the gallery
          </PrimaryPill>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

type Feature = { eyebrow: string; title: string; body: string };

const FEATURES: Feature[] = [
  {
    eyebrow: '01',
    title: 'Capture every screen',
    body: 'Push snaps straight from Unicorn Capture on your machine. The first push creates the app here automatically — no setup.',
  },
  {
    eyebrow: '02',
    title: 'Version history',
    body: 'Replace-mode pushes keep a full frame-by-frame history. Scrub between versions and see exactly what changed.',
  },
  {
    eyebrow: '03',
    title: 'Share for review',
    body: 'Send a public, no-login link of the latest version. The gallery is the design-review deliverable — Figma optional.',
  },
];

function FeatureCard({
  feature,
  t,
}: {
  feature: Feature;
  t: ReturnType<typeof getNd>;
}): ReactNode {
  return (
    <div
      style={{
        background: t.black,
        padding: 'clamp(28px, 3vw, 40px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: 220,
      }}
    >
      <Eyebrow tone="muted">{feature.eyebrow}</Eyebrow>
      <h3
        style={{
          margin: 0,
          fontFamily: editorialFonts.display,
          fontWeight: 500,
          fontSize: 'clamp(19px, 1.8vw, 23px)',
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
          color: t.textDisplay,
        }}
      >
        {feature.title}
      </h3>
      <p
        style={{
          margin: 0,
          fontFamily: editorialFonts.body,
          fontSize: 15,
          lineHeight: 1.6,
          color: t.textSecondary,
        }}
      >
        {feature.body}
      </p>
    </div>
  );
}
