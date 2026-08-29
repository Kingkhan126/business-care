"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Pill,
  Search,
  ShoppingCart,
  Heart,
  User,
  FileUp,
  ShieldCheck,
  RotateCw,
  Tag,
  Menu,
  X,
  ChevronDown,
  Lock,
} from "lucide-react";

interface HeaderProps {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  cartCount?: number;
}

export function Header({ user, cartCount = 0 }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      {/* Top Banner */}
      <div className="bg-teal-900 text-white text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="flex items-center font-medium">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-teal-300" />
              Licensed Pharmacy Verification
            </span>
            <span className="hidden sm:inline text-teal-300">•</span>
            <span className="hidden sm:inline">100% Genuine Prescription & OTC Medicines</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded text-[11px] hover:bg-amber-300 transition flex items-center">
              <ShieldCheck className="w-3 h-3 mr-1 text-slate-950" />
              Admin Panel
            </Link>
            <Link href="/account/refill-reminders" className="hover:text-teal-200 flex items-center">
              <RotateCw className="w-3 h-3 mr-1" />
              Refill Reminders
            </Link>
            <Link href="/account/support" className="hover:text-teal-200">
              Customer Support
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3 group shrink-0">
          <div className="w-10 h-10 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path d="M 18,38 H 38 V 18 H 50 V 82 H 38 V 62 H 18 Z" fill="#62B834" />
              <path d="M 50,18 H 62 V 38 H 82 V 62 H 62 V 82 H 50 Z" fill="#3B5488" />
              <circle cx="50" cy="50" r="15" fill="white" />
              <path d="M 43,50 H 57 M 50,43 V 57" stroke="#3B5488" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex flex-col justify-center">
            <div className="text-xl font-extrabold tracking-tight leading-none flex items-center">
              <span className="text-[#3B5488]">AD&nbsp;</span>
              <span className="text-[#62B834]">CARE</span>
            </div>
            <span className="text-[11px] font-bold text-[#3B5488] tracking-tight block mt-0.5">
              Meds & Pharmacy
            </span>
          </div>
        </Link>

        {/* Global Search */}
        <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-xl relative">
          <input
            type="text"
            placeholder="Search medicines, OTC products, skincare, vitamins, brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
          />
          <button
            type="submit"
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-teal-600"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>

        {/* Actions & User Controls */}
        <div className="flex items-center space-x-3 sm:space-x-5">
          {/* Upload Prescription Button */}
          <Link
            href="/prescriptions/upload"
            className="hidden lg:flex items-center space-x-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
          >
            <FileUp className="w-4 h-4 text-teal-600" />
            <span>Upload Prescription</span>
          </Link>

          {/* Wishlist */}
          <Link href="/account/wishlist" className="text-slate-600 hover:text-teal-600 relative p-1">
            <Heart className="w-5 h-5" />
          </Link>

          {/* Cart */}
          <Link href="/cart" className="text-slate-600 hover:text-teal-600 relative p-1">
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>

          {/* User Account / Auth */}
          {user ? (
            <div className="flex items-center space-x-2">
              <Link
                href={user.role === "ADMIN" || user.role === "PHARMACIST" ? "/admin" : "/account"}
                className="flex items-center space-x-1.5 text-xs font-medium text-slate-700 hover:text-teal-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
              >
                <User className="w-4 h-4 text-teal-700" />
                <span className="max-w-[90px] truncate">{user.name}</span>
                {user.role !== "CUSTOMER" && (
                  <span className="bg-teal-800 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ml-1">
                    {user.role}
                  </span>
                )}
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center space-x-1 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg shadow-sm transition"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-slate-700 hover:text-teal-600 p-1"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Category Navigation Bar */}
      <nav className="hidden md:block bg-slate-900 text-slate-200 text-xs font-medium border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center space-x-6 overflow-x-auto py-2.5 no-scrollbar">
          <Link href="/products" className="hover:text-teal-400 font-semibold flex items-center text-white shrink-0">
            All Products
          </Link>
          <Link href="/categories/medicines" className="hover:text-teal-400 shrink-0">
            Medicines
          </Link>
          <Link href="/categories/otc-products" className="hover:text-teal-400 shrink-0">
            OTC Products
          </Link>
          <Link href="/categories/prescription-medicines" className="hover:text-teal-400 text-amber-300 font-semibold shrink-0">
            Rx Medicines
          </Link>
          <Link href="/categories/vitamins-supplements" className="hover:text-teal-400 shrink-0">
            Vitamins & Supplements
          </Link>
          <Link href="/categories/personal-care" className="hover:text-teal-400 shrink-0">
            Personal Care
          </Link>
          <Link href="/categories/skincare" className="hover:text-teal-400 shrink-0">
            Skincare
          </Link>
          <Link href="/categories/hair-care" className="hover:text-teal-400 shrink-0">
            Hair Care
          </Link>
          <Link href="/categories/oral-care" className="hover:text-teal-400 shrink-0">
            Oral Care
          </Link>
          <Link href="/categories/hygiene-products" className="hover:text-teal-400 shrink-0">
            Hygiene
          </Link>
          <Link href="/categories/baby-mother-care" className="hover:text-teal-400 shrink-0">
            Baby & Mother
          </Link>
          <Link href="/categories/medical-devices" className="hover:text-teal-400 shrink-0">
            Medical Devices
          </Link>
          <Link href="/categories/wellness-products" className="hover:text-teal-400 shrink-0">
            Wellness
          </Link>
          <Link href="/offers" className="text-amber-400 hover:text-amber-300 font-bold flex items-center shrink-0">
            <Tag className="w-3 h-3 mr-1" />
            Offers & Deals
          </Link>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 text-white p-4 space-y-4 border-t border-slate-800">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search pharmacy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-800 text-white rounded border border-slate-700"
            />
          </form>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link href="/products" className="p-2 bg-slate-800 rounded hover:bg-slate-700">All Products</Link>
            <Link href="/prescriptions/upload" className="p-2 bg-teal-800 text-teal-100 rounded hover:bg-teal-700 font-semibold">Upload Prescription</Link>
            <Link href="/categories/medicines" className="p-2 bg-slate-800 rounded">Medicines</Link>
            <Link href="/categories/otc-products" className="p-2 bg-slate-800 rounded">OTC Products</Link>
            <Link href="/categories/prescription-medicines" className="p-2 bg-slate-800 rounded text-amber-300 font-medium">Rx Medicines</Link>
            <Link href="/categories/vitamins-supplements" className="p-2 bg-slate-800 rounded">Vitamins</Link>
            <Link href="/categories/skincare" className="p-2 bg-slate-800 rounded">Skincare</Link>
            <Link href="/categories/medical-devices" className="p-2 bg-slate-800 rounded">Medical Devices</Link>
            <Link href="/offers" className="p-2 bg-amber-900 text-amber-200 rounded font-bold">Offers & Deals</Link>
            <Link href="/account/refill-reminders" className="p-2 bg-slate-800 rounded">Refill Reminders</Link>
          </div>
        </div>
      )}
    </header>
  );
}
