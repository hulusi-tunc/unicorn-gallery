'use client';

import { createContext, type ReactNode, useContext } from 'react';
import { BRANDS, type Brand, type BrandId } from '@/lib/brand';

const BrandContext = createContext<Brand>(BRANDS.unicorn);

/** Set once in the root layout from the request's host. */
export function BrandProvider({ brandId, children }: { brandId: BrandId; children: ReactNode }): ReactNode {
  return <BrandContext.Provider value={BRANDS[brandId]}>{children}</BrandContext.Provider>;
}

export function useBrand(): Brand {
  return useContext(BrandContext);
}
