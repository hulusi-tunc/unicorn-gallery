/* Seeds Supabase with the Folleli fixture, an agency user, and a sample customer.
 * Idempotent: re-running upserts. */
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { loadEnv } from './load-env.js';

loadEnv();

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']!;
const SERVICE_ROLE = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const FIXTURE_DIR = resolve(process.cwd(), '.fixture');
const SCREENSHOTS_BUCKET = 'screenshots';
const AGENCY_EMAIL = process.env['SEED_AGENCY_EMAIL'] ?? 'hulusitunc1@gmail.com';
const SAMPLE_CUSTOMER_EMAIL = process.env['SEED_CUSTOMER_EMAIL'] ?? 'sample-customer@folleli.test';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface FixtureManifest {
  projectId: string;
  buildSha: string;
  capturedAt: string;
  platform: 'web' | 'ios' | 'android';
  flows: Array<{
    id: string;
    name: string;
    frames: Array<{ id: string; name: string; image: string }>;
  }>;
}

async function ensureBucket(): Promise<void> {
  const { data: list } = await admin.storage.listBuckets();
  if (list?.some((b) => b.name === SCREENSHOTS_BUCKET)) {
    console.log(`✓ bucket ${SCREENSHOTS_BUCKET} exists`);
    return;
  }
  const { error } = await admin.storage.createBucket(SCREENSHOTS_BUCKET, {
    public: true,
    fileSizeLimit: 20 * 1024 * 1024,
  });
  if (error && !/already exists/i.test(error.message)) throw error;
  console.log(`✓ bucket ${SCREENSHOTS_BUCKET} created`);
}

async function ensureUser(email: string, role: 'agency' | 'customer'): Promise<string> {
  // 1. Check if user already exists
  const { data: existing, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;
  let userId = existing.users.find((u) => u.email === email)?.id;

  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createErr) throw createErr;
    userId = created.user.id;
    console.log(`✓ created auth user ${email}`);
  } else {
    console.log(`✓ auth user ${email} already exists`);
  }

  // 2. Upsert profile with target role
  const { error: profErr } = await admin
    .from('profiles')
    .upsert({ id: userId, email, role }, { onConflict: 'id' });
  if (profErr) throw profErr;
  console.log(`  → profile.role = ${role}`);
  return userId;
}

