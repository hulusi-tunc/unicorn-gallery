/* eslint-disable @typescript-eslint/no-floating-promises */
// Generates a realistic-looking fixture so the viewer demo has something
// visually meaningful to render. Run with: pnpm fixture:gen
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const FIXTURE_DIR = '.fixture';
const VIEWPORT = { width: 390, height: 844 };

interface FixtureFrame {
  id: string;
  name: string;
  render: () => string;
}
interface FixtureFlow {
  id: string;
  name: string;
  frames: FixtureFrame[];
}

const FLOWS: FixtureFlow[] = [
  {
    id: 'onboarding',
    name: 'Onboarding',
    frames: [
      { id: '01-welcome', name: 'Welcome', render: () => screen('Folleli', 'Find your perfect court.', '#0F172A', heroBlock('🎾', 'Tap to begin', '#F472B6')) },
      { id: '02-signup', name: 'Sign Up', render: () => screen('Create account', '', '#0F172A', formBlock(['Full name', 'Email', 'Password'], 'Continue', '#F472B6')) },
      { id: '03-permissions', name: 'Notifications', render: () => screen('Stay in the loop', 'We will notify you about court openings and bookings.', '#0F172A', buttonBlock('Allow notifications', '#F472B6', 'Not now')) },
      { id: '04-profile', name: 'Profile Set Up', render: () => screen('Almost there', 'Pick a skill level so we can match you with the right courts.', '#0F172A', pillsBlock(['Beginner', 'Intermediate', 'Advanced', 'Pro'], 1)) },
    ],
  },
  {
    id: 'booking',
    name: 'Padel Booking',
    frames: [
      { id: '01-court-list', name: 'Court List', render: () => screen('Tonight', 'Padel · Within 5km', '#0F172A', courtsBlock()) },
      { id: '02-court-detail', name: 'Court Detail', render: () => screen('Court 3', 'Glass walls · Premium · €12/hr', '#0F172A', courtDetailBlock()) },
      { id: '03-time', name: 'Pick a Time', render: () => screen('Pick a time', 'Tomorrow', '#0F172A', timeGridBlock()) },
      { id: '04-payment', name: 'Payment', render: () => screen('Confirm', 'Court 3 · Tomorrow 6pm · €12.00', '#0F172A', paymentBlock()) },
      { id: '05-confirmed', name: 'Confirmed', render: () => screen('You\'re booked!', 'See you on the court.', '#10B981', confirmationBlock()) },
    ],
  },
  {
    id: 'my-bookings',
    name: 'My Bookings',
    frames: [
      { id: '01-empty', name: 'Empty State', render: () => screen('No bookings yet', 'Book your first court to see it here.', '#0F172A', emptyStateBlock()) },
      { id: '02-list', name: 'Bookings List', render: () => screen('My bookings', '', '#0F172A', bookingListBlock()) },
      { id: '03-detail', name: 'Booking Detail', render: () => screen('Court 3', 'Tomorrow · 6:00 PM · 1 hour', '#0F172A', bookingDetailBlock()) },
    ],
  },
];

