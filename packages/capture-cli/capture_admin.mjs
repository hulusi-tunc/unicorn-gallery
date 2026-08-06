import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = 'http://127.0.0.1:8000'
const OUT = '/Users/hulusitunc/chablivraison/_captures/admin'
const FLOW = 'admin'

// [id, name, path]
const PAGES = [
  ['dashboard', 'Dashboard', '/admin'],
  ['orders-all', 'Orders - All', '/admin/order/list/all'],
  ['orders-pending', 'Orders - Pending', '/admin/order/list/pending'],
  ['order-details', 'Order Details', '/admin/order/details/1'],
  ['pos', 'POS (New Order)', '/admin/pos'],
  ['foods', 'Foods', '/admin/food/list'],
  ['food-add', 'Add Food', '/admin/food/add-new'],
  ['food-reviews', 'Food Reviews', '/admin/food/reviews'],
  ['categories', 'Categories', '/admin/category/add'],
  ['cuisines', 'Cuisines', '/admin/cuisine/add'],
  ['restaurants', 'Restaurants', '/admin/restaurant/list'],
  ['restaurant-add', 'Add Restaurant', '/admin/restaurant/add'],
  ['customers', 'Customers', '/admin/customer/list'],
  ['customer-wallet', 'Customer Wallet Report', '/admin/customer/wallet/report'],
  ['customers-subscribed', 'Subscribed Customers', '/admin/customer/subscribed'],
  ['delivery-men', 'Delivery Men', '/admin/delivery-man/list'],
  ['delivery-man-add', 'Add Delivery Man', '/admin/delivery-man/add'],
  ['banners', 'Banners', '/admin/banner/add-new'],
  ['coupons', 'Coupons', '/admin/coupon/add-new'],
  ['cashback', 'Cashback', '/admin/cashback'],
  ['employees', 'Employees', '/admin/employee/list'],
  ['subscriptions', 'Subscriptions', '/admin/subscription/list'],
  ['report-order', 'Order Report', '/admin/report/order-report'],
  ['report-transaction', 'Transaction Report', '/admin/report/transaction-report'],
  ['report-food', 'Food-wise Report', '/admin/report/food-wise-report'],
  ['zones', 'Zones', '/admin/zone'],
  ['advertisements', 'Advertisements', '/admin/advertisement'],
  ['withdraw-methods', 'Withdraw Methods', '/admin/withdraw-method/list'],
  ['business-config', 'Business Config', '/admin/business-settings/config-setup'],
  ['payment-methods', 'Payment Methods', '/admin/business-settings/payment-method'],
  ['landing-settings', 'Landing Page Settings', '/admin/landing-page/header'],
  ['notification-send', 'Send Notification', '/admin/notification/add-new'],
  ['vehicles', 'Vehicles', '/admin/vehicle/list'],
  ['settings', 'Admin Settings', '/admin/settings'],
]

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((res) => {
      let t = 0
      const step = 600
      const timer = setInterval(() => {
        window.scrollBy(0, step); t += step
        if (t >= document.body.scrollHeight - window.innerHeight) { clearInterval(timer); window.scrollTo(0, 0); res() }
      }, 100)
    })
  }).catch(() => {})
  await page.waitForTimeout(500)
}

const dir = join(OUT, 'screenshots', FLOW)
await mkdir(dir, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

// authenticate
await page.goto(BASE + '/dev-admin-login', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(1500)
console.log('authed, url=', page.url())

const frames = []
for (const [id, name, path] of PAGES) {
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 })
  } catch (e) { console.log('goto fail', path, e.message) }
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await autoScroll(page)
  const file = `${id}.png`
  await page.screenshot({ path: join(dir, file), fullPage: true }).catch((e) => console.log('shot fail', id, e.message))
  frames.push({ id, name, image: `screenshots/${FLOW}/${file}` })
  console.log('  captured', id)
}

const manifest = {
  projectId: 'chablivraison-admin',
  buildSha: 'local',
  capturedAt: '2026-08-04T00:00:00.000Z',
  platform: 'web',
  flows: [{ id: FLOW, name: 'Admin Panel', frames }],
}
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log('DONE', frames.length, 'frames')
await browser.close()
