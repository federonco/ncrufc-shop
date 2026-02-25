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
  image_path?: string | null;
  image_alt?: string | null;
  product_variants: ProductVariant[];
};