function screen(title: string, subtitle: string, bg: string, content: string): string {
  return `<!DOCTYPE html>
<html><head><style>
  * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
  body { margin: 0; font-family: -apple-system, "SF Pro Display", BlinkMacSystemFont, sans-serif; background: ${bg}; color: #fff; min-height: 100vh; display: flex; flex-direction: column; }
  .status { display: flex; justify-content: space-between; padding: 14px 24px 8px; font-size: 15px; font-weight: 600; }
  .header { padding: 20px 24px 8px; }
  .title { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
  .subtitle { margin-top: 6px; font-size: 15px; color: rgba(255,255,255,0.6); line-height: 1.4; }
  .content { flex: 1; padding: 16px 24px 32px; }
  .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; }
  .pink-bg { background: linear-gradient(180deg, rgba(244,114,182,0.18), transparent); }
</style></head><body>
  <div class="status"><span>9:41</span><span>•••• 5G  ▮</span></div>
  <div class="header"><div class="title">${escapeHtml(title)}</div>${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}</div>
  <div class="content">${content}</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function heroBlock(emoji: string, label: string, accent: string): string {
  return `<div style="margin-top:60px;display:flex;flex-direction:column;align-items:center;gap:24px">
    <div style="width:120px;height:120px;border-radius:32px;background:${accent};display:flex;align-items:center;justify-content:center;font-size:64px">${emoji}</div>
    <div style="text-align:center"><div style="font-size:18px;font-weight:600">${label}</div></div>
    <button style="margin-top:80px;background:${accent};color:#fff;border:0;border-radius:14px;padding:16px 24px;font-size:17px;font-weight:600;width:100%">Get started</button>
  </div>`;
}

function formBlock(labels: string[], cta: string, accent: string): string {
  return `<div style="display:flex;flex-direction:column;gap:14px;margin-top:16px">
    ${labels.map(l => `<div class="card"><div style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em">${l}</div><div style="height:24px"></div></div>`).join('')}
    <button style="margin-top:8px;background:${accent};color:#fff;border:0;border-radius:14px;padding:16px;font-size:17px;font-weight:600">${cta}</button>
  </div>`;
}

function buttonBlock(primary: string, accent: string, secondary: string): string {
  return `<div style="margin-top:120px;display:flex;flex-direction:column;gap:12px">
    <button style="background:${accent};color:#fff;border:0;border-radius:14px;padding:16px;font-size:17px;font-weight:600">${primary}</button>
    <button style="background:transparent;color:rgba(255,255,255,0.6);border:0;padding:16px;font-size:15px">${secondary}</button>
  </div>`;
}

function pillsBlock(labels: string[], activeIdx: number): string {
  return `<div style="margin-top:40px;display:flex;flex-direction:column;gap:12px">
    ${labels.map((l, i) => `<div style="background:${i === activeIdx ? '#F472B6' : 'rgba(255,255,255,0.06)'};border:1px solid ${i === activeIdx ? '#F472B6' : 'rgba(255,255,255,0.08)'};border-radius:14px;padding:18px;font-size:17px;font-weight:600">${l}${i === activeIdx ? '  ✓' : ''}</div>`).join('')}
  </div>`;
}

function courtsBlock(): string {
  const courts = [
    { num: 1, status: '€10', avail: 'Available now', accent: '#10B981' },
    { num: 2, status: '€10', avail: 'Available now', accent: '#10B981' },
    { num: 3, status: '€12', avail: 'Glass walls · Premium', accent: '#F472B6' },
    { num: 4, status: '€10', avail: 'Booked till 7pm', accent: '#71717A' },
  ];
  return `<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
    ${courts.map(c => `<div class="card" style="display:flex;align-items:center;gap:14px">
      <div style="width:48px;height:48px;border-radius:12px;background:${c.accent};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">${c.num}</div>
      <div style="flex:1"><div style="font-size:16px;font-weight:600">Court ${c.num}</div><div style="font-size:13px;color:rgba(255,255,255,0.55);margin-top:2px">${c.avail}</div></div>
      <div style="font-size:15px;font-weight:600">${c.status}</div>
    </div>`).join('')}
  </div>`;
}

function courtDetailBlock(): string {
  return `<div style="display:flex;flex-direction:column;gap:16px">
    <div style="height:200px;border-radius:16px;background:linear-gradient(135deg,#F472B6,#A855F7);display:flex;align-items:flex-end;padding:16px"><div style="background:rgba(0,0,0,0.4);backdrop-filter:blur(10px);padding:6px 10px;border-radius:8px;font-size:12px;font-weight:600">PREMIUM</div></div>
    <div class="card"><div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:10px">Features</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${['Glass walls', 'LED lighting', 'A/C', 'Locker rooms'].map(t => `<div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:6px 12px;font-size:13px">${t}</div>`).join('')}</div>
    </div>
    <button style="background:#F472B6;color:#fff;border:0;border-radius:14px;padding:16px;font-size:17px;font-weight:600">Book this court</button>
  </div>`;
}

