"use client";

/**
 * Editorial primitives — project-specific, NOT part of the synced ui/ library.
 * Every surface in the Hubera app should reach for these first so the
 * aesthetic stays coherent with the landing hero.
 *
 * Tokens are pulled from `getNd()` / `editorialFonts` so anything added here
 * automatically follows the theme.
 */

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type ComponentProps,
} from "react";
import { useTheme } from "@/components/providers/theme-provider";
import { getNd, editorialFonts } from "@/lib/tokens";

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("oklch(")) {
    const inner = color.slice("oklch(".length, -1).trim();
    return `oklch(${inner} / ${alpha})`;
  }
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const expanded =
      hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    if (expanded.length !== 6) return color;
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

/* ───────────────────────────────────────── Text input — borderless fill */

type TextInputProps = Omit<
  ComponentProps<"input">,
  "style" | "ref" | "className" | "size"
> & {
  size?: "md" | "lg";
};

export function TextInput({ size = "md", ...rest }: TextInputProps) {
  const { theme } = useTheme();
  const t = getNd(theme);
  const [focused, setFocused] = useState(false);

  const base: CSSProperties = {
    width: "100%",
    padding: size === "lg" ? "15px 21px" : "13px 19px",
    background: focused ? t.surfaceRaised : t.surface,
    border: `1px solid ${focused ? t.accent : t.borderVisible}`,
    borderRadius: 12,
    fontFamily: editorialFonts.body,
    fontSize: size === "lg" ? 16 : 15,
    lineHeight: 1.2,
    color: t.textDisplay,
    outline: "none",
    boxShadow: focused ? `0 0 0 3px ${withAlpha(t.accent, 0.18)}` : "none",
    transition:
      "background 200ms cubic-bezier(0.165, 0.84, 0.44, 1), border-color 200ms cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 200ms cubic-bezier(0.165, 0.84, 0.44, 1)",
    boxSizing: "border-box",
  };

  return (
    <input
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={base}
    />
  );
}

/* ───────────────────────────────────────── Text area — borderless fill */

type TextAreaProps = Omit<
  ComponentProps<"textarea">,
  "style" | "ref" | "className"
> & {
  size?: "md" | "lg";
};

export function TextArea({ size = "md", rows = 4, ...rest }: TextAreaProps) {
  const { theme } = useTheme();
  const t = getNd(theme);
  const [focused, setFocused] = useState(false);

  const base: CSSProperties = {
    width: "100%",
    padding: size === "lg" ? "15px 21px" : "13px 19px",
    background: focused ? t.surfaceRaised : t.surface,
    border: `1px solid ${focused ? t.accent : t.borderVisible}`,
    boxShadow: focused ? `0 0 0 3px ${withAlpha(t.accent, 0.18)}` : "none",
    borderRadius: 12,
    fontFamily: editorialFonts.body,
    fontSize: size === "lg" ? 16 : 15,
    lineHeight: 1.5,
    color: t.textDisplay,
    outline: "none",
    resize: "vertical",
    transition:
      "background 200ms cubic-bezier(0.165, 0.84, 0.44, 1), border-color 200ms cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 200ms cubic-bezier(0.165, 0.84, 0.44, 1)",
    boxSizing: "border-box",
  };

  return (
    <textarea
      {...rest}
      rows={rows}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={base}
    />
  );
}

/* ───────────────────────────────────────── Text scramble (decrypt reveal) */

const SCRAMBLE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function noiseFor(text: string) {
  return Array.from(text)
    .map((ch) =>
      /\s/.test(ch)
        ? ch
        : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
    )
    .join("");
}

/**
 * Decrypts text with a per-character scramble. Starts fully scrambled,
 * animates to the real text on viewport entry. Length never changes so
 * layout stays fixed.
 */