async function uploadFile(storagePath: string, file: Buffer): Promise<string> {
  const { error } = await admin.storage
    .from(SCREENSHOTS_BUCKET)
    .upload(storagePath, file, {
      contentType: 'image/png',
      upsert: true,
    });
  if (error) throw error;
  const { data } = admin.storage.from(SCREENSHOTS_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function seedFolleli(creatorId: string, customerId: string): Promise<void> {
  const manifestPath = join(FIXTURE_DIR, 'manifest.json');
  const fixtureManifest = JSON.parse(await readFile(manifestPath, 'utf8')) as FixtureManifest;

  // 1. Upsert app
  const slug = 'folleli';
  const { data: app, error: appErr } = await admin
    .from('apps')
    .upsert(
      {
        slug,
        name: 'Folleli',
        tagline: 'Padel court booking',
        platform: fixtureManifest.platform,
        created_by: creatorId,
        project_token: `pgt_${nanoid(32)}`,
        accent_color: '#F472B6',
      },
      { onConflict: 'slug' },
    )
    .select('*')
    .single();
  if (appErr) throw appErr;
  console.log(`✓ app "${app.name}" (${app.slug}) → id=${app.id}`);

  // 2. Add sample customer
  const { error: addCustErr } = await admin
    .from('app_customers')
    .upsert({ app_id: app.id, user_id: customerId, invited_by: creatorId }, { onConflict: 'app_id,user_id' });
  if (addCustErr) throw addCustErr;
  console.log(`  → added customer ${SAMPLE_CUSTOMER_EMAIL} to ${slug}`);

  // 3. Upload screenshots and rewrite manifest paths to public URLs
  const newFlows: FixtureManifest['flows'] = [];
  for (const flow of fixtureManifest.flows) {
    const newFrames: typeof flow.frames = [];
    for (const frame of flow.frames) {
      const localPath = join(FIXTURE_DIR, frame.image);
      const buf = await readFile(localPath);
      const storagePath = `${app.id}/${fixtureManifest.buildSha}/${flow.id}/${frame.id}.png`;
      const publicUrl = await uploadFile(storagePath, buf);
      newFrames.push({ ...frame, image: publicUrl });
    }
    newFlows.push({ ...flow, frames: newFrames });
  }
  console.log(`  → uploaded ${newFlows.reduce((n, f) => n + f.frames.length, 0)} screenshots`);

  const rewritten: FixtureManifest = { ...fixtureManifest, flows: newFlows };

  // 4. Insert build (skip if same SHA already exists)
  const { data: existingBuild } = await admin
    .from('builds')
    .select('id')
    .eq('app_id', app.id)
    .eq('sha', fixtureManifest.buildSha)
    .maybeSingle();
  let buildId: string;
  if (existingBuild) {
    const { error: updErr } = await admin
      .from('builds')
      .update({
        manifest: rewritten,
        captured_at: fixtureManifest.capturedAt,
      })
      .eq('id', existingBuild.id);
    if (updErr) throw updErr;
    buildId = existingBuild.id;
  } else {
    const { data: build, error: buildErr } = await admin
      .from('builds')
      .insert({
        app_id: app.id,
        sha: fixtureManifest.buildSha,
        captured_at: fixtureManifest.capturedAt,
        platform: fixtureManifest.platform,
        manifest: rewritten,
        is_visible: true,
      })
      .select('id')
      .single();
    if (buildErr) throw buildErr;
    buildId = build.id;
  }
  console.log(`  → build ${fixtureManifest.buildSha} → id=${buildId}`);

  // 5. Set preview_image_url to the first frame of the first flow (the welcome/home screen)
  const firstFlow = newFlows[0];
  const previewUrl = firstFlow?.frames[0]?.image ?? null;
  if (previewUrl) {
    await admin.from('apps').update({ preview_image_url: previewUrl }).eq('id', app.id);
    console.log(`  → preview image set to ${firstFlow!.frames[0]!.id}`);
  }

  // 6. Upsert frame rows so comments can attach
  for (const flow of newFlows) {
    for (const frame of flow.frames) {
      const { error: frameErr } = await admin
        .from('frames')
        .upsert(
          {
            app_id: app.id,
            flow_id: flow.id,
            frame_id: frame.id,
            flow_name: flow.name,
            frame_name: frame.name,
            latest_image_url: frame.image,
            latest_build_id: buildId,
          },
          { onConflict: 'app_id,flow_id,frame_id' },
        );
      if (frameErr) throw frameErr;
    }
  }
  console.log(`  → frames upserted`);
}

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else if (entry.isFile() && extname(full) === '.png') out.push(full);
  }
  return out;
}
void listFiles; // reserved for future bulk paths

async function main(): Promise<void> {
  // Ensure fixture exists
  try {
    await stat(join(FIXTURE_DIR, 'manifest.json'));
  } catch {
    console.error(`Fixture not found at ${FIXTURE_DIR}. Run \`pnpm fixture:gen\` first.`);
    process.exit(1);
  }

  await ensureBucket();
  const agencyId = await ensureUser(AGENCY_EMAIL, 'agency');
  const customerId = await ensureUser(SAMPLE_CUSTOMER_EMAIL, 'customer');
  await seedFolleli(agencyId, customerId);
  console.log('\n✓ Seed complete.');
  console.log(`\nAgency user: ${AGENCY_EMAIL}`);
  console.log(`Customer user: ${SAMPLE_CUSTOMER_EMAIL}`);
  console.log(`\nSign in at http://localhost:3010/sign-in with one of the emails above.`);
  console.log(`(For the test customer, you can run a magic-link generation manually if no inbox is configured.)`);
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
