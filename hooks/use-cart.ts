// hooks/use-cart.ts
"use client";

import { create } from "zustand";

export type CartItem = {
  variant_id: string;
  product_id: string;
  sku: string;
  name: string;
  size?: string | null;
  unit_price: number; // GST included (as per your DB)
  qty: number;
  image_path?: string | null;
  image_alt?: string | null;
  updated_at?: string | null;
};

type CartState = {
  isOpen: boolean;
  items: CartItem[];

  open: () => void;
  close: () => void;

  add: (item: CartItem) => void;
  remove: (variant_id: string) => void;
  setQty: (variant_id: string, qty: number) => void;
  clear: () => void;
  clearItems: () => void;
};

export const useCart = create<CartState>((set, get) => ({
  isOpen: false,
  items: [],

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  add: (item) => {
    // Guard rails: never allow bad items
    if (!item?.variant_id || !Number.isFinite(item.unit_price) || !Number.isFinite(item.qty)) return;

    set((state) => {
      const existing = state.items.find((i) => i.variant_id === item.variant_id);

      if (!existing) {
        return { items: [...state.items, item] };
      }

      return {
        items: state.items.map((i) =>
          i.variant_id === item.variant_id ? { ...i, qty: i.qty + item.qty } : i
        ),
      };
    });
  },

  remove: (variant_id) =>
    set((state) => ({ items: state.items.filter((i) => i.variant_id !== variant_id) })),

  setQty: (variant_id, qty) => {
    const q = Math.max(0, Math.floor(qty || 0));
    set((state) => {
      if (q <= 0) return { items: state.items.filter((i) => i.variant_id !== variant_id) };
      return {
        items: state.items.map((i) => (i.variant_id === variant_id ? { ...i, qty: q } : i)),
      };
    });
  },

  clear: () => set({ items: [], isOpen: false }),
  clearItems: () => set({ items: [] }),
}));