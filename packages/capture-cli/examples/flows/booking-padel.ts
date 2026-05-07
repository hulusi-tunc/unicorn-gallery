import { defineFlow } from '@unicorn-studio/gallery-capture';

// Example Playwright flow file.
// Designer asks Claude: "write a flow that books a padel court at 6pm tomorrow,
// and snaps each step." Claude generates this.
export default defineFlow(
  'booking-padel',
  'Padel Booking',
  async ({ page, snap }) => {
    await page.goto('/');
    await page.click('text=Book a court');
    await snap('01-court-list', 'Court List');

    await page.click('text=Court 3');
    await snap('02-court-selected', 'Court Selected');

    await page.click('text=Tomorrow 6pm');
    await snap('03-time-selected', 'Time Selected');

    await page.click('text=Confirm booking');
    await snap('04-confirmed', 'Booking Confirmed');
  },
);
