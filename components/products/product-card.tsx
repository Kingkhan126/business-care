"use client";

import Link from "next/link";
import { Pill, Heart, ShoppingBag, Star, AlertTriangle, ShieldCheck } from "lucide-react";
import { useState } from "react";

export interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice?: number | null;
  stockQuantity: number;
  isPrescriptionRequired: boolean;
  dosageForm?: string | null;
  imageUrl?: string | null;
  ratingAverage: number;
  ratingCount: number;
  categoryName?: string;
  brandName?: string;
}

export function ProductCard({
  id,
  name,
  slug,
  price,
  salePrice,
  stockQuantity,
  isPrescriptionRequired,
  dosageForm,
  imageUrl,
  ratingAverage,
  ratingCount,
  categoryName,
  brandName,
}: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const displayPrice = salePrice && salePrice < price ? salePrice : price;
  const isDiscounted = salePrice && salePrice < price;
  const discountPercent = isDiscounted ? Math.round(((price - salePrice) / price) * 100) : 0;
  const inStock = stockQuantity > 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!inStock) return;
    
    // Store in localStorage cart for fast client-side responsiveness
    try {
      const existingCart = JSON.parse(localStorage.getItem("medicare_cart") || "[]");
      const existingIdx = existingCart.findIndex((item: any) => item.id === id);
      if (existingIdx >= 0) {
        existingCart[existingIdx].quantity += 1;
      } else {
        existingCart.push({ id, name, price: displayPrice, isPrescriptionRequired, imageUrl, quantity: 1 });
      }
      localStorage.setItem("medicare_cart", JSON.stringify(existingCart));
    } catch {}

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <div className="group bg-white rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition flex flex-col h-full overflow-hidden relative">
      {/* Discount & Badges */}
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1">
        {isPrescriptionRequired && (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center shadow-xs">
            <Pill className="w-3 h-3 mr-1 text-amber-700" />
            Rx Required
          </span>
        )}
        {isDiscounted && (
          <span className="bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-xs">
            -{discountPercent}% OFF
          </span>
        )}
      </div>

      {/* Wishlist Button */}
      <button
        onClick={() => setIsWishlisted(!isWishlisted)}
        className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-500 transition shadow-xs"
        title="Save to Wishlist"
      >
        <Heart className={`w-4 h-4 ${isWishlisted ? "fill-red-500 text-red-500" : ""}`} />
      </button>

      {/* Product Image Link */}
      <Link href={`/products/${id}`} className="block relative aspect-square bg-slate-50 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Pill className="w-12 h-12" />
          </div>
        )}
      </Link>

      {/* Details Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Category & Brand */}
          <div className="flex items-center text-[11px] text-slate-500 mb-1 space-x-1.5">
            {brandName && <span className="font-semibold text-slate-700">{brandName}</span>}
            {brandName && categoryName && <span>•</span>}
            {categoryName && <span>{categoryName}</span>}
            {dosageForm && <span className="ml-auto font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{dosageForm}</span>}
          </div>

          {/* Title */}
          <Link href={`/products/${id}`} className="block">
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 line-clamp-2 leading-snug">
              {name}
            </h3>
          </Link>
        </div>

        <div>
          {/* Rating */}
          <div className="flex items-center space-x-1 mb-2">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-slate-800">{ratingAverage.toFixed(1)}</span>
            <span className="text-[11px] text-slate-400">({ratingCount})</span>
          </div>

          {/* Pricing & Stock */}
          <div className="flex items-baseline justify-between pt-1 border-t border-slate-100">
            <div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-base font-extrabold text-slate-900">
                  ${displayPrice.toFixed(2)}
                </span>
                {isDiscounted && (
                  <span className="text-xs text-slate-400 line-through">
                    ${price.toFixed(2)}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium block ${inStock ? "text-emerald-700" : "text-red-600"}`}>
                {inStock ? `In Stock (${stockQuantity})` : "Out of Stock"}
              </span>
            </div>

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-xs ${
                addedToCart
                  ? "bg-emerald-600 text-white"
                  : inStock
                  ? "bg-teal-600 hover:bg-teal-700 text-white"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{addedToCart ? "Added!" : "Add"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
