export type ProductVariant = {
  id: string;
  sku: string;
  size: string;
  price: number; // numeric puede venir string, lo normalizamos
  active?: boolean;
};

export type Product = {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  description: string;
  sort_order: number;
  active?: boolean;
  product_variants: ProductVariant[];
};