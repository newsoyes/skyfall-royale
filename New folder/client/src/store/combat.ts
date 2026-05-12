import { create } from 'zustand'

/** Local combat UI: ADS (right mouse), etc. */
export const useCombat = create<{
  ads: boolean
  setAds: (ads: boolean) => void
}>((set) => ({
  ads: false,
  setAds: (ads) => set({ ads }),
}))
