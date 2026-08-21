'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Editorial Tooltip — Radix primitive styled to match the Unicorn Studio
 * gallery system. Rounded surface, hairline border, Inter body,
 * theme-aware via Tailwind `dark:` variants. No gradients.
 */

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = ({
  delayDuration = 150,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) => (
  <TooltipPrimitive.Root delayDuration={delayDuration} {...props} />
);

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        // surface + border + shadow (theme-aware)
        'z-[120] overflow-hidden rounded-md border px-2.5 py-1.5',
        'border-[oklch(0.83_0.009_260)] bg-white text-[oklch(0.24_0.01_260)]',
        'dark:border-[oklch(0.3_0.01_260)] dark:bg-[oklch(0.21_0.008_260)] dark:text-[oklch(0.82_0.012_260)]',
        'shadow-[0_8px_18px_-8px_rgba(15,15,20,0.18)] dark:shadow-[0_8px_18px_-8px_rgba(0,0,0,0.55)]',
        // typography
        'font-sans text-xs leading-snug',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