function timeGridBlock(): string {
  const times = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px">
    ${times.map((t, i) => `<div style="background:${i === 8 ? '#F472B6' : 'rgba(255,255,255,0.06)'};border:1px solid ${i === 8 ? '#F472B6' : 'rgba(255,255,255,0.08)'};border-radius:12px;padding:18px 0;text-align:center;font-size:17px;font-weight:600;color:${i === 8 ? '#fff' : i === 5 ? 'rgba(255,255,255,0.3)' : '#fff'};text-decoration:${i === 5 ? 'line-through' : 'none'}">${t}</div>`).join('')}
  </div>`;
}

function paymentBlock(): string {
  return `<div style="display:flex;flex-direction:column;gap:14px">
    <div class="card"><div style="display:flex;justify-content:space-between;font-size:15px"><span style="color:rgba(255,255,255,0.6)">Court 3 (Premium)</span><span>€12.00</span></div></div>
    <div class="card"><div style="display:flex;justify-content:space-between;font-size:15px"><span style="color:rgba(255,255,255,0.6)">Service fee</span><span>€0.50</span></div></div>
    <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;padding:8px 4px"><span>Total</span><span>€12.50</span></div>
    <div class="card" style="display:flex;align-items:center;gap:12px"><div style="width:32px;height:20px;border-radius:4px;background:linear-gradient(135deg,#F59E0B,#EF4444)"></div><span style="font-size:15px;flex:1">•••• 4242</span><span style="font-size:13px;color:rgba(255,255,255,0.4)">Change</span></div>
    <button style="margin-top:16px;background:#F472B6;color:#fff;border:0;border-radius:14px;padding:16px;font-size:17px;font-weight:600">Confirm · €12.50</button>
  </div>`;
}

function confirmationBlock(): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:24px;padding-top:60px">
    <div style="width:96px;height:96px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:48px">✓</div>
    <div class="card" style="width:100%;text-align:center">
      <div style="font-size:13px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.08em">Court 3</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px">Tomorrow · 6:00 PM</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-top:4px">1 hour · €12.50</div>
    </div>
    <button style="background:rgba(255,255,255,0.18);color:#fff;border:0;border-radius:14px;padding:14px 24px;font-size:15px;font-weight:600;width:100%">Add to calendar</button>
  </div>`;
}

function emptyStateBlock(): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:18px;padding-top:120px;text-align:center">
    <div style="width:80px;height:80px;border-radius:24px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:40px">📅</div>
    <button style="background:#F472B6;color:#fff;border:0;border-radius:14px;padding:14px 28px;font-size:15px;font-weight:600">Book a court</button>
  </div>`;
}

function bookingListBlock(): string {
  const items = [
    { date: 'Tomorrow', time: '6:00 PM', court: 'Court 3 · Padel', live: true },
    { date: 'Sat May 11', time: '10:00 AM', court: 'Court 1 · Padel', live: false },
    { date: 'Tue Apr 30', time: '7:00 PM', court: 'Court 2 · Padel', live: false, past: true },
  ];
  return `<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
    ${items.map(it => `<div class="card" style="display:flex;flex-direction:column;gap:6px;${it.past ? 'opacity:0.5' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:16px;font-weight:600">${it.date} · ${it.time}</div>${it.live ? '<div style="background:#10B981;color:#fff;font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px">UPCOMING</div>' : ''}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.55)">${it.court}</div>
    </div>`).join('')}
  </div>`;
}

function bookingDetailBlock(): string {
  return `<div style="display:flex;flex-direction:column;gap:14px">
    <div style="height:160px;border-radius:16px;background:linear-gradient(135deg,#F472B6,#A855F7)"></div>
    <div class="card"><div style="display:flex;justify-content:space-between;font-size:15px"><span style="color:rgba(255,255,255,0.6)">When</span><span style="font-weight:600">Tomorrow · 6:00 PM</span></div></div>
    <div class="card"><div style="display:flex;justify-content:space-between;font-size:15px"><span style="color:rgba(255,255,255,0.6)">Where</span><span style="font-weight:600">Court 3 · Padel Club</span></div></div>
    <div class="card"><div style="display:flex;justify-content:space-between;font-size:15px"><span style="color:rgba(255,255,255,0.6)">Paid</span><span style="font-weight:600">€12.50</span></div></div>
    <button style="margin-top:8px;background:transparent;color:#EF4444;border:1px solid rgba(239,68,68,0.4);border-radius:14px;padding:14px;font-size:15px;font-weight:600">Cancel booking</button>
  </div>`;
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const flow of FLOWS) {
    const dir = join(FIXTURE_DIR, 'screenshots', flow.id);
    await mkdir(dir, { recursive: true });
    for (const frame of flow.frames) {
      await page.setContent(frame.render(), { waitUntil: 'load' });
      await page.screenshot({
        path: join(dir, `${frame.id}.png`),
        fullPage: false,
      });
      console.log(`  ✓ ${flow.id}/${frame.id}.png`);
    }
  }
  await browser.close();

  const manifest = {
    projectId: 'folleli-mobile',
    buildSha: 'demo123abc456',
    capturedAt: new Date().toISOString(),
    platform: 'ios' as const,
    flows: FLOWS.map((f) => ({
      id: f.id,
      name: f.name,
      frames: f.frames.map((fr) => ({
        id: fr.id,
        name: fr.name,
        image: `screenshots/${f.id}/${fr.id}.png`,
      })),
    })),
  };
  await writeFile(join(FIXTURE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nFixture written to ${FIXTURE_DIR}/`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