export function Scramble({
  text,
  speed = 1,
  trigger = "in-view",
  delay = 250,
  className,
  style,
}: {
  text: string;
  /** Multiplier — 0.5 slower, 2 faster. Defaults target ~2.4s total. */
  speed?: number;
  /** `in-view` waits for IntersectionObserver; `mount` fires immediately. */
  trigger?: "in-view" | "mount";
  /** ms to hold fully-scrambled state before the reveal begins. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  // Start with the real text so SSR and first client render match (Math.random
  // during state init would produce different strings on server vs client).
  // We swap to noise on the client right before the animation kicks off.
  const [display, setDisplay] = useState(text);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || startedRef.current) return;

    // Respect reduced-motion preference: skip straight to final.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      startedRef.current = true;
      setDisplay(text);
      return;
    }

    const run = () => {
      if (startedRef.current) return;
      startedRef.current = true;

      // Swap to noise on the client, just before the first frame of the reveal.
      // Safe here because this runs inside useEffect — never during SSR/hydration.
      setDisplay(noiseFor(text));

      // Strict left-to-right sequencing. Each character waits its turn, then
      // scrambles through random letters/digits for a fixed window before
      // locking to the real value.
      const stagger = Math.max(1, Math.round(3 / speed));
      const scrambleFrames = Math.max(8, Math.round(28 / speed));
      const queue = Array.from(text).map((ch, i) => {
        const start = i * stagger;
        const end = start + scrambleFrames;
        return { char: ch, start, end, scrambled: "" };
      });

      let frame = 0;
      const tick = () => {
        let output = "";
        let complete = 0;
        for (const item of queue) {
          if (frame >= item.end) {
            complete++;
            output += item.char;
          } else if (frame >= item.start) {
            if (/\s/.test(item.char)) {
              output += item.char;
            } else {
              // Gentle glyph swap — less flicker, more wave.
              if (!item.scrambled || Math.random() < 0.08) {
                item.scrambled =
                  (SCRAMBLE_CHARS[
                    Math.floor(Math.random() * SCRAMBLE_CHARS.length)
                  ] ?? "?");
              }
              output += item.scrambled;
            }
          } else {
            // Pre-start: hold the initial noise steady — no jitter before reveal.
            if (/\s/.test(item.char)) {
              output += item.char;
            } else {
              if (!item.scrambled) {
                item.scrambled =
                  (SCRAMBLE_CHARS[
                    Math.floor(Math.random() * SCRAMBLE_CHARS.length)
                  ] ?? "?");
              }
              output += item.scrambled;
            }
          }
        }
        setDisplay(output);
        if (complete === queue.length) {
          rafRef.current = null;
          return;
        }
        frame++;
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (delay > 0) {
        timerRef.current = window.setTimeout(run, delay);
      } else {
        run();
      }
    };

    if (trigger === "mount") {
      schedule();
      return () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) schedule();
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, speed, trigger, delay]);

  return (
    <span ref={rootRef} className={className} style={style}>
      {display}
    </span>
  );
}

/* ───────────────────────────────────────── Eyebrow (mono label) */

export function Eyebrow({
  children,
  tone = "muted",
  as: Tag = "span",
  style,
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "secondary";
  as?: "span" | "div" | "p";
  style?: CSSProperties;
}) {
  const { theme } = useTheme();
  const t = getNd(theme);
  const color =
    tone === "primary"
      ? t.textDisplay
      : tone === "secondary"
      ? t.textSecondary
      : t.textDisabled;
  return (
    <Tag
      style={{
        fontFamily: editorialFonts.mono,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color,
        fontWeight: 400,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/* ───────────────────────────────────────── Rule (divider) */

export function Rule({
  orientation = "horizontal",
  tone = "subtle",
  style,
}: {
  orientation?: "horizontal" | "vertical";
  tone?: "subtle" | "visible" | "strong";
  style?: CSSProperties;
}) {
  const { theme } = useTheme();
  const t = getNd(theme);
  const color =
    tone === "strong"
      ? t.borderStrong
      : tone === "visible"
      ? t.borderVisible
      : t.border;
  return (
    <span
      role="separator"
      aria-hidden
      style={{
        display: "block",
        background: color,
        ...(orientation === "horizontal"
          ? { height: 1, width: "100%" }
          : { width: 1, alignSelf: "stretch", minHeight: "100%" }),
        ...style,
      }}
    />
  );
}

/* ───────────────────────────────────────── Section header */

export function SectionHeader({
  eyebrow,
  title,
  link,
  level = 2,
}: {
  eyebrow?: string;
  title: string;
  link?: { label: string; href: string };
  level?: 2 | 3;
}) {
  const { theme } = useTheme();
  const t = getNd(theme);
  const Heading = level === 3 ? "h3" : "h2";
  const size =
    level === 3 ? "clamp(20px, 1.8vw, 26px)" : "clamp(24px, 2.4vw, 34px)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Heading
          style={{
            margin: 0,
            fontFamily: editorialFonts.display,
            fontWeight: 500,
            fontSize: size,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: t.textDisplay,
          }}
        >
          {title}
        </Heading>
      </div>
      {link ? (
        <GhostArrowLink href={link.href}>{link.label}</GhostArrowLink>
      ) : null}
    </div>
  );
}

/* ───────────────────────────────────────── PrimaryPill CTA */

type PrimaryPillProps = {
  children: ReactNode;
  size?: "md" | "lg";
  trailingArrow?: boolean;
  fullWidth?: boolean;
} & (
  | ({ as?: "link"; href: string } & Omit<
      ComponentProps<typeof Link>,
      "children" | "href"
    >)
  | ({ as: "button" } & Omit<
      ComponentProps<"button">,
      "children" | "style"
    >)
);

export function PrimaryPill(props: PrimaryPillProps) {
  const {
    children,
    size = "md",
    trailingArrow = true,
    fullWidth = false,
    ...rest
  } = props;
  const { theme } = useTheme();
  const t = getNd(theme);
  const [hovered, setHovered] = useState(false);

  const style: CSSProperties = {
    display: fullWidth ? "flex" : "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: fullWidth ? "100%" : undefined,
    fontFamily: editorialFonts.body,
    fontSize: size === "lg" ? 16 : 15,
    fontWeight: 500,
    color: t.accentFg,
    textDecoration: "none",
    padding: size === "lg" ? "14px 26px" : "12px 22px",
    borderRadius: 9999,
    background: hovered ? t.accentHover : t.accent,
    border: "none",
    cursor: "pointer",
    transition:
      "background 220ms cubic-bezier(0.165, 0.84, 0.44, 1), transform 220ms cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 220ms cubic-bezier(0.165, 0.84, 0.44, 1)",
    transform: hovered ? "translateY(-1px)" : "translateY(0)",
    boxShadow: hovered
      ? `0 8px 24px -6px ${t.accent}, 0 2px 4px rgba(0,0,0,0.08)`
      : "0 0 0 0 rgba(0,0,0,0)",
  };

  const content = (
    <>
      {children}
      {trailingArrow ? <span aria-hidden>→</span> : null}
    </>
  );

  if ("as" in rest && rest.as === "button") {
    const { as: _discard, ...buttonRest } = rest;
    void _discard;
    return (
      <button
        {...buttonRest}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={style}
      >
        {content}
      </button>
    );
  }

  const { as: _link, href, ...linkRest } = rest as {
    as?: "link";
    href: string;
  } & Omit<ComponentProps<typeof Link>, "children" | "href">;
  void _link;

  return (
    <Link
      {...linkRest}
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={style}
    >
      {content}
    </Link>
  );
}

/* ───────────────────────────────────────── Ghost arrow link (mono) */

export function GhostArrowLink({
  href,
  children,
  direction = "forward",
  tone = "secondary",
  style,
}: {
  href: string;
  children: ReactNode;
  direction?: "forward" | "back";
  tone?: "secondary" | "primary" | "muted";
  style?: CSSProperties;
}) {
  const { theme } = useTheme();
  const t = getNd(theme);
  const [hovered, setHovered] = useState(false);
  const baseColor =
    tone === "primary"
      ? t.textPrimary
      : tone === "muted"
      ? t.textDisabled
      : t.textSecondary;
  const hoverColor = t.textDisplay;

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: editorialFonts.mono,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: hovered ? hoverColor : baseColor,
        textDecoration: "none",
        transition: "color 200ms cubic-bezier(0.165, 0.84, 0.44, 1)",
        ...style,
      }}
    >
      {direction === "back" ? <span aria-hidden>←</span> : null}
      {children}
      {direction === "forward" ? <span aria-hidden>→</span> : null}
    </Link>
  );
}

/* ───────────────────────────────────────── Copyable command pill */

export function CopyCommand({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Copy install command"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px 12px 18px",
        background: hovered
          ? "rgba(10,10,14,0.92)"
          : "rgba(10,10,14,0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 9999,
        color: "#ffffff",
        fontFamily: editorialFonts.mono,
        fontSize: "clamp(12px, 0.95vw, 14px)",
        letterSpacing: "-0.005em",
        cursor: "pointer",
        transition:
          "background 220ms cubic-bezier(0.165, 0.84, 0.44, 1), transform 220ms cubic-bezier(0.165, 0.84, 0.44, 1)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.12)",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.45)" }}>$</span>
      <span style={{ whiteSpace: "nowrap" }}>{cmd}</span>
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 9999,
          background: copied
            ? "rgba(80,200,120,0.22)"
            : "rgba(255,255,255,0.08)",
          color: copied ? "rgb(120,220,160)" : "rgba(255,255,255,0.8)",
          transition: "background 180ms ease, color 180ms ease",
        }}
      >
        {copied ? (
          <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8.5 6.5 12 13 5"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
            <rect
              x={5}
              y={5}
              width={9}
              height={9}
              rx={1.5}
              stroke="currentColor"
              strokeWidth={1.3}
            />
            <path
              d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"
              stroke="currentColor"
              strokeWidth={1.3}
            />
          </svg>
        )}
      </span>
    </button>
  );
}